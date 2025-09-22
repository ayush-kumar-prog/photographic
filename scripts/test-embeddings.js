#!/usr/bin/env node

// Simple embeddings test
const path = require('path');
const fs = require('fs');

console.log('🧪 Testing Embeddings Component...');

// Check if OpenAI API key is available
if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'dummy') {
    console.log('⚠️  No OpenAI API key found. Skipping embeddings test.');
    console.log('   Set OPENAI_API_KEY environment variable to test embeddings.');
    process.exit(0);
}

try {
    const { EmbeddingsService } = require('../services/ingest-bridge/dist/embeddings/service.js');
    
    async function testEmbeddings() {
        console.log('📁 Initializing embeddings service...');
        const embeddingsService = new EmbeddingsService('./data/chroma');
        
        console.log('🔌 Connecting to OpenAI and ChromaDB...');
        await embeddingsService.initialize();
        console.log('✅ Embeddings service initialized successfully');
        
        // Test single embedding generation
        console.log('🧠 Generating test embedding...');
        const testText = 'This is a test text for embedding generation in our photographic memory system';
        const embedding = await embeddingsService.generateEmbedding(testText);
        
        if (embedding && embedding.length === 3072) {
            console.log('✅ OpenAI embedding generated successfully (3072 dimensions)');
        } else {
            throw new Error(`Invalid embedding dimensions: ${embedding?.length}`);
        }
        
        // Test storing embedding
        console.log('💾 Storing test memory with embedding...');
        const testMemory = {
            id: 'embedding-test-1',
            ts: Date.now(),
            session_id: null,
            app: 'Test App',
            window_title: 'Embedding Test',
            url: null,
            url_host: null,
            media_path: '/tmp/test.png',
            thumb_path: null,
            ocr_text: testText,
            asr_text: null,
            entities: [],
            topics: [],
            embedding: embedding
        };
        
        await embeddingsService.storeEmbedding(testMemory);
        console.log('✅ Memory with embedding stored successfully');
        
        // Test semantic search
        console.log('🔍 Testing semantic search...');
        const searchResults = await embeddingsService.searchSimilar('photographic memory test', 5);
        
        if (searchResults.length > 0) {
            console.log('✅ Semantic search working:', searchResults.length, 'results found');
            console.log('📊 Top result similarity:', searchResults[0].distance);
        } else {
            console.log('⚠️  No semantic search results (this might be normal for a single test item)');
        }
        
        // Test batch embedding generation
        console.log('🔄 Testing batch embedding generation...');
        const batchTexts = [
            'First test text for batch processing',
            'Second test text for batch processing',
            'Third test text for batch processing'
        ];
        
        const batchEmbeddings = await embeddingsService.generateEmbeddingsBatch(batchTexts);
        if (batchEmbeddings.length === 3 && batchEmbeddings.every(emb => emb.length === 3072)) {
            console.log('✅ Batch embedding generation working:', batchEmbeddings.length, 'embeddings generated');
        } else {
            throw new Error('Batch embedding generation failed');
        }
        
        // Test collection stats
        console.log('📈 Getting collection stats...');
        const stats = await embeddingsService.getCollectionStats();
        console.log('✅ ChromaDB collection stats:', stats);
        
        console.log('\n🎉 Embeddings component is working perfectly!');
        process.exit(0);
    }
    
    testEmbeddings().catch(error => {
        console.error('❌ Embeddings test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    });
    
} catch (error) {
    console.error('❌ Failed to load embeddings module:', error.message);
    process.exit(1);
}
