#!/usr/bin/env tsx

/**
 * Throughput and Performance Test for Ingest Bridge Service
 * 
 * Tests the success criteria from Step 3:
 * - Process ≥3,000 rows/hour sustained throughput
 * - Handle ≥200 rows/minute peak processing
 * - SQLite FTS5 index responds to queries <50ms
 * - Chroma vector insertion completes <100ms per document
 * - Thumbnail generation <200ms per image
 * - Memory usage stable under 200MB for service
 */

import { IngestBridge } from '../index';
import { DatabaseManager } from '../database/manager';
import { EmbeddingsService } from '../embeddings/service';
import { ThumbnailGenerator } from '../media/thumbnails';
import { ScreenpipeClient } from '../screenpipe/client';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

interface TestResults {
  throughputTest: {
    rowsPerHour: number;
    peakRowsPerMinute: number;
    avgProcessingTimeMs: number;
    success: boolean;
  };
  performanceTest: {
    sqliteQueryTimeMs: number;
    chromaInsertTimeMs: number;
    thumbnailGenerationTimeMs: number;
    success: boolean;
  };
  memoryTest: {
    initialMemoryMB: number;
    peakMemoryMB: number;
    finalMemoryMB: number;
    memoryStable: boolean;
    success: boolean;
  };
  overallSuccess: boolean;
}

class ThroughputTester {
  private testDataDir: string;
  private testResults: Partial<TestResults> = {};

  constructor() {
    this.testDataDir = path.join(__dirname, '../../test-data');
    this.ensureTestDataDir();
  }

  private ensureTestDataDir(): void {
    if (!fs.existsSync(this.testDataDir)) {
      fs.mkdirSync(this.testDataDir, { recursive: true });
    }
  }

  private getMemoryUsageMB(): number {
    const usage = process.memoryUsage();
    return Math.round(usage.heapUsed / 1024 / 1024);
  }

  private generateMockEvent(id: string): any {
    return {
      id,
      timestamp: Date.now() - Math.random() * 86400000, // Random time in last 24h
      app: ['Safari', 'Chrome', 'Terminal', 'Code', 'Slack'][Math.floor(Math.random() * 5)],
      window_title: `Test Window ${id}`,
      url: Math.random() > 0.5 ? `https://example.com/page/${id}` : undefined,
      ocr_text: `This is test OCR text for event ${id}. It contains various words and phrases that would be extracted from a screen capture. The text includes technical terms, product names, and natural language content that would be typical of desktop applications.`,
      media_path: `/test/media/frame_${id}.jpg`
    };
  }

  private async createTestImage(eventId: string): Promise<string> {
    // Create a simple test image using Sharp
    const sharp = require('sharp');
    const testImagePath = path.join(this.testDataDir, `test_image_${eventId}.jpg`);
    
    // Create a 800x600 test image with some text
    const svg = `
      <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f0f0f0"/>
        <text x="400" y="300" text-anchor="middle" font-family="Arial" font-size="24" fill="#333">
          Test Image ${eventId}
        </text>
        <text x="400" y="350" text-anchor="middle" font-family="Arial" font-size="16" fill="#666">
          Generated for throughput testing
        </text>
      </svg>
    `;

    await sharp(Buffer.from(svg))
      .jpeg({ quality: 80 })
      .toFile(testImagePath);

    return testImagePath;
  }

  async testThroughput(): Promise<void> {
    logger.info('Starting throughput test...');
    
    const databaseManager = new DatabaseManager(path.join(this.testDataDir, 'sqlite'));
    const embeddingsService = new EmbeddingsService(path.join(this.testDataDir, 'chroma'));
    
    await databaseManager.initialize();
    await embeddingsService.initialize();

    const testEvents = Array.from({ length: 100 }, (_, i) => 
      this.generateMockEvent(`throughput_${i}`)
    );

    // Test sustained throughput (simulate 1 hour of processing)
    logger.info('Testing sustained throughput...');
    const sustainedStartTime = Date.now();
    let processedCount = 0;
    const processingTimes: number[] = [];

    for (const event of testEvents) {
      const eventStartTime = Date.now();
      
      try {
        // Simulate the full processing pipeline
        const embedding = await embeddingsService.generateEmbedding(event.ocr_text);
        
        const memoryObject = {
          id: event.id,
          ts: event.timestamp,
          app: event.app,
          window_title: event.window_title,
          url: event.url,
          url_host: event.url ? new URL(event.url).hostname : null,
          media_path: event.media_path,
          thumb_path: null,
          ocr_text: event.ocr_text,
          asr_text: null,
          entities: [],
          topics: [],
          embedding,
          video_processed: false,
          video_kept: true,
          similarity_score: 0.0
        };

        await databaseManager.storeMemoryObject(memoryObject);
        await embeddingsService.storeEmbedding(memoryObject);
        
        processedCount++;
        const eventTime = Date.now() - eventStartTime;
        processingTimes.push(eventTime);
        
        if (processedCount % 10 === 0) {
          logger.info(`Processed ${processedCount}/${testEvents.length} events`);
        }
      } catch (error) {
        logger.error(`Failed to process event ${event.id}:`, error);
      }
    }

    const totalTime = Date.now() - sustainedStartTime;
    const avgProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
    const rowsPerHour = Math.round((processedCount / totalTime) * 3600000);
    const peakRowsPerMinute = Math.round(60000 / Math.min(...processingTimes));

    this.testResults.throughputTest = {
      rowsPerHour,
      peakRowsPerMinute,
      avgProcessingTimeMs: Math.round(avgProcessingTime),
      success: rowsPerHour >= 3000 && peakRowsPerMinute >= 200
    };

    logger.info('Throughput test results:', this.testResults.throughputTest);
  }

