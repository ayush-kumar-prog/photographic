#!/usr/bin/env node

// Simple database test
const path = require('path');
const fs = require('fs');

console.log('🧪 Testing Database Component...');

try {
    const { DatabaseManager } = require('../services/ingest-bridge/dist/database/manager.js');
    
    async function testDatabase() {
        console.log('📁 Initializing database...');
        const dbManager = new DatabaseManager('./data/sqlite');
        
        await dbManager.initialize();
        console.log('✅ Database initialized successfully');
        
        // Test schema
        const stats = await dbManager.getStats();
        console.log('✅ Database stats:', stats);
        
        // Test storing a memory object
        const testMemory = {
            id: 'test-memory-1',
            ts: Date.now(),
            session_id: null,
            app: 'Test App',
            window_title: 'Test Window',
            url: null,
            url_host: null,
            media_path: '/tmp/test.png',
            thumb_path: null,
            ocr_text: 'This is a test memory for verification',
            asr_text: null,
            entities: [],
            topics: []
        };
        
        console.log('💾 Storing test memory object...');
        await dbManager.storeMemoryObject(testMemory);
        console.log('✅ Memory object stored successfully');
        
        // Test search
        console.log('🔍 Testing FTS search...');
        const searchResults = await dbManager.searchMemories('test memory', 10, 0);
        console.log('✅ FTS search results:', searchResults.length, 'found');
        
        // Test recent memories
        console.log('📅 Testing recent memories...');
        const recentMemories = await dbManager.getRecentMemories(10, 0);
        console.log('✅ Recent memories:', recentMemories.length, 'found');
        
        console.log('\n🎉 Database component is working perfectly!');
        process.exit(0);
    }
    
    testDatabase().catch(error => {
        console.error('❌ Database test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    });
    
} catch (error) {
    console.error('❌ Failed to load database module:', error.message);
    process.exit(1);
}
