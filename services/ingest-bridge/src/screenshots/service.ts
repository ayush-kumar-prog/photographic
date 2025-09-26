/**
 * Screenshot Extraction Service
 * Extracts frames from video files and generates thumbnails
 */

import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createLogger } from '../utils/logger';

const execAsync = promisify(exec);
const logger = createLogger('screenshot-service');

export interface ScreenshotPaths {
  screenshot: string;
  thumbnail: string;
}

export class ScreenshotService {
  private screenshotDir: string;
  private thumbnailDir: string;
  private projectRoot: string;

  constructor() {
    // Set up paths relative to project root
    this.projectRoot = process.env.PROJECT_ROOT || path.resolve(__dirname, '../../../..');
    this.screenshotDir = path.join(this.projectRoot, 'data/screenshots');
    this.thumbnailDir = path.join(this.projectRoot, 'data/thumbnails');
    
    logger.info('Screenshot service initialized', {
      screenshotDir: this.screenshotDir,
      thumbnailDir: this.thumbnailDir
    });

    this.ensureDirectories();
  }

  /**
   * Ensure screenshot and thumbnail directories exist
   */
  private async ensureDirectories() {
    try {
      await fs.mkdir(this.screenshotDir, { recursive: true });
      await fs.mkdir(this.thumbnailDir, { recursive: true });
      logger.debug('Screenshot directories created/verified');
    } catch (error) {
      logger.error('Failed to create directories:', error);
    }
  }

  /**
   * Extract a screenshot from a video file and generate a thumbnail
   * @param videoPath Path to the video file
   * @param eventId Unique identifier for the memory event
   * @param timestamp Optional timestamp in seconds to extract frame from
   * @returns Paths to the screenshot and thumbnail, or null if extraction fails
   */
  async extractAndStoreScreenshot(
    videoPath: string,
    eventId: string,
    timestamp: number = 0
  ): Promise<ScreenshotPaths | null> {
    try {
      // Check if video file exists
      try {
        await fs.access(videoPath);
      } catch {
        logger.warn('Video file does not exist', { videoPath });
        return null;
      }

      // Define output paths
      const screenshotFilename = `${eventId}.jpg`;
      const thumbnailFilename = `${eventId}_thumb.jpg`;
      const screenshotPath = path.join(this.screenshotDir, screenshotFilename);
      const thumbnailPath = path.join(this.thumbnailDir, thumbnailFilename);

      // Check if screenshot already exists
      try {
        await fs.access(screenshotPath);
        await fs.access(thumbnailPath);
        logger.debug('Screenshot already exists', { eventId });
        return {
          screenshot: screenshotPath,
          thumbnail: thumbnailPath
        };
      } catch {
        // Screenshot doesn't exist, proceed with extraction
      }

      logger.debug('Extracting screenshot from video', { 
        videoPath, 
        eventId,
        timestamp 
      });

      // Extract frame using ffmpeg
      // -i: input file
      // -vframes 1: extract 1 frame
      // -q:v 2: quality level (2 is good quality)
      // -strict unofficial: allow non-standard YUV
      // -pix_fmt yuvj420p: use full range YUV for JPEG
      // -y: overwrite output file
      // Note: We extract the first frame as videos are short (2 seconds at 0.5 FPS = 1 frame)
      const ffmpegCommand = `ffmpeg -i "${videoPath}" -vframes 1 -q:v 2 -strict unofficial -pix_fmt yuvj420p -y "${screenshotPath}" 2>/dev/null`;
      
      try {
        await execAsync(ffmpegCommand);
        logger.debug('Screenshot extracted successfully', { screenshotPath });
      } catch (error) {
        logger.error('Failed to extract screenshot with ffmpeg', { 
          error: error instanceof Error ? error.message : error,
          videoPath,
          command: ffmpegCommand
        });
        return null;
      }

      // Generate thumbnail using ffmpeg (faster than using sharp for video frames)
      // Scale to 400px width, maintain aspect ratio
      const thumbnailCommand = `ffmpeg -i "${screenshotPath}" -vf "scale=400:-1" -q:v 3 -y "${thumbnailPath}" 2>/dev/null`;
      
      try {
        await execAsync(thumbnailCommand);
        logger.debug('Thumbnail generated successfully', { thumbnailPath });
      } catch (error) {
        logger.error('Failed to generate thumbnail', { 
          error: error instanceof Error ? error.message : error,
          screenshotPath
        });
        // If thumbnail fails, we still have the screenshot
        return {
          screenshot: screenshotPath,
          thumbnail: screenshotPath // Use screenshot as thumbnail fallback
        };
      }

      // Verify files were created
      try {
        const [screenshotStats, thumbnailStats] = await Promise.all([
          fs.stat(screenshotPath),
          fs.stat(thumbnailPath)
        ]);

        logger.info('📸 Screenshot and thumbnail created', {
          eventId,
          screenshotSize: screenshotStats.size,
          thumbnailSize: thumbnailStats.size
        });

        return {
          screenshot: screenshotPath,
          thumbnail: thumbnailPath
        };
      } catch (error) {
        logger.error('Files were not created properly', { error });
        return null;
      }

    } catch (error) {
      logger.error('Screenshot extraction failed', {
        error: error instanceof Error ? error.message : error,
        videoPath,
        eventId
      });
      return null;
    }
  }

