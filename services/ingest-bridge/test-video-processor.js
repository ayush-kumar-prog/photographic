/**
 * Test script for video processor functionality
 */

const { VideoProcessor } = require('./dist/media/video-processor');
const fs = require('fs');
const path = require('path');

async function testVideoProcessor() {
  console.log('🧪 Testing Video Processor...\n');
  
  const processor = new VideoProcessor();
  
  // Test with some sample data
  const testCases = [
    {
      filePath: '/Users/kumar/Documents/Projects/memories/data/data/monitor_1_2025-09-18_12-00-00.mp4',
      ocrText: 'Terminal window with git commands and file listings'
    },
    {
      filePath: '/Users/kumar/Documents/Projects/memories/data/data/monitor_1_2025-09-18_12-00-01.mp4', 
      ocrText: 'Terminal window with git commands and file listings' // Same content
    },
    {
      filePath: '/Users/kumar/Documents/Projects/memories/data/data/monitor_1_2025-09-18_12-00-02.mp4',
      ocrText: 'Safari browser showing YouTube video about machine learning'
    }
  ];

  // Find actual video files to test with
  const dataDir = '/Users/kumar/Documents/Projects/memories/data/data';
  let actualFiles = [];
  
  try {
    const files = await fs.promises.readdir(dataDir);
    actualFiles = files
      .filter(f => f.endsWith('.mp4'))
      .slice(0, 3) // Take first 3 files
      .map(f => path.join(dataDir, f));
    
    console.log(`📁 Found ${actualFiles.length} video files to test with:`);
    actualFiles.forEach((f, i) => console.log(`  ${i + 1}. ${path.basename(f)}`));
    console.log();
    
  } catch (error) {
    console.log('⚠️  Could not read data directory, using mock test cases');
    actualFiles = testCases.map(tc => tc.filePath);
  }

  // Test processing
  for (let i = 0; i < Math.min(actualFiles.length, 3); i++) {
    const filePath = actualFiles[i];
    const ocrText = i === 1 ? 
      'Terminal window with git commands and file listings' : // Duplicate content
      `Sample OCR text for file ${i + 1} - unique content here`;
    
    try {
      console.log(`🔄 Processing file ${i + 1}: ${path.basename(filePath)}`);
      
      // Check if file exists
      try {
        await fs.promises.access(filePath);
      } catch {
        console.log(`   ⚠️  File doesn't exist, skipping...`);
        continue;
      }
      
      const result = await processor.processVideoFile(filePath, ocrText);
      
      console.log(`   📊 Result:`);
      console.log(`      Should Keep: ${result.shouldKeep ? '✅' : '❌'}`);
      console.log(`      Is Duplicate: ${result.similarityResult.isDuplicate ? '✅' : '❌'}`);
      console.log(`      Similarity Score: ${(result.similarityResult.similarityScore * 100).toFixed(1)}%`);
      console.log(`      File Size: ${(result.frameInfo.size / (1024 * 1024)).toFixed(2)}MB`);
      console.log(`      Hash: ${result.frameInfo.hash.substring(0, 12)}...`);
      
      if (result.similarityResult.previousFrame) {
        console.log(`      Similar to: ${path.basename(result.similarityResult.previousFrame.filePath)}`);
      }
      
      console.log();
      
    } catch (error) {
      console.log(`   ❌ Error processing file: ${error.message}`);
      console.log();
    }
  }

  // Show final stats
  const stats = processor.getStats();
  console.log('📈 Final Statistics:');
  console.log(`   Processed Frames: ${stats.processedFrames}`);
  console.log(`   Cache Size: ${stats.cacheSize}`);
  console.log(`   Estimated Space Saved: ${stats.estimatedSavedSpace}`);
  
  console.log('\n✅ Video Processor test completed!');
}

// Run the test
testVideoProcessor().catch(error => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});
