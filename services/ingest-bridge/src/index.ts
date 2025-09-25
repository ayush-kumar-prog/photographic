/**
 * Ingest Bridge Service
 * Normalizes Screenpipe events → SQLite + Chroma vectors
 */

import { logger } from './utils/logger';
import { ScreenpipeClient } from './screenpipe/client';
import { DatabaseManager } from './database/manager';
import { EmbeddingsService } from './embeddings/service';
import { ThumbnailGenerator } from './media/thumbnails';
import { VideoProcessor } from './media/video-processor';

class IngestBridge {
  private screenpipeClient: ScreenpipeClient;
  private databaseManager: DatabaseManager;
  private embeddingsService: EmbeddingsService;
  private thumbnailGenerator: ThumbnailGenerator;
  private videoProcessor: VideoProcessor;
  private isRunning = false;

  constructor() {
    this.screenpipeClient = new ScreenpipeClient();
    this.databaseManager = new DatabaseManager();
    this.embeddingsService = new EmbeddingsService();
    this.thumbnailGenerator = new ThumbnailGenerator();
    this.videoProcessor = new VideoProcessor();
  }

  async start() {
    logger.info('Starting Ingest Bridge Service...');
    
    try {
      await this.databaseManager.initialize();
      await this.embeddingsService.initialize();
      
      this.isRunning = true;
      this.startPolling();
      
      logger.info('Ingest Bridge Service started successfully');
    } catch (error) {
      logger.error('Failed to start Ingest Bridge Service:', error);
      throw error;
    }
  }

  async stop() {
    logger.info('Stopping Ingest Bridge Service...');
    this.isRunning = false;
  }

  private async startPolling() {
    while (this.isRunning) {
      try {
        // Poll Screenpipe for new events (placeholder)
        await this.processNewEvents();
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second interval
      } catch (error) {
        logger.error('Error in polling cycle:', error);
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait longer on error
      }
    }
  }

