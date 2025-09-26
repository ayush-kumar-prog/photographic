/**
 * Video Processing Service
 * Handles immediate video cleanup and similarity checking for storage optimization
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { createLogger } from '../utils/logger';

const logger = createLogger('video-processor');

interface VideoFrame {
  filePath: string;
  timestamp: number;
  hash: string;
  size: number;
}

interface SimilarityResult {
  isDuplicate: boolean;
  similarityScore: number;
  previousFrame?: VideoFrame;
}

export class VideoProcessor {
  private processedFrames = new Map<string, VideoFrame>();
  private readonly SIMILARITY_THRESHOLD = 0.85; // 85% similarity threshold
  private readonly MAX_FRAME_CACHE = 100; // Keep last 100 frames for comparison
  private readonly CLEANUP_DELAY_MS = 30000; // 30 seconds delay before cleanup

  constructor() {
    logger.info('Video Processor initialized');
  }

  /**
   * Process a video file: extract frame info, check similarity, schedule cleanup
   */
  async processVideoFile(filePath: string, ocrText: string): Promise<{
    shouldKeep: boolean;
    similarityResult: SimilarityResult;
    frameInfo: VideoFrame;
  }> {
    try {
      logger.debug('Processing video file', { filePath });

      // Get file stats and create frame info
      const stats = await fs.stat(filePath);
      const frameInfo: VideoFrame = {
        filePath,
        timestamp: stats.mtime.getTime(),
        hash: await this.generateContentHash(filePath, ocrText),
        size: stats.size
      };

      // Check similarity with recent frames
      const similarityResult = await this.checkSimilarity(frameInfo, ocrText);

      // Decide whether to keep the frame
      const shouldKeep = !similarityResult.isDuplicate;

      if (shouldKeep) {
        // Add to processed frames cache
        this.addToFrameCache(frameInfo);
        logger.debug('Frame marked for keeping', { 
          filePath, 
          hash: frameInfo.hash.substring(0, 8),
          size: frameInfo.size 
        });
      } else {
        logger.debug('Frame marked as duplicate', { 
          filePath, 
          similarityScore: similarityResult.similarityScore,
          previousFrame: similarityResult.previousFrame?.filePath 
        });
      }

      // Schedule cleanup regardless (we'll keep the OCR data, just remove video)
      this.scheduleVideoCleanup(filePath, shouldKeep ? 'processed' : 'duplicate');

      return { shouldKeep, similarityResult, frameInfo };

    } catch (error: any) {
      logger.error('Error processing video file', { filePath, error: error.message });
      throw error;
    }
  }

  /**
   * Generate a content hash based on file size, OCR text, and basic file info
   * This is a lightweight alternative to actual image similarity
   */
  private async generateContentHash(filePath: string, ocrText: string): Promise<string> {
    try {
      const stats = await fs.stat(filePath);
      const fileName = path.basename(filePath);
      
      // Create hash from file size, OCR text (first 500 chars), and filename pattern
      const contentString = [
        stats.size.toString(),
        ocrText.substring(0, 500).trim(),
        fileName.replace(/\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}/, 'TIMESTAMP'), // Normalize timestamp
      ].join('|');

      return crypto.createHash('sha256').update(contentString).digest('hex');
    } catch (error: any) {
      logger.error('Error generating content hash', { filePath, error: error.message });
      throw error;
    }
  }

  /**
   * Check similarity with recently processed frames
   */
  private async checkSimilarity(frameInfo: VideoFrame, ocrText: string): Promise<SimilarityResult> {
    const recentFrames = Array.from(this.processedFrames.values())
      .filter(frame => frameInfo.timestamp - frame.timestamp < 60000) // Within last minute
      .sort((a, b) => b.timestamp - a.timestamp) // Most recent first
      .slice(0, 10); // Check against last 10 frames

    for (const previousFrame of recentFrames) {
      const similarity = this.calculateSimilarity(frameInfo, previousFrame, ocrText);
      
      if (similarity >= this.SIMILARITY_THRESHOLD) {
        return {
          isDuplicate: true,
          similarityScore: similarity,
          previousFrame
        };
      }
    }

    return {
      isDuplicate: false,
      similarityScore: 0
    };
  }

  /**
   * Calculate similarity between two frames
   * Uses hash comparison and file size as lightweight similarity metrics
   */
  private calculateSimilarity(frame1: VideoFrame, frame2: VideoFrame, ocrText: string): number {
    // Exact hash match = 100% similarity
    if (frame1.hash === frame2.hash) {
      return 1.0;
    }

    // File size similarity (within 10% = high similarity)
    const sizeDiff = Math.abs(frame1.size - frame2.size) / Math.max(frame1.size, frame2.size);
    const sizeSimilarity = Math.max(0, 1 - sizeDiff * 2); // Size difference penalty

    // Time proximity bonus (closer in time = more likely to be similar)
    const timeDiff = Math.abs(frame1.timestamp - frame2.timestamp);
    const timeBonus = timeDiff < 10000 ? 0.2 : 0; // 10 second bonus

    // Hash prefix similarity (first 8 chars)
    const hashSimilarity = frame1.hash.substring(0, 8) === frame2.hash.substring(0, 8) ? 0.3 : 0;

    return Math.min(1.0, sizeSimilarity + timeBonus + hashSimilarity);
  }

  /**
   * Add frame to cache, maintaining size limit
   */
  private addToFrameCache(frameInfo: VideoFrame): void {
    this.processedFrames.set(frameInfo.hash, frameInfo);

    // Maintain cache size limit
    if (this.processedFrames.size > this.MAX_FRAME_CACHE) {
      const oldestHash = Array.from(this.processedFrames.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0][0];
      this.processedFrames.delete(oldestHash);
    }
  }

  /**
   * Schedule video file cleanup after processing delay
   * DISABLED: We need to keep video files for screenshot extraction
   */
  private scheduleVideoCleanup(filePath: string, reason: 'processed' | 'duplicate'): void {
    // DISABLED: Auto-cleanup is preventing screenshot extraction
    // Videos are needed for the screenshot pipeline
    logger.info('Video cleanup DISABLED - keeping file for screenshot extraction', { 
      filePath, 
      reason,
      note: 'Videos needed for photographic memory feature'
    });
    
    // Original cleanup code commented out:
    // setTimeout(async () => {
    //   try {
    //     await this.cleanupVideoFile(filePath, reason);
    //   } catch (error: any) {
    //     logger.error('Error during scheduled cleanup', { filePath, reason, error: error.message });
    //   }
    // }, this.CLEANUP_DELAY_MS);
  }

  /**
   * Actually delete the video file
   */
  private async cleanupVideoFile(filePath: string, reason: string): Promise<void> {
    try {
      // Check if file still exists
      await fs.access(filePath);
      
      // Get file size for logging
      const stats = await fs.stat(filePath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      
      // Delete the file
      await fs.unlink(filePath);
      
      logger.info('Video file cleaned up', { 
        filePath: path.basename(filePath), 
        reason, 
        sizeMB: `${sizeMB}MB`,
        savedSpace: `${sizeMB}MB` 
      });
      
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        logger.debug('Video file already deleted', { filePath });
      } else {
        logger.error('Failed to cleanup video file', { filePath, reason, error: error.message });
      }
    }
  }

  /**
   * Get processing statistics
   */
  getStats(): {
    processedFrames: number;
    cacheSize: number;
    estimatedSavedSpace: string;
  } {
    const totalSize = Array.from(this.processedFrames.values())
      .reduce((sum, frame) => sum + frame.size, 0);
    
    return {
      processedFrames: this.processedFrames.size,
      cacheSize: this.processedFrames.size,
      estimatedSavedSpace: `${(totalSize / (1024 * 1024)).toFixed(2)}MB`
    };
  }

  /**
   * Clear the frame cache (useful for testing)
   */
  clearCache(): void {
    this.processedFrames.clear();
    logger.info('Frame cache cleared');
  }
}
