#!/usr/bin/env tsx

/**
 * Smoke Test for Ingest Bridge Service
 * 
 * Basic functionality test to ensure all components work together
 */

import { IngestBridge } from '../index';
import { logger } from '../utils/logger';
import * as path from 'path';

async function smokeTest(): Promise<boolean> {
  logger.info('Starting Ingest Bridge smoke test...');
  
  const testDataDir = path.join(__dirname, '../../smoke-test-data');
  const service = new IngestBridge();
  
  try {
    // Test 1: Service initialization
    logger.info('Test 1: Service initialization...');
    await service.start();
    logger.info('✅ Service started successfully');
    
    // Test 2: Health check
    logger.info('Test 2: Health check...');
    const health = await service.healthCheck();
    logger.info('Health check result:', health);
    
    if (!health.components.database) {
      throw new Error('Database component not healthy');
    }
    
    if (!health.components.embeddings) {
      throw new Error('Embeddings component not healthy');
    }
    
    logger.info('✅ Health check passed');
    
    // Test 3: Get processing stats
    logger.info('Test 3: Processing statistics...');
    const stats = await service.getProcessingStats();
    logger.info('Processing stats:', JSON.stringify(stats, null, 2));
    logger.info('✅ Statistics retrieved successfully');
    
    // Test 4: Stop service
    logger.info('Test 4: Service shutdown...');
    await service.stop();
    logger.info('✅ Service stopped successfully');
    
    logger.info('🎉 All smoke tests passed!');
    return true;
    
  } catch (error) {
    logger.error('❌ Smoke test failed:', error);
    return false;
  }
}

// Run smoke test if this file is executed directly
if (require.main === module) {
  smokeTest()
    .then(success => {
      if (success) {
        console.log('✅ Smoke test PASSED');
        process.exit(0);
      } else {
        console.log('❌ Smoke test FAILED');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Smoke test execution failed:', error);
      process.exit(1);
    });
}

export { smokeTest };