  /**
   * Get the relative paths for serving via API
   */
  getServingPaths(eventId: string): { screenshot: string; thumbnail: string } {
    return {
      screenshot: `/screenshots/${eventId}.jpg`,
      thumbnail: `/thumbnails/${eventId}_thumb.jpg`
    };
  }

  /**
   * Clean up old screenshots and thumbnails
   * @param olderThanDays Remove files older than this many days
   */
  async cleanupOldFiles(olderThanDays: number = 7): Promise<void> {
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);

    try {
      // Clean screenshots
      const screenshots = await fs.readdir(this.screenshotDir);
      for (const file of screenshots) {
        const filePath = path.join(this.screenshotDir, file);
        const stats = await fs.stat(filePath);
        if (stats.mtimeMs < cutoffTime) {
          await fs.unlink(filePath);
          logger.debug('Deleted old screenshot', { file });
        }
      }

      // Clean thumbnails
      const thumbnails = await fs.readdir(this.thumbnailDir);
      for (const file of thumbnails) {
        const filePath = path.join(this.thumbnailDir, file);
        const stats = await fs.stat(filePath);
        if (stats.mtimeMs < cutoffTime) {
          await fs.unlink(filePath);
          logger.debug('Deleted old thumbnail', { file });
        }
      }

      logger.info('Cleanup completed', { olderThanDays });
    } catch (error) {
      logger.error('Cleanup failed', { error });
    }
  }

  /**
   * Get statistics about stored screenshots
   */
  async getStats(): Promise<{
    totalScreenshots: number;
    totalThumbnails: number;
    totalSizeMB: number;
  }> {
    try {
      const [screenshots, thumbnails] = await Promise.all([
        fs.readdir(this.screenshotDir),
        fs.readdir(this.thumbnailDir)
      ]);

      let totalSize = 0;

      // Calculate total size
      for (const file of screenshots) {
        const stats = await fs.stat(path.join(this.screenshotDir, file));
        totalSize += stats.size;
      }
      for (const file of thumbnails) {
        const stats = await fs.stat(path.join(this.thumbnailDir, file));
        totalSize += stats.size;
      }

      return {
        totalScreenshots: screenshots.length,
        totalThumbnails: thumbnails.length,
        totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100
      };
    } catch (error) {
      logger.error('Failed to get stats', { error });
      return {
        totalScreenshots: 0,
        totalThumbnails: 0,
        totalSizeMB: 0
      };
    }
  }
}
