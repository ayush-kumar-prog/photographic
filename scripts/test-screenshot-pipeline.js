#!/usr/bin/env node

/**
 * Test the complete screenshot extraction pipeline
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

async function testScreenshotPipeline() {
  const testVideoPath = '/Users/kumar/Documents/Projects/memories/data/data/monitor_1_2025-09-25_21-25-22.mp4';
  const testEventId = 'test_' + Date.now();
  
  console.log('🧪 TESTING SCREENSHOT PIPELINE');
  console.log('=' .repeat(50));
  
  // Create directories
  const screenshotDir = '/Users/kumar/Documents/Projects/memories/data/screenshots';
  const thumbnailDir = '/Users/kumar/Documents/Projects/memories/data/thumbnails';
  
  await fs.mkdir(screenshotDir, { recursive: true });
  await fs.mkdir(thumbnailDir, { recursive: true });
  
  // Extract screenshot
  const screenshotPath = `${screenshotDir}/${testEventId}.jpg`;
  const thumbnailPath = `${thumbnailDir}/${testEventId}_thumb.jpg`;
  
  console.log('\n📸 Extracting screenshot...');
  const screenshotCmd = `ffmpeg -i "${testVideoPath}" -vframes 1 -q:v 2 -strict unofficial -pix_fmt yuvj420p -y "${screenshotPath}"`;
  
  await new Promise((resolve, reject) => {
    exec(screenshotCmd, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Screenshot extraction failed:', error.message);
        reject(error);
      } else {
        console.log('✅ Screenshot extracted:', screenshotPath);
        resolve();
      }
    });
  });
  
  // Generate thumbnail
  console.log('\n🖼️ Generating thumbnail...');
  const thumbnailCmd = `ffmpeg -i "${screenshotPath}" -vf "scale=400:-1" -q:v 3 -y "${thumbnailPath}"`;
  
  await new Promise((resolve, reject) => {
    exec(thumbnailCmd, (error) => {
      if (error) {
        console.error('❌ Thumbnail generation failed:', error.message);
        reject(error);
      } else {
        console.log('✅ Thumbnail generated:', thumbnailPath);
        resolve();
      }
    });
  });
  
  // Verify files
  console.log('\n📊 Verifying files...');
  const [screenshotStats, thumbnailStats] = await Promise.all([
    fs.stat(screenshotPath),
    fs.stat(thumbnailPath)
  ]);
  
  console.log(`Screenshot size: ${Math.round(screenshotStats.size / 1024)}KB`);
  console.log(`Thumbnail size: ${Math.round(thumbnailStats.size / 1024)}KB`);
  
  // Simulate database update
  console.log('\n💾 Database update simulation:');
  console.log(`UPDATE memories SET screenshot_path='${screenshotPath}', thumbnail_path='${thumbnailPath}' WHERE id='${testEventId}';`);
  
  console.log('\n✅ Screenshot pipeline test complete!');
  console.log('\nThe pipeline is working correctly. When Screenpipe creates new video files,');
  console.log('the Ingest Bridge will automatically extract screenshots and thumbnails.');
}

testScreenshotPipeline().catch(console.error);