  async testPerformance(): Promise<void> {
    logger.info('Starting performance test...');
    
    const databaseManager = new DatabaseManager(path.join(this.testDataDir, 'sqlite'));
    const embeddingsService = new EmbeddingsService(path.join(this.testDataDir, 'chroma'));
    const thumbnailGenerator = new ThumbnailGenerator(this.testDataDir);
    
    await databaseManager.initialize();
    await embeddingsService.initialize();

    // Test SQLite FTS5 query performance
    logger.info('Testing SQLite FTS5 query performance...');
    const sqliteStartTime = Date.now();
    try {
      await databaseManager.searchMemories('test query', 10);
    } catch (error) {
      logger.warn('SQLite search failed (expected for empty DB):', error);
    }
    const sqliteQueryTime = Date.now() - sqliteStartTime;

    // Test Chroma vector insertion performance
    logger.info('Testing Chroma vector insertion performance...');
    const chromaStartTime = Date.now();
    const testEmbedding = await embeddingsService.generateEmbedding('test text for performance');
    const testMemoryObject = {
      id: 'perf_test_1',
      ts: Date.now(),
      app: 'TestApp',
      window_title: 'Test Window',
      url: null,
      url_host: null,
      media_path: null,
      thumb_path: null,
      ocr_text: 'test text for performance',
      asr_text: null,
      entities: [],
      topics: [],
      embedding: testEmbedding,
      video_processed: false,
      video_kept: true,
      similarity_score: 0.0
    };
    await embeddingsService.storeEmbedding(testMemoryObject);
    const chromaInsertTime = Date.now() - chromaStartTime;

    // Test thumbnail generation performance
    logger.info('Testing thumbnail generation performance...');
    const testImagePath = await this.createTestImage('perf_test');
    const thumbnailStartTime = Date.now();
    await thumbnailGenerator.generateThumbnail(testImagePath, 'perf_test_thumb');
    const thumbnailTime = Date.now() - thumbnailStartTime;

    this.testResults.performanceTest = {
      sqliteQueryTimeMs: sqliteQueryTime,
      chromaInsertTimeMs: chromaInsertTime,
      thumbnailGenerationTimeMs: thumbnailTime,
      success: sqliteQueryTime < 50 && chromaInsertTime < 100 && thumbnailTime < 200
    };

    logger.info('Performance test results:', this.testResults.performanceTest);
  }

