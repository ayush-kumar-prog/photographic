#!/usr/bin/env tsx

/**
 * Search API Performance Test
 * Tests P95 latency, confidence scoring, and demo queries
 */

import { SearchService } from '../services/search';
import { logger } from '../utils/logger';

interface TestQuery {
  name: string;
  query: string;
  expectedMode?: 'exact' | 'jog';
  minConfidence?: number;
  maxLatency?: number;
}

const DEMO_QUERIES: TestQuery[] = [
  {
    name: 'Time-anchored recall',
    query: "dad's birthday gift 2 weeks ago",
    expectedMode: 'jog',
    maxLatency: 700
  },
  {
    name: 'Game score recall',
    query: 'my Apex score yesterday',
    expectedMode: 'exact',
    minConfidence: 0.7,
    maxLatency: 700
  },
  {
    name: 'Content recall',
    query: 'YouTube microeconomics video last month',
    expectedMode: 'jog',
    maxLatency: 700
  },
  {
    name: 'App-specific search',
    query: 'Safari Amazon product',
    maxLatency: 700
  },
  {
    name: 'Generic search',
    query: 'error dialog',
    maxLatency: 700
  }
];

class SearchPerformanceTest {
  private searchService: SearchService;
  private results: any[] = [];

  constructor() {
    this.searchService = new SearchService();
  }

  async initialize(): Promise<void> {
    try {
      await this.searchService.initialize();
      logger.info('Search service initialized for performance testing');
    } catch (error) {
      logger.error('Failed to initialize search service:', error);
      throw error;
    }
  }

  async runPerformanceTest(): Promise<void> {
    logger.info('🚀 Starting Search API Performance Test');
    
    // Test individual queries
    for (const testQuery of DEMO_QUERIES) {
      await this.testQuery(testQuery);
    }
    
    // Test concurrent queries
    await this.testConcurrentQueries();
    
    // Test cache performance
    await this.testCachePerformance();
    
    // Generate report
    this.generateReport();
  }

  private async testQuery(testQuery: TestQuery): Promise<void> {
    logger.info(`Testing query: "${testQuery.query}"`);
    
    const startTime = Date.now();
    
    try {
      const result = await this.searchService.search({
        q: testQuery.query,
        k: 6
      });
      
      const latency = Date.now() - startTime;
      
      const testResult = {
        name: testQuery.name,
        query: testQuery.query,
        latency,
        mode: result.mode,
        confidence: result.confidence,
        cardCount: result.cards.length,
        passed: this.evaluateQuery(testQuery, result, latency)
      };
      
      this.results.push(testResult);
      
      if (testResult.passed) {
        logger.info(`✅ ${testQuery.name}: ${latency}ms, mode=${result.mode}, confidence=${result.confidence.toFixed(3)}, cards=${result.cards.length}`);
      } else {
        logger.warn(`❌ ${testQuery.name}: Failed performance criteria`);
      }
      
    } catch (error) {
      logger.error(`❌ ${testQuery.name}: Error -`, error);
      this.results.push({
        name: testQuery.name,
        query: testQuery.query,
        error: error instanceof Error ? error.message : 'Unknown error',
        passed: false
      });
    }
  }

  private evaluateQuery(testQuery: TestQuery, result: any, latency: number): boolean {
    let passed = true;
    
    // Check latency
    if (testQuery.maxLatency && latency > testQuery.maxLatency) {
      logger.warn(`Latency ${latency}ms exceeds max ${testQuery.maxLatency}ms`);
      passed = false;
    }
    
    // Check mode
    if (testQuery.expectedMode && result.mode !== testQuery.expectedMode) {
      logger.warn(`Mode ${result.mode} doesn't match expected ${testQuery.expectedMode}`);
      // Don't fail on mode mismatch, just warn
    }
    
    // Check confidence
    if (testQuery.minConfidence && result.confidence < testQuery.minConfidence) {
      logger.warn(`Confidence ${result.confidence} below minimum ${testQuery.minConfidence}`);
      passed = false;
    }
    
    // Check that we got results
    if (result.cards.length === 0) {
      logger.warn('No results returned');
      passed = false;
    }
    
    return passed;
  }

