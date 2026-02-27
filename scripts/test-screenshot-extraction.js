#!/usr/bin/env node

/**
 * Test script to verify screenshot extraction functionality
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

const PROJECT_ROOT = path.resolve(__dirname, '..');
const testVideoPath = '/Users/kumar/Documents/Projects/memories/data/data/monitor_1_2025-09-25_21-25-22.mp4';
const screenshotDir = path.join(PROJECT_ROOT, 'data/screenshots');
const thumbnailDir = path.join(PROJECT_ROOT, 'data/thumbnails');

async function ensureDirectories() {
  console.log('📁 Creating directories...');
  await fs.mkdir(screenshotDir, { recursive: true });
  await fs.mkdir(thumbnailDir, { recursive: true });
  console.log('✅ Directories created');
}

async function testFFmpegInstallation() {
  console.log('\n🔍 Checking ffmpeg installation...');
  return new Promise((resolve) => {
    exec('ffmpeg -version', (error, stdout) => {
      if (error) {
        console.error('❌ ffmpeg not found! Please install ffmpeg: brew install ffmpeg');
        resolve(false);
      } else {
        const version = stdout.split('\n')[0];
        console.log('✅ ffmpeg found:', version);
        resolve(true);
      }
    });
  });
}

async function extractScreenshot() {
  console.log('\n📸 Testing screenshot extraction...');
  
  // Check if video exists
  try {
    await fs.access(testVideoPath);
    console.log('✅ Test video found:', testVideoPath);
  } catch {
    console.error('❌ Test video not found:', testVideoPath);
    return false;
  }

  // Extract screenshot
  const testId = 'test_' + Date.now();
  const screenshotPath = path.join(screenshotDir, `${testId}.jpg`);
  const thumbnailPath = path.join(thumbnailDir, `${testId}_thumb.jpg`);

  console.log('🎬 Extracting frame from video...');
  return new Promise((resolve) => {
    // Extract frame at 1 second mark
    const ffmpegCmd = `ffmpeg -ss 1 -i "${testVideoPath}" -vframes 1 -q:v 2 -y "${screenshotPath}"`;
    
    exec(ffmpegCmd, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Screenshot extraction failed:', error.message);
        console.error('stderr:', stderr);
        resolve(false);
      } else {
        console.log('✅ Screenshot extracted:', screenshotPath);
        
        // Generate thumbnail
        console.log('🖼️ Generating thumbnail...');
        const thumbCmd = `ffmpeg -i "${screenshotPath}" -vf "scale=400:-1" -q:v 3 -y "${thumbnailPath}"`;
        
        exec(thumbCmd, (error2) => {
          if (error2) {
            console.error('❌ Thumbnail generation failed:', error2.message);
            resolve(false);
          } else {
            console.log('✅ Thumbnail generated:', thumbnailPath);
            resolve(true);
          }
        });
      }
    });
  });
}

async function verifyFiles() {
  console.log('\n🔍 Verifying created files...');
  
  const screenshots = await fs.readdir(screenshotDir).catch(() => []);
  const thumbnails = await fs.readdir(thumbnailDir).catch(() => []);
  
  console.log(`📊 Found ${screenshots.length} screenshots`);
  console.log(`📊 Found ${thumbnails.length} thumbnails`);
  
  if (screenshots.length > 0) {
    console.log('\nSample screenshots:');
    for (const file of screenshots.slice(0, 5)) {
      const stats = await fs.stat(path.join(screenshotDir, file));
      console.log(`  - ${file} (${Math.round(stats.size / 1024)}KB)`);
    }
  }
  
  if (thumbnails.length > 0) {
    console.log('\nSample thumbnails:');
    for (const file of thumbnails.slice(0, 5)) {
      const stats = await fs.stat(path.join(thumbnailDir, file));
      console.log(`  - ${file} (${Math.round(stats.size / 1024)}KB)`);
    }
  }
}

async function checkDatabaseIntegration() {
  console.log('\n🗄️ Checking database for screenshot paths...');
  
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.join(PROJECT_ROOT, 'data/sqlite/memories.db');
  
  return new Promise((resolve) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ Failed to open database:', err);
        resolve();
        return;
      }

      db.all(`
        SELECT COUNT(*) as total,
               COUNT(screenshot_path) as with_screenshot,
               COUNT(thumbnail_path) as with_thumbnail
        FROM memories
        WHERE ts > ?
      `, [Date.now() - 600000], (err, rows) => { // Last 10 minutes
        if (err) {
          console.error('❌ Query failed:', err);
        } else {
          const row = rows[0];
          console.log(`📊 Recent memories: ${row.total} total`);
          console.log(`📸 With screenshots: ${row.with_screenshot}`);
          console.log(`🖼️ With thumbnails: ${row.with_thumbnail}`);
          
          if (row.with_screenshot > 0) {
            console.log('\n✅ Screenshot pipeline is working!');
          } else {
            console.log('\n⚠️ No screenshots in recent memories yet');
          }
        }
        db.close();
        resolve();
      });
    });
  });
}

// Run all tests
async function main() {
  console.log('🧪 SCREENSHOT EXTRACTION TEST');
  console.log('=' .repeat(50));
  
  await ensureDirectories();
  
  const hasFFmpeg = await testFFmpegInstallation();
  if (!hasFFmpeg) {
    console.log('\n⚠️ Please install ffmpeg first: brew install ffmpeg');
    process.exit(1);
  }
  
  const success = await extractScreenshot();
  if (success) {
    await verifyFiles();
  }
  
  await checkDatabaseIntegration();
  
  console.log('\n✅ Test complete!');
}

// Check if sqlite3 is available
try {
  require('sqlite3');
  main().catch(console.error);
} catch {
  // Run without database check
  (async () => {
    console.log('⚠️ sqlite3 not available, skipping database checks');
    await ensureDirectories();
    const hasFFmpeg = await testFFmpegInstallation();
    if (hasFFmpeg) {
      await extractScreenshot();
      await verifyFiles();
    }
  })();
}