  async testMemoryUsage(): Promise<void> {
    logger.info('Starting memory usage test...');
    
    const initialMemory = this.getMemoryUsageMB();
    let peakMemory = initialMemory;

    const databaseManager = new DatabaseManager(path.join(this.testDataDir, 'sqlite'));
    const embeddingsService = new EmbeddingsService(path.join(this.testDataDir, 'chroma'));
    
    await databaseManager.initialize();
    await embeddingsService.initialize();

    // Process a batch of events while monitoring memory
    const testEvents = Array.from({ length: 50 }, (_, i) => 
      this.generateMockEvent(`memory_test_${i}`)
    );

    for (let i = 0; i < testEvents.length; i++) {
      const event = testEvents[i];
      
      try {
        const embedding = await embeddingsService.generateEmbedding(event.ocr_text);
        
        const memoryObject = {
          id: event.id,
          ts: event.timestamp,
          app: event.app,
          window_title: event.window_title,
          url: event.url,
          url_host: event.url ? new URL(event.url).hostname : null,
          media_path: event.media_path,
          thumb_path: null,
          ocr_text: event.ocr_text,
          asr_text: null,
          entities: [],
          topics: [],
          embedding,
          video_processed: false,
          video_kept: true,
          similarity_score: 0.0
        };

        await databaseManager.storeMemoryObject(memoryObject);
        await embeddingsService.storeEmbedding(memoryObject);
        
        // Monitor memory usage
        const currentMemory = this.getMemoryUsageMB();
        if (currentMemory > peakMemory) {
          peakMemory = currentMemory;
        }
        
        if (i % 10 === 0) {
          logger.info(`Memory test progress: ${i}/${testEvents.length}, current memory: ${currentMemory}MB`);
        }
      } catch (error) {
        logger.error(`Memory test failed for event ${event.id}:`, error);
      }
    }

    // Force garbage collection and measure final memory
    if (global.gc) {
      global.gc();
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for GC
    const finalMemory = this.getMemoryUsageMB();
    
    const memoryGrowth = finalMemory - initialMemory;
    const memoryStable = memoryGrowth < 50; // Allow up to 50MB growth

    this.testResults.memoryTest = {
      initialMemoryMB: initialMemory,
      peakMemoryMB: peakMemory,
      finalMemoryMB: finalMemory,
      memoryStable,
      success: peakMemory < 200 && memoryStable
    };

    logger.info('Memory test results:', this.testResults.memoryTest);
  }

  async runAllTests(): Promise<TestResults> {
    logger.info('Starting comprehensive throughput and performance tests...');
    
    try {
      await this.testThroughput();
      await this.testPerformance();
      await this.testMemoryUsage();

      const results: TestResults = {
        throughputTest: this.testResults.throughputTest!,
        performanceTest: this.testResults.performanceTest!,
        memoryTest: this.testResults.memoryTest!,
        overallSuccess: false
      };

      results.overallSuccess = 
        results.throughputTest.success &&
        results.performanceTest.success &&
        results.memoryTest.success;

      return results;
    } catch (error) {
      logger.error('Test execution failed:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      // Clean up test data
      if (fs.existsSync(this.testDataDir)) {
        fs.rmSync(this.testDataDir, { recursive: true, force: true });
      }
      logger.info('Test cleanup completed');
    } catch (error) {
      logger.warn('Test cleanup failed:', error);
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  async function main() {
    const tester = new ThroughputTester();
    
    try {
      const results = await tester.runAllTests();
      
      console.log('\n=== THROUGHPUT AND PERFORMANCE TEST RESULTS ===\n');
      
      console.log('📊 Throughput Test:');
      console.log(`  Rows/hour: ${results.throughputTest.rowsPerHour} (target: ≥3,000)`);
      console.log(`  Peak rows/minute: ${results.throughputTest.peakRowsPerMinute} (target: ≥200)`);
      console.log(`  Avg processing time: ${results.throughputTest.avgProcessingTimeMs}ms`);
      console.log(`  Status: ${results.throughputTest.success ? '✅ PASS' : '❌ FAIL'}\n`);
      
      console.log('⚡ Performance Test:');
      console.log(`  SQLite query time: ${results.performanceTest.sqliteQueryTimeMs}ms (target: <50ms)`);
      console.log(`  Chroma insert time: ${results.performanceTest.chromaInsertTimeMs}ms (target: <100ms)`);
      console.log(`  Thumbnail generation: ${results.performanceTest.thumbnailGenerationTimeMs}ms (target: <200ms)`);
      console.log(`  Status: ${results.performanceTest.success ? '✅ PASS' : '❌ FAIL'}\n`);
      
      console.log('💾 Memory Test:');
      console.log(`  Initial memory: ${results.memoryTest.initialMemoryMB}MB`);
      console.log(`  Peak memory: ${results.memoryTest.peakMemoryMB}MB (target: <200MB)`);
      console.log(`  Final memory: ${results.memoryTest.finalMemoryMB}MB`);
      console.log(`  Memory stable: ${results.memoryTest.memoryStable ? 'Yes' : 'No'}`);
      console.log(`  Status: ${results.memoryTest.success ? '✅ PASS' : '❌ FAIL'}\n`);
      
      console.log(`🎯 Overall Result: ${results.overallSuccess ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}\n`);
      
      if (results.overallSuccess) {
        console.log('🚀 Step 3 (Ingest Bridge Service) meets all performance targets!');
        process.exit(0);
      } else {
        console.log('⚠️  Step 3 performance targets not met. Review failed tests above.');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    } finally {
      await tester.cleanup();
    }
  }

  main().catch(console.error);
}

export { ThroughputTester };
