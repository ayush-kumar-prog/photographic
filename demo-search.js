#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('🧠 PHOTOGRAPHIC MEMORY DEMO');
console.log('============================\n');

// Connect to database
const dbPath = path.join(__dirname, 'data/sqlite/memories.db');
const db = new sqlite3.Database(dbPath);

// Demo functions
function searchMemories(query) {
  return new Promise((resolve, reject) => {
    console.log(`🔍 Searching for: "${query}"`);
    console.log('─'.repeat(50));
    
    const sql = `
      SELECT 
        datetime(m.ts, 'unixepoch') as timestamp,
        m.app,
        m.window_title,
        m.ocr_text
      FROM memories_fts 
      JOIN memories m ON memories_fts.id = m.id 
      WHERE memories_fts MATCH ? 
      ORDER BY m.ts DESC
    `;
    
    db.all(sql, [query], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (rows.length === 0) {
        console.log('❌ No memories found\n');
      } else {
        console.log(`✅ Found ${rows.length} memory(ies):\n`);
        rows.forEach((row, i) => {
          console.log(`📱 Memory ${i + 1}:`);
          console.log(`   ⏰ Time: ${row.timestamp}`);
          console.log(`   📱 App: ${row.app}`);
          console.log(`   🪟 Window: ${row.window_title}`);
          console.log(`   📝 Content: ${row.ocr_text.substring(0, 100)}${row.ocr_text.length > 100 ? '...' : ''}`);
          console.log('');
        });
      }
      resolve(rows);
    });
  });
}

function showAllMemories() {
  return new Promise((resolve, reject) => {
    console.log('📚 ALL CAPTURED MEMORIES');
    console.log('─'.repeat(50));
    
    const sql = `
      SELECT 
        datetime(ts, 'unixepoch') as timestamp,
        app,
        window_title,
        ocr_text
      FROM memories 
      ORDER BY ts DESC
    `;
    
    db.all(sql, [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      console.log(`📊 Total memories stored: ${rows.length}\n`);
      
      rows.forEach((row, i) => {
        console.log(`📱 Memory ${i + 1}:`);
        console.log(`   ⏰ Time: ${row.timestamp}`);
        console.log(`   📱 App: ${row.app}`);
        console.log(`   🪟 Window: ${row.window_title}`);
        console.log(`   📝 Content: ${row.ocr_text}`);
        console.log('');
      });
      
      resolve(rows);
    });
  });
}

// Run demo
async function runDemo() {
  try {
    // Show all memories first
    await showAllMemories();
    
    // Demo searches
    console.log('\n🎯 SEARCH DEMONSTRATIONS');
    console.log('='.repeat(50));
    
    await searchMemories('Memory');
    await searchMemories('database');
    await searchMemories('verification');
    await searchMemories('Terminal');
    await searchMemories('Cursor');
    
    console.log('🎉 Demo complete! Your photographic memory is working!');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    db.close();
  }
}

runDemo();
