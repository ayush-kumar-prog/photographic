#!/usr/bin/env node
/**
 * Simple Screenpipe Client Debug Tool
 * 
 * This is a simple JavaScript file (not TypeScript) for quick manual testing.
 * Run with: node debug-client.js [command]
 * 
 * Commands:
 *   health    - Check health status
 *   search    - Test basic search
 *   recent    - Get recent events
 *   raw       - Raw API calls
 */

const axios = require('axios');

const SCREENPIPE_URL = 'http://localhost:3030';

// Simple logging
const log = {
  info: (msg, data) => console.log(`ℹ️  ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
  error: (msg, data) => console.error(`❌ ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
  success: (msg, data) => console.log(`✅ ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
  debug: (msg, data) => console.log(`🔍 ${msg}`, data ? JSON.stringify(data, null, 2) : '')
};

// Test health endpoint
async function testHealth() {
  log.info('Testing health endpoint...');
  
  try {
    const response = await axios.get(`${SCREENPIPE_URL}/health`, { timeout: 5000 });
    log.success('Health check successful:', response.data);
    return response.data;
  } catch (error) {
    log.error('Health check failed:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
}

// Test basic search
async function testSearch() {
  log.info('Testing basic search...');
  
  const params = {
    content_type: 'ocr',
    limit: 3,
    include_frames: true
  };
  
  try {
    log.debug('Search params:', params);
    const response = await axios.get(`${SCREENPIPE_URL}/search`, { 
      params,
      timeout: 30000,  // Increase timeout
      headers: {
        'Connection': 'close'  // Force connection close to avoid keep-alive issues
      }
    });
    
    log.success('Search successful:', {
      resultCount: response.data.data?.length || 0,
      pagination: response.data.pagination,
      sampleResult: response.data.data?.[0] || null
    });
    
    return response.data;
  } catch (error) {
    log.error('Search failed:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      url: error.config?.url,
      params: error.config?.params
    });
    throw error;
  }
}

// Test recent events
async function testRecent() {
  log.info('Testing recent events...');
  
  // Get events from last 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  const params = {
    content_type: 'ocr',
    limit: 5,
    start_time: fiveMinutesAgo,
    include_frames: true
  };
  
  try {
    log.debug('Recent events params:', params);
    const response = await axios.get(`${SCREENPIPE_URL}/search`, { 
      params,
      timeout: 10000 
    });
    
    const events = response.data.data || [];
    
    log.success('Recent events retrieved:', {
      eventCount: events.length,
      timeRange: `Since ${fiveMinutesAgo}`,
      events: events.map(event => ({
        timestamp: event.timestamp,
        app: event.app_name,
        window: event.window_name,
        ocrPreview: (event.ocr_text || '').substring(0, 100) + '...',
        hasFrameId: !!event.frame_id
      }))
    });
    
    return events;
  } catch (error) {
    log.error('Recent events failed:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
}

// Raw API testing
async function testRaw() {
  log.info('Testing raw API calls...');
  
  const tests = [
    { name: 'Health', url: '/health' },
    { name: 'Search (no params)', url: '/search?limit=1' },
    { name: 'Search (ocr)', url: '/search?content_type=ocr&limit=1' },
    { name: 'Search (all)', url: '/search?content_type=all&limit=1' }
  ];
  
  for (const test of tests) {
    try {
      log.debug(`Testing ${test.name}:`, test.url);
      const response = await axios.get(`${SCREENPIPE_URL}${test.url}`, { timeout: 5000 });
      log.success(`${test.name} - OK:`, {
        status: response.status,
        dataType: typeof response.data,
        dataSize: JSON.stringify(response.data).length
      });
    } catch (error) {
      log.error(`${test.name} - FAILED:`, {
        status: error.response?.status,
        data: error.response?.data
      });
    }
  }
}

// Connection test
async function testConnection() {
  log.info('Testing full connection...');
  
  try {
    // 1. Health check
    await testHealth();
    
    // 2. Basic search
    await testSearch();
    
    // 3. Recent events
    await testRecent();
    
    log.success('🎉 All tests passed! Screenpipe client should work.');
    
  } catch (error) {
    log.error('❌ Connection test failed. Check Screenpipe server.');
    process.exit(1);
  }
}

// Main function
async function main() {
  const command = process.argv[2] || 'connection';
  
  console.log('🚀 Screenpipe Client Debug Tool');
  console.log('================================');
  console.log(`Command: ${command}\n`);
  
  try {
    switch (command) {
      case 'health':
        await testHealth();
        break;
      case 'search':
        await testSearch();
        break;
      case 'recent':
        await testRecent();
        break;
      case 'raw':
        await testRaw();
        break;
      case 'connection':
      default:
        await testConnection();
        break;
    }
  } catch (error) {
    log.error('Command failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = { testHealth, testSearch, testRecent, testRaw, testConnection };