  private async testConcurrentQueries(): Promise<void> {
    logger.info('🔄 Testing concurrent query performance');
    
    const concurrentQueries = DEMO_QUERIES.slice(0, 3).map(tq => ({
      q: tq.query,
      k: 6
    }));
    
    const startTime = Date.now();
    
    try {
      const promises = concurrentQueries.map(query => 
        this.searchService.search(query)
      );
      
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / results.length;
      
      logger.info(`✅ Concurrent queries: ${results.length} queries in ${totalTime}ms (avg: ${avgTime.toFixed(1)}ms)`);
      
      this.results.push({
        name: 'Concurrent Queries',
        queryCount: results.length,
        totalTime,
        avgTime,
        passed: avgTime < 1000 // Should average under 1 second
      });
      
    } catch (error) {
      logger.error('❌ Concurrent query test failed:', error);
      this.results.push({
        name: 'Concurrent Queries',
        error: error instanceof Error ? error.message : 'Unknown error',
        passed: false
      });
    }
  }

  private async testCachePerformance(): Promise<void> {
    logger.info('💾 Testing cache performance');
    
    const testQuery = { q: 'test cache performance', k: 6 };
    
    // First query (cold)
    const coldStart = Date.now();
    await this.searchService.search(testQuery);
    const coldTime = Date.now() - coldStart;
    
    // Second query (cached)
    const warmStart = Date.now();
    await this.searchService.search(testQuery);
    const warmTime = Date.now() - warmStart;
    
    const speedup = coldTime / warmTime;
    
    logger.info(`✅ Cache performance: cold=${coldTime}ms, warm=${warmTime}ms, speedup=${speedup.toFixed(1)}x`);
    
    this.results.push({
      name: 'Cache Performance',
      coldTime,
      warmTime,
      speedup,
      passed: warmTime < coldTime * 0.5 // Cached should be at least 2x faster
    });
  }

  private generateReport(): void {
    logger.info('📊 Performance Test Report');
    logger.info('=' .repeat(50));
    
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    
    logger.info(`Overall: ${passed}/${total} tests passed (${((passed/total) * 100).toFixed(1)}%)`);
    logger.info('');
    
    // Latency statistics
    const latencies = this.results
      .filter(r => r.latency)
      .map(r => r.latency)
      .sort((a, b) => a - b);
    
    if (latencies.length > 0) {
      const p50 = latencies[Math.floor(latencies.length * 0.5)];
      const p95 = latencies[Math.floor(latencies.length * 0.95)];
      const p99 = latencies[Math.floor(latencies.length * 0.99)];
      
      logger.info('Latency Statistics:');
      logger.info(`  P50: ${p50}ms`);
      logger.info(`  P95: ${p95}ms`);
      logger.info(`  P99: ${p99}ms`);
      logger.info(`  Target: <700ms P95 ${p95 < 700 ? '✅' : '❌'}`);
      logger.info('');
    }
    
    // Individual test results
    logger.info('Individual Test Results:');
    for (const result of this.results) {
      const status = result.passed ? '✅' : '❌';
      if (result.latency) {
        logger.info(`  ${status} ${result.name}: ${result.latency}ms (${result.mode}, conf=${result.confidence?.toFixed(3)})`);
      } else {
        logger.info(`  ${status} ${result.name}: ${result.error || 'Completed'}`);
      }
    }
    
    // Success criteria
    logger.info('');
    logger.info('Success Criteria:');
    logger.info(`  ✅ P95 latency <700ms: ${latencies.length > 0 && latencies[Math.floor(latencies.length * 0.95)] < 700 ? 'PASS' : 'FAIL'}`);
    logger.info(`  ✅ Demo queries succeed: ${this.results.filter(r => DEMO_QUERIES.some(dq => dq.name === r.name) && r.passed).length}/${DEMO_QUERIES.length} PASS`);
    logger.info(`  ✅ No crashes: ${this.results.every(r => !r.error) ? 'PASS' : 'FAIL'}`);
  }
}

async function main() {
  const test = new SearchPerformanceTest();
  
  try {
    await test.initialize();
    await test.runPerformanceTest();
    
    logger.info('🎉 Performance test completed');
    process.exit(0);
  } catch (error) {
    logger.error('Performance test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
