#!/usr/bin/env node

// Simple thumbnail test
const path = require('path');
const fs = require('fs');

console.log('🧪 Testing Thumbnail Component...');

try {
    const { ThumbnailGenerator } = require('../services/ingest-bridge/dist/media/thumbnails.js');
    
    async function testThumbnails() {
        console.log('📁 Initializing thumbnail service...');
        const thumbnailService = new ThumbnailGenerator('./data/thumbs');
        
        // Create a simple test SVG image
        const testImagePath = '/tmp/test-image.svg';
        const testSvg = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
            <rect width="200" height="200" fill="#4A90E2"/>
            <text x="100" y="100" text-anchor="middle" fill="white" font-size="24" font-family="Arial">TEST</text>
            <text x="100" y="130" text-anchor="middle" fill="white" font-size="16" font-family="Arial">Thumbnail</text>
        </svg>`;
        
        console.log('🎨 Creating test image...');
        fs.writeFileSync(testImagePath, testSvg);
        console.log('✅ Test image created:', testImagePath);
        
        // Test thumbnail generation
        console.log('🖼️  Generating thumbnail...');
        const thumbnailPath = await thumbnailService.generateThumbnail(testImagePath, 'test-event-thumb');
        
        if (thumbnailPath && fs.existsSync(thumbnailPath)) {
            console.log('✅ Thumbnail generated successfully');
            console.log('📁 Thumbnail saved to:', thumbnailPath);
            
            // Check file size
            const stats = fs.statSync(thumbnailPath);
            console.log('📊 Thumbnail size:', Math.round(stats.size / 1024), 'KB');
        } else {
            throw new Error('Thumbnail not generated');
        }
        
        // Test service stats
        console.log('📈 Getting thumbnail service stats...');
        const serviceStats = await thumbnailService.getStats();
        console.log('✅ Thumbnail service stats:', serviceStats);
        
        // Test batch generation
        console.log('🔄 Testing batch thumbnail generation...');
        const batchRequests = [
            { mediaPath: testImagePath, eventId: 'batch-test-1' },
            { mediaPath: testImagePath, eventId: 'batch-test-2' }
        ];
        
        const batchResults = await thumbnailService.generateThumbnailsBatch(batchRequests);
        console.log('✅ Batch generation results:', batchResults.length, 'thumbnails generated');
        
        // Cleanup test image
        fs.unlinkSync(testImagePath);
        console.log('🧹 Cleaned up test image');
        
        console.log('\n🎉 Thumbnail component is working perfectly!');
        process.exit(0);
    }
    
    testThumbnails().catch(error => {
        console.error('❌ Thumbnail test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    });
    
} catch (error) {
    console.error('❌ Failed to load thumbnail module:', error.message);
    process.exit(1);
}
