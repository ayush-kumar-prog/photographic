#!/usr/bin/env tsx
/**
 * Screenpipe Client Test Script
 * 
 * This script tests the Screenpipe client connection and basic functionality.
 * Use this to debug and verify that Screenpipe is working correctly.
 * 
 * Usage:
 *   pnpm tsx src/screenpipe/test-client.ts
 * 
 * Debug Environment Variables:
 *   DEBUG=screenpipe:* - Enable detailed logging
 *   SCREENPIPE_URL=http://localhost:3030 - Override default URL
 */

import { createScreenpipeClient, ScreenpipeClient } from './client';
import { createLogger } from '../utils/logger';

const logger = createLogger('screenpipe-test');

interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  details?: any;
  error?: string;
}

class ScreenpipeClientTester {
  private client: ScreenpipeClient | null = null;
  private results: TestResult[] = [];

  async runTest(name: string, testFn: () => Promise<any>): Promise<TestResult> {
    logger.info(`🧪 Running test: ${name}`);
    const startTime = Date.now();
    
    try {
      const result = await testFn();
      const duration = Date.now() - startTime;
      
      const testResult: TestResult = {
        name,
        success: true,
        duration,
        details: result
      };
      
      logger.info(`✅ ${name} - PASSED (${duration}ms)`);
      this.results.push(testResult);
      return testResult;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      const testResult: TestResult = {
        name,
        success: false,
        duration,
        error: error instanceof Error ? error.message : String(error)
      };
      
      logger.error(`❌ ${name} - FAILED (${duration}ms): ${testResult.error}`);
      this.results.push(testResult);
      return testResult;
    }
  }

  async testClientCreation(): Promise<any> {
    const baseUrl = process.env.SCREENPIPE_URL || 'http://localhost:3030';
    logger.info(`Testing client creation with URL: ${baseUrl}`);
    
    this.client = await createScreenpipeClient(baseUrl);
    
    return {
      baseUrl,
      clientCreated: !!this.client
    };
  }

  async testHealthCheck(): Promise<any> {
    if (!this.client) throw new Error('Client not created');
    
    const health = await this.client.healthCheck();
    
    return {
      status: health.status,
      frameStatus: health.frame_status,
      audioStatus: health.audio_status,
      dbHealth: health.db_health,
      lastFrameTimestamp: health.last_frame_timestamp ? 
        new Date(health.last_frame_timestamp).toISOString() : null
    };
  }

  async testBasicSearch(): Promise<any> {
    if (!this.client) throw new Error('Client not created');
    
    const result = await this.client.search({
      limit: 5,
      content_type: 'ocr'
    });
    
    return {
      resultCount: result.data.length,
      totalAvailable: result.pagination.total,
      sampleResults: result.data.slice(0, 2).map(item => ({
        timestamp: item.timestamp,
        app: item.app_name,
        window: item.window_name,
        ocrLength: item.ocr_text?.length || 0,
        hasFrameId: !!item.frame_id
      }))
    };
  }

  async testRecentEvents(): Promise<any> {
    if (!this.client) throw new Error('Client not created');
    
    // Get events from the last 5 minutes
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const events = await this.client.getRecentEvents(fiveMinutesAgo, 10);
    
    return {
      eventCount: events.length,
      timeRange: events.length > 0 ? {
        oldest: new Date(Math.min(...events.map(e => e.timestamp))).toISOString(),
        newest: new Date(Math.max(...events.map(e => e.timestamp))).toISOString()
      } : null,
      sampleEvents: events.slice(0, 3).map(event => ({
        id: event.id,
        timestamp: new Date(event.timestamp).toISOString(),
        app: event.app,
        window: event.window_title,
        ocrLength: event.ocr_text.length,
        hasMedia: !!event.media_path
      }))
    };
  }

  async testFrameRetrieval(): Promise<any> {
    if (!this.client) throw new Error('Client not created');
    
    // First get a recent event with a frame
    const events = await this.client.getRecentEvents(Date.now() - (10 * 60 * 1000), 20);
    const eventWithFrame = events.find(e => e.frame_id);
    
    if (!eventWithFrame?.frame_id) {
      return {
        skipped: true,
        reason: 'No recent events with frame IDs found'
      };
    }
    
    const frameData = await this.client.getFrameData(eventWithFrame.frame_id);
    
    return {
      frameId: eventWithFrame.frame_id,
      frameSize: frameData.length,
      eventTimestamp: new Date(eventWithFrame.timestamp).toISOString()
    };
  }

  async testPolling(): Promise<any> {
    if (!this.client) throw new Error('Client not created');
    
    logger.info('Testing polling for 10 seconds...');
    
    const events: any[] = [];
    const startTime = Date.now();
    const testDuration = 10000; // 10 seconds
    
    const pollIterator = this.client.pollEvents(2000); // Poll every 2 seconds
    
    // Create a timeout promise
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(resolve, testDuration);
    });
    
    // Race between polling and timeout
    const pollingPromise = (async () => {
      for await (const batch of pollIterator) {
        events.push(...batch);
        logger.debug(`Polling test - received ${batch.length} events`);
        
        if (Date.now() - startTime >= testDuration) {
          break;
        }
      }
    })();
    
    await Promise.race([pollingPromise, timeoutPromise]);
    
    return {
      duration: Date.now() - startTime,
      totalEventsReceived: events.length,
      averageEventsPerPoll: events.length / Math.ceil(testDuration / 2000)
    };
  }

  printSummary(): void {
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const totalTime = this.results.reduce((sum, r) => sum + r.duration, 0);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 SCREENPIPE CLIENT TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️  Total Time: ${totalTime}ms`);
    console.log('');
    
    if (failed > 0) {
      console.log('❌ FAILED TESTS:');
      this.results.filter(r => !r.success).forEach(result => {
        console.log(`   • ${result.name}: ${result.error}`);
      });
      console.log('');
    }
    
    console.log('📋 DETAILED RESULTS:');
    this.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`   ${status} ${result.name} (${result.duration}ms)`);
      
      if (result.success && result.details) {
        const details = JSON.stringify(result.details, null, 2)
          .split('\n')
          .map(line => `      ${line}`)
          .join('\n');
        console.log(details);
      }
    });
    
    console.log('='.repeat(60));
    
    if (failed === 0) {
      console.log('🎉 All tests passed! Screenpipe client is working correctly.');
    } else {
      console.log('⚠️  Some tests failed. Check Screenpipe server status and configuration.');
      process.exit(1);
    }
  }
}

async function main() {
  console.log('🚀 Starting Screenpipe Client Tests...\n');
  
  const tester = new ScreenpipeClientTester();
  
  // Run all tests in sequence
  await tester.runTest('Client Creation', () => tester.testClientCreation());
  await tester.runTest('Health Check', () => tester.testHealthCheck());
  await tester.runTest('Basic Search', () => tester.testBasicSearch());
  await tester.runTest('Recent Events', () => tester.testRecentEvents());
  await tester.runTest('Frame Retrieval', () => tester.testFrameRetrieval());
  await tester.runTest('Polling Test', () => tester.testPolling());
  
  tester.printSummary();
}

// Run the tests if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    logger.error('Test execution failed:', error);
    console.error('\n💥 Test execution failed:', error.message);
    process.exit(1);
  });
}

export { ScreenpipeClientTester };

