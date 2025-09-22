import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { logger } from '../utils/logger';

export class ThumbnailGenerator {
  private thumbsDir: string;
  private readonly THUMBNAIL_WIDTH = 300;
  private readonly THUMBNAIL_HEIGHT = 200;
  private readonly QUALITY = 80;

  constructor(dataDir: string = './data') {
    this.thumbsDir = path.join(dataDir, 'thumbs');
    this.ensureThumbsDirectory();
  }

  private ensureThumbsDirectory(): void {
    if (!fs.existsSync(this.thumbsDir)) {
      fs.mkdirSync(this.thumbsDir, { recursive: true });
      logger.info('Created thumbnails directory', { thumbsDir: this.thumbsDir });
    }
  }

  async generateThumbnail(mediaPath: string, eventId: string): Promise<string | null> {
    try {
      if (!mediaPath || !fs.existsSync(mediaPath)) {
        logger.warn('Media file does not exist, skipping thumbnail generation', { mediaPath });
        return null;
      }

      const thumbnailPath = path.join(this.thumbsDir, `${eventId}.jpg`);

      // Check if thumbnail already exists
      if (fs.existsSync(thumbnailPath)) {
        logger.debug('Thumbnail already exists, skipping generation', { 
          eventId, 
          thumbnailPath 
        });
        return thumbnailPath;
      }

      logger.debug('Generating thumbnail', {
        eventId,
        mediaPath,
        thumbnailPath,
        targetSize: `${this.THUMBNAIL_WIDTH}x${this.THUMBNAIL_HEIGHT}`
      });

      const startTime = Date.now();

      // Determine if this is a video file or image file
      const ext = path.extname(mediaPath).toLowerCase();
      
      if (this.isVideoFile(ext)) {
        // For video files, we need to extract a frame first
        // For now, we'll try to handle it as an image and fall back gracefully
        try {
          await this.generateVideoThumbnail(mediaPath, thumbnailPath);
        } catch (error) {
          logger.warn('Video thumbnail generation failed, trying as image', { 
            mediaPath, 
            error: error instanceof Error ? error.message : String(error)
          });
          await this.generateImageThumbnail(mediaPath, thumbnailPath);
        }
      } else {
        // Handle as image file
        await this.generateImageThumbnail(mediaPath, thumbnailPath);
      }

      const duration = Date.now() - startTime;
      const stats = fs.statSync(thumbnailPath);

      logger.debug('Thumbnail generated successfully', {
        eventId,
        duration: `${duration}ms`,
        thumbnailSize: `${stats.size} bytes`,
        thumbnailPath
      });

      return thumbnailPath;
    } catch (error) {
      logger.error('Failed to generate thumbnail', {
        eventId,
        mediaPath,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  private async generateImageThumbnail(inputPath: string, outputPath: string): Promise<void> {
    await sharp(inputPath)
      .resize(this.THUMBNAIL_WIDTH, this.THUMBNAIL_HEIGHT, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ 
        quality: this.QUALITY,
        progressive: true
      })
      .toFile(outputPath);
  }

  private async generateVideoThumbnail(inputPath: string, outputPath: string): Promise<void> {
    // For video files, we'll try to read them as images first
    // This works for some video formats that Sharp can handle
    // In a full implementation, you'd use ffmpeg or similar
    
    try {
      // Try to extract metadata and read as image
      const metadata = await sharp(inputPath).metadata();
      
      if (metadata.width && metadata.height) {
        // Sharp can handle this file
        await this.generateImageThumbnail(inputPath, outputPath);
      } else {
        throw new Error('Cannot extract frame from video file');
      }
    } catch (error) {
      // Fallback: create a placeholder thumbnail
      logger.warn('Cannot extract video frame, creating placeholder', { inputPath });
      await this.createPlaceholderThumbnail(outputPath, 'VIDEO');
    }
  }

  private async createPlaceholderThumbnail(outputPath: string, type: string = 'IMAGE'): Promise<void> {
    // Create a simple colored rectangle as placeholder
    const svg = `
      <svg width="${this.THUMBNAIL_WIDTH}" height="${this.THUMBNAIL_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f0f0f0"/>
        <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="Arial, sans-serif" font-size="14" fill="#666">
          ${type}
        </text>
      </svg>
    `;

    await sharp(Buffer.from(svg))
      .jpeg({ quality: this.QUALITY })
      .toFile(outputPath);
  }

  private isVideoFile(extension: string): boolean {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
    return videoExtensions.includes(extension);
  }

  /**
   * Generate thumbnails for multiple media files in batch
   */
  async generateThumbnailsBatch(mediaItems: Array<{ mediaPath: string; eventId: string }>): Promise<Array<{ eventId: string; thumbnailPath: string | null }>> {
    const results: Array<{ eventId: string; thumbnailPath: string | null }> = [];

    logger.info('Starting batch thumbnail generation', { count: mediaItems.length });

    for (const item of mediaItems) {
      try {
        const thumbnailPath = await this.generateThumbnail(item.mediaPath, item.eventId);
        results.push({ eventId: item.eventId, thumbnailPath });
      } catch (error) {
        logger.error('Batch thumbnail generation failed for item', {
          eventId: item.eventId,
          mediaPath: item.mediaPath,
          error: error instanceof Error ? error.message : String(error)
        });
        results.push({ eventId: item.eventId, thumbnailPath: null });
      }
    }

    const successCount = results.filter(r => r.thumbnailPath !== null).length;
    logger.info('Batch thumbnail generation completed', {
      total: mediaItems.length,
      successful: successCount,
      failed: mediaItems.length - successCount
    });

    return results;
  }

  /**
   * Clean up old thumbnails based on age or count
   */
  async cleanupOldThumbnails(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    try {
      const files = fs.readdirSync(this.thumbsDir);
      const cutoffTime = Date.now() - maxAgeMs;
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.thumbsDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        logger.info('Cleaned up old thumbnails', { 
          deletedCount, 
          maxAgeMs: `${maxAgeMs / (24 * 60 * 60 * 1000)} days` 
        });
      }

      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup old thumbnails:', error);
      return 0;
    }
  }

  /**
   * Get thumbnail statistics
   */
  getStats(): {
    totalThumbnails: number;
    totalSizeBytes: number;
    thumbsDir: string;
  } {
    try {
      const files = fs.readdirSync(this.thumbsDir);
      let totalSize = 0;

      for (const file of files) {
        const filePath = path.join(this.thumbsDir, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
      }

      return {
        totalThumbnails: files.length,
        totalSizeBytes: totalSize,
        thumbsDir: this.thumbsDir
      };
    } catch (error) {
      logger.error('Failed to get thumbnail stats:', error);
      return {
        totalThumbnails: 0,
        totalSizeBytes: 0,
        thumbsDir: this.thumbsDir
      };
    }
  }
}
