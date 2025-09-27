/**
 * Screenshot Service using Screenpipe Frame API
 * Extracts frames directly from Screenpipe API instead of video files
 */

import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createLogger } from '../utils/logger';

const execAsync = promisify(exec);
const logger = createLogger('screenshot-api-service');

export interface ScreenshotPaths {
  screenshot: string;
  thumbnail: string;
}

export class ScreenshotAPIService {
  private screenshotDir: string;
  private thumbnailDir: string;

  constructor() {
    // Set up paths relative to project root
    const projectRoot = process.env.PROJECT_ROOT || path.resolve(__dirname, '../../../..');
    this.screenshotDir = path.join(projectRoot, 'data/screenshots');
    this.thumbnailDir = path.join(projectRoot, 'data/thumbnails');
    this.ensureDirectories();
  }

  /**
   * Ensure screenshot and thumbnail directories exist
   */
  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.screenshotDir, { recursive: true });
      await fs.mkdir(this.thumbnailDir, { recursive: true });
      logger.debug('Screenshot directories ensured', {
        screenshotDir: this.screenshotDir,
        thumbnailDir: this.thumbnailDir
      });
    } catch (error) {
      logger.error('Failed to create screenshot directories', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Extract screenshot from Screenpipe frame API and generate thumbnail
   */
  async extractAndStoreScreenshot(
    frameId: number,
    eventId: string
  ): Promise<ScreenshotPaths | null> {
    try {
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

      // Get frame data from Screenpipe API
      const frameUrl = `http://localhost:3030/frames/${frameId}`;
      
      logger.debug('Fetching frame from Screenpipe API', {
        frameId,
        frameUrl,
        eventId
      });

      const response = await fetch(frameUrl);
      if (!response.ok) {
        logger.warn('Failed to fetch frame from Screenpipe API', {
          frameId,
          status: response.status,
          statusText: response.statusText
        });
        return null;
      }

      // Save the frame as screenshot
      const frameBuffer = await response.arrayBuffer();
      await fs.writeFile(screenshotPath, Buffer.from(frameBuffer));

      // Verify screenshot was created
      try {
        await fs.access(screenshotPath);
      } catch (error) {
        logger.error('Screenshot file was not created', {
          screenshotPath,
          error: error instanceof Error ? error.message : String(error)
        });
        return null;
      }

      // Generate thumbnail using ffmpeg
      const thumbnailCommand = `ffmpeg -i "${screenshotPath}" -vf "scale=400:-1" -q:v 3 -y "${thumbnailPath}" 2>/dev/null`;
      
      try {
        await execAsync(thumbnailCommand);
        logger.debug('Thumbnail generated successfully', { thumbnailPath });
      } catch (error) {
        logger.error('Failed to generate thumbnail', { 
          error: error instanceof Error ? error.message : error,
          screenshotPath,
          command: thumbnailCommand
        });
        // If thumbnail fails, we still have the screenshot
        return {
          screenshot: screenshotPath,
          thumbnail: screenshotPath // Use screenshot as thumbnail fallback
        };
      }

      // Verify both files exist
      const screenshotStats = await fs.stat(screenshotPath);
      const thumbnailStats = await fs.stat(thumbnailPath);

      logger.info('📸 Screenshot and thumbnail created from API', {
        eventId,
        frameId,
        screenshotPath,
        thumbnailPath,
        screenshotSize: screenshotStats.size,
        thumbnailSize: thumbnailStats.size
      });

      return {
        screenshot: screenshotPath,
        thumbnail: thumbnailPath
      };
    } catch (error) {
      logger.error('Failed to extract screenshot from API', {
        error: error instanceof Error ? error.message : String(error),
        frameId,
        eventId
      });
      return null;
    }
  }

  /**
   * Get screenshot URL for serving via API
   */
  getScreenshotUrl(eventId: string): string {
    return `/screenshots/${eventId}.jpg`;
  }

  /**
   * Get thumbnail URL for serving via API
   */
  getThumbnailUrl(eventId: string): string {
    return `/thumbnails/${eventId}_thumb.jpg`;
  }
}
