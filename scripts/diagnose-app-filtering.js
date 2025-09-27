#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const path = require('path');

// Database path
const dbPath = path.join(__dirname, '../data/sqlite/memories.db');

async function checkDatabase() {
  console.log('\n📊 DATABASE ANALYSIS\n' + '='.repeat(50));
  
  return new Promise((resolve) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ Failed to open database:', err);
        resolve();
        return;
      }

      // Get app distribution
      db.all(`
        SELECT app, COUNT(*) as count 
        FROM memories 
        GROUP BY app 
        ORDER BY count DESC
      `, (err, rows) => {
        if (err) {
          console.error('❌ Query failed:', err);
        } else {
          console.log('Apps in Database:');
          console.log('-'.repeat(40));
          let totalApps = 0;
          let totalEntries = 0;
          rows.forEach(row => {
            console.log(`  ${row.app.padEnd(30)} | ${row.count}`);
            totalApps++;
            totalEntries += row.count;
          });
          console.log('-'.repeat(40));
          console.log(`Total: ${totalApps} unique apps, ${totalEntries} entries\n`);

          // Check for special characters in app names
          console.log('Apps with special characters:');
          rows.forEach(row => {
            if (!/^[a-zA-Z0-9\s\-\.]+$/.test(row.app)) {
              console.log(`  ⚠️  "${row.app}" - contains special chars`);
            }
          });
        }

        // Get sample entries for each app
        db.all(`
          SELECT DISTINCT app, 
                 substr(window_title, 1, 50) as sample_title,
                 substr(ocr_text, 1, 100) as sample_text
          FROM memories
          GROUP BY app
          LIMIT 20
        `, (err, rows) => {
          if (err) {
            console.error('❌ Sample query failed:', err);
          } else {
            console.log('\nSample entries by app:');
            console.log('-'.repeat(60));
            rows.forEach(row => {
              console.log(`\n📱 ${row.app}`);
              console.log(`   Window: ${row.sample_title || '(none)'}`);
              console.log(`   OCR: ${row.sample_text ? row.sample_text.substring(0, 60) + '...' : '(none)'}`);
            });
          }
          
          db.close();
          resolve();
        });
      });
    });
  });
}

async function checkScreenpipe() {
  console.log('\n🔍 SCREENPIPE ANALYSIS\n' + '='.repeat(50));
  
  try {
    // Get recent events from Screenpipe
    const response = await axios.get('http://localhost:3030/search', {
      params: {
        limit: 200,
        content_type: 'ocr'
      }
    });

    const events = response.data.data;
    
    // Count apps from Screenpipe
    const appCounts = {};
    events.forEach(event => {
      const appName = event.content?.app_name || event.app_name || 'unknown';
      appCounts[appName] = (appCounts[appName] || 0) + 1;
    });

    console.log('Apps from Screenpipe (last 200 events):');
    console.log('-'.repeat(40));
    const sortedApps = Object.entries(appCounts)
      .sort((a, b) => b[1] - a[1]);
    
    sortedApps.forEach(([app, count]) => {
      console.log(`  ${app.padEnd(30)} | ${count}`);
    });
    console.log('-'.repeat(40));
    console.log(`Total: ${sortedApps.length} unique apps\n`);

    // Compare with database
    console.log('🔄 COMPARISON:');
    console.log('-'.repeat(40));
    
    // Apps in Screenpipe but not in DB (this is what we're looking for!)
    console.log('\n❌ Apps in Screenpipe but NOT in Database:');
    const dbApps = await getDbApps();
    sortedApps.forEach(([app]) => {
      if (!dbApps.includes(app)) {
        console.log(`  - ${app}`);
      }
    });

    // Check for pattern in missing apps
    console.log('\n🔬 Pattern Analysis:');
    const missingApps = sortedApps.filter(([app]) => !dbApps.includes(app)).map(([app]) => app);
    
    // Check for common characteristics
    const hasSpecialChars = missingApps.filter(app => !/^[a-zA-Z0-9\s\-\.]+$/.test(app));
    const hasNumbers = missingApps.filter(app => /\d/.test(app));
    const hasSpaces = missingApps.filter(app => /\s/.test(app));
    
    if (hasSpecialChars.length > 0) {
      console.log(`  ⚠️ ${hasSpecialChars.length} missing apps have special characters:`, hasSpecialChars.slice(0, 5));
    }
    if (hasNumbers.length > 0) {
      console.log(`  ⚠️ ${hasNumbers.length} missing apps have numbers:`, hasNumbers.slice(0, 5));
    }
    if (hasSpaces.length > 0) {
      console.log(`  ⚠️ ${hasSpaces.length} missing apps have spaces:`, hasSpaces.slice(0, 5));
    }

  } catch (error) {
    console.error('❌ Failed to connect to Screenpipe:', error.message);
    console.log('   Make sure Screenpipe is running on port 3030');
  }
}

async function getDbApps() {
  return new Promise((resolve) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        resolve([]);
        return;
      }

      db.all('SELECT DISTINCT app FROM memories', (err, rows) => {
        if (err) {
          resolve([]);
        } else {
          resolve(rows.map(r => r.app));
        }
        db.close();
      });
    });
  });
}

async function testIngestBridge() {
  console.log('\n🧪 TESTING INGEST BRIDGE PROCESSING\n' + '='.repeat(50));
  
  try {
    // Get one event from Screenpipe for a missing app (like Cursor or Terminal)
    const response = await axios.get('http://localhost:3030/search', {
      params: {
        limit: 100,
        content_type: 'ocr',
        app_name: 'Cursor' // Try to get Cursor events specifically
      }
    });

    const cursorEvents = response.data.data.filter(e => 
      (e.content?.app_name || '').toLowerCase().includes('cursor') ||
      (e.content?.app_name || '').toLowerCase().includes('terminal')
    );

    if (cursorEvents.length > 0) {
      console.log(`Found ${cursorEvents.length} Cursor/Terminal events from Screenpipe`);
      console.log('\nSample event structure:');
      const sample = cursorEvents[0];
      console.log(JSON.stringify({
        type: sample.type,
        app_name: sample.content?.app_name,
        window_name: sample.content?.window_name,
        text_length: sample.content?.text?.length,
        timestamp: sample.content?.timestamp,
        file_path: sample.content?.file_path
      }, null, 2));
    } else {
      console.log('No Cursor/Terminal events found in Screenpipe');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run all diagnostics
async function main() {
  console.log('\n🔧 PHOTOGRAPHIC MEMORY APP FILTERING DIAGNOSTICS');
  console.log('='.repeat(60));
  
  await checkDatabase();
  await checkScreenpipe();
  await testIngestBridge();
  
  console.log('\n✅ Diagnostics complete!');
  console.log('\n📝 NEXT STEPS:');
  console.log('1. Check the Ingest Bridge logs for the emojis we added');
  console.log('2. Look for validation failures or database errors');
  console.log('3. Pay attention to apps with special characters or spaces');
  console.log('4. Run: cd services/ingest-bridge && npm run build && npm start');
}

main().catch(console.error);
