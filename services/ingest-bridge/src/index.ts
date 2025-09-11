/**
 * Ingest Bridge Service
 * Normalizes Screenpipe events → SQLite + Chroma vectors
 */

import { logger } from './utils/logger';
import { ScreenpipeClient } from './screenpipe/client';
import { DatabaseManager } from './database/manager';
import { EmbeddingsService } from './embeddings/service';
import { ThumbnailGenerator } from './media/thumbnails';

class IngestBridge {
  private screenpipeClient: ScreenpipeClient;
  private databaseManager: DatabaseManager;
  private embeddingsService: EmbeddingsService;
  private thumbnailGenerator: ThumbnailGenerator;
  private isRunning = false;

  constructor() {
    this.screenpipeClient = new ScreenpipeClient();
    this.databaseManager = new DatabaseManager();
    this.embeddingsService = new EmbeddingsService();
    this.thumbnailGenerator = new ThumbnailGenerator();
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
    // Implementation placeholder
    // 1. Fetch new events from Screenpipe
    // 2. Generate embeddings
    // 3. Create thumbnails
    // 4. Store in SQLite + Chroma
    logger.debug('Processing new events...');
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