  private async processNewEvents() {
    try {
      logger.debug('Fetching new events from Screenpipe...');
      
      // Check if Screenpipe is healthy
      try {
        const health = await this.screenpipeClient.healthCheck();
        // Accept both "healthy" and "degraded" status if frame capture is working
        const isFrameCaptureWorking = health.frame_status === 'ok';
        const isAcceptableStatus = health.status === 'healthy' || (health.status === 'degraded' && isFrameCaptureWorking);
        
        if (!isAcceptableStatus) {
          logger.warn('Screenpipe is not healthy', { 
            status: health.status, 
            frame_status: health.frame_status 
          });
          return;
        }
      } catch (error) {
        logger.warn('Failed to check Screenpipe health, skipping this cycle');
        return;
      }

      // Fetch latest events from Screenpipe
      const events = await this.screenpipeClient.getRecentEvents(undefined, 100); // INCREASED TO 100 TO SEE MORE
      
      if (events.length === 0) {
        logger.debug('No new events found');
        return;
      }

      // DEBUG: Log all apps received from Screenpipe
      const appCounts = events.reduce((acc, e) => {
        acc[e.app] = (acc[e.app] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      logger.info('🔍 INCOMING APPS FROM SCREENPIPE:', {
        totalEvents: events.length,
        uniqueApps: Object.keys(appCounts).length,
        appBreakdown: appCounts
      });

      logger.info(`Processing ${events.length} new events`);

      // Track processing results
      const processingResults: Record<string, { success: number; failed: number; skipped: number }> = {};

      for (const event of events) {
        try {
          // Initialize tracking for this app
          if (!processingResults[event.app]) {
            processingResults[event.app] = { success: 0, failed: 0, skipped: 0 };
          }

          // 1. Validate event data
          if (!this.validateEvent(event)) {
            logger.warn('❌ VALIDATION FAILED', { 
              eventId: event.id,
              app: event.app,
              hasId: !!event.id,
              hasTimestamp: !!event.timestamp,
              hasApp: !!event.app,
              hasOcrText: !!event.ocr_text,
              ocrTextLength: event.ocr_text?.length || 0
            });
            processingResults[event.app].failed++;
            continue;
          }

          // 2. Check if we've already processed this event
          const exists = await this.databaseManager.eventExists(event.id);
          if (exists) {
            logger.debug('⏭️ Event already processed', { 
              eventId: event.id,
              app: event.app 
            });
            processingResults[event.app].skipped++;
            continue;
          }

          logger.debug('✅ Event passed validation', {
            eventId: event.id,
            app: event.app,
            windowTitle: event.window_title?.substring(0, 50)
          });

          // 3. Process video file for similarity checking and cleanup scheduling
          let shouldKeepVideo = true;
          let videoProcessingInfo = null;
          if (event.media_path) {
            try {
              const videoResult = await this.videoProcessor.processVideoFile(
                event.media_path, 
                event.ocr_text
              );
              shouldKeepVideo = videoResult.shouldKeep;
              videoProcessingInfo = videoResult;
              
              logger.debug('Video processing result', {
                eventId: event.id,
                shouldKeep: shouldKeepVideo,
                similarityScore: videoResult.similarityResult.similarityScore,
                isDuplicate: videoResult.similarityResult.isDuplicate
              });
            } catch (error) {
              logger.warn('Video processing failed, continuing without video data', {
                eventId: event.id,
                mediaPath: event.media_path,
                error: error instanceof Error ? error.message : String(error)
              });
              // Continue processing the event without video data
              shouldKeepVideo = false;
              videoProcessingInfo = null;
            }
          }

          // 4. Create memory object
          const memoryObject = this.transformToMemoryObject(event);

          // 5. Generate embeddings (always generate for OCR text)
          const embeddings = await this.embeddingsService.generateEmbedding(event.ocr_text);
          
          // 6. Generate thumbnail if media exists and we're keeping the video
          let thumbnailPath;
          if (event.media_path && shouldKeepVideo) {
            thumbnailPath = await this.thumbnailGenerator.generateThumbnail(
              event.media_path,
              event.id
            );
          }

          // 7. Create complete memory object with embedding
          const completeMemoryObject = {
            ...memoryObject,
            thumb_path: thumbnailPath,
            embedding: embeddings,
            // Add metadata about video processing
            video_processed: !!videoProcessingInfo,
            video_kept: shouldKeepVideo,
            similarity_score: videoProcessingInfo?.similarityResult.similarityScore || 0
          };

          // 8. Store in SQLite database
          const dbStored = await this.databaseManager.storeMemoryObject(completeMemoryObject);
          logger.debug('📝 Database storage attempt', {
            eventId: event.id,
            app: event.app,
            stored: dbStored
          });

          // 9. Store embedding in Chroma vector database
          await this.embeddingsService.storeEmbedding(completeMemoryObject);

          logger.info('✅ SUCCESSFULLY PROCESSED EVENT', { 
            eventId: event.id, 
            app: event.app,
            textLength: event.ocr_text.length,
            videoKept: shouldKeepVideo,
            hasThumbnail: !!thumbnailPath
          });
          
          processingResults[event.app].success++;
        } catch (error: any) {
          logger.error('❌ FAILED TO PROCESS EVENT', { 
            eventId: event.id,
            app: event.app,
            error: error.message,
            errorStack: error.stack
          });
          processingResults[event.app].failed++;
        }
      }
      
      // Log processing summary
      logger.info('📊 PROCESSING SUMMARY:', {
        totalEvents: events.length,
        processingResults,
        successTotal: Object.values(processingResults).reduce((sum, r) => sum + r.success, 0),
        failedTotal: Object.values(processingResults).reduce((sum, r) => sum + r.failed, 0),
        skippedTotal: Object.values(processingResults).reduce((sum, r) => sum + r.skipped, 0)
      });
    } catch (error) {
      logger.error('Error in processNewEvents:', error);
    }
  }

  private validateEvent(event: any): boolean {
    return (
      event &&
      typeof event.id === 'string' &&
      typeof event.timestamp === 'number' &&
      typeof event.app === 'string' &&
      typeof event.ocr_text === 'string'
      // Removed requirement for non-empty OCR text - some events have minimal text but are still valid
    );
  }

  private transformToMemoryObject(event: any): any {
    return {
      id: event.id,
      ts: event.timestamp,
      app: event.app,
      window_title: event.window_title || null,
      url: event.url || null,
      url_host: event.url ? new URL(event.url).hostname : null,
      media_path: event.media_path || null,
      ocr_text: event.ocr_text,
      asr_text: null, // Audio transcription not implemented yet
      entities: [],
      topics: [],
    };
  }

  /**
   * Get comprehensive processing statistics
   */
  async getProcessingStats(): Promise<{
    isRunning: boolean;
    database: any;
    embeddings: any;
    thumbnails: any;
    videoProcessing: any;
    queue: any;
  }> {
    try {
      const [dbStats, embeddingStats, thumbnailStats] = await Promise.all([
        this.databaseManager.getStats(),
        this.embeddingsService.getCollectionStats(),
        Promise.resolve(this.thumbnailGenerator.getStats())
      ]);

      return {
        isRunning: this.isRunning,
        database: dbStats,
        embeddings: embeddingStats,
        thumbnails: thumbnailStats,
        videoProcessing: this.videoProcessor.getStats(),
        queue: this.embeddingsService.getQueueStats()
      };
    } catch (error) {
      logger.error('Failed to get processing stats:', error);
      return {
        isRunning: this.isRunning,
        database: { error: 'Failed to get database stats' },
        embeddings: { error: 'Failed to get embedding stats' },
        thumbnails: { error: 'Failed to get thumbnail stats' },
        videoProcessing: this.videoProcessor.getStats(),
        queue: { error: 'Failed to get queue stats' }
      };
    }
  }

  /**
   * Health check for all components
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    components: {
      database: boolean;
      embeddings: boolean;
      screenpipe: boolean;
    };
    errors: string[];
  }> {
    const errors: string[] = [];
    const components = {
      database: false,
      embeddings: false,
      screenpipe: false
    };

    // Check database
    try {
      components.database = this.databaseManager.isReady();
      if (!components.database) {
        errors.push('Database not ready');
      }
    } catch (error) {
      errors.push(`Database error: ${error}`);
    }

    // Check embeddings service
    try {
      components.embeddings = this.embeddingsService.isReady();
      if (!components.embeddings) {
        errors.push('Embeddings service not ready');
      }
    } catch (error) {
      errors.push(`Embeddings error: ${error}`);
    }

    // Check Screenpipe
    try {
      const health = await this.screenpipeClient.healthCheck();
      components.screenpipe = health.status === 'healthy';
      if (!components.screenpipe) {
        errors.push(`Screenpipe unhealthy: ${health.status}`);
      }
    } catch (error) {
      errors.push(`Screenpipe error: ${error}`);
    }

    const healthy = Object.values(components).every(c => c);

    return {
      healthy,
      components,
      errors
    };
  }
}

// Start the service if this file is run directly
if (require.main === module) {
  const service = new IngestBridge();
  
  process.on('SIGINT', async () => {
    await service.stop();
    process.exit(0);
  });
  
  service.start().catch(error => {
    logger.error('Service startup failed:', error);
    process.exit(1);
  });
}

export { IngestBridge };
