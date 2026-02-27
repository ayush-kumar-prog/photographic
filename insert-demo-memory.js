const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

// Connect to the memories database
const db = new sqlite3.Database('./data/sqlite/memories.db', (err) => {
  if (err) {
    console.error('Failed to connect:', err);
    process.exit(1);
  }
  console.log('Connected to database');
});

// Create demo memories for Cory Levy
const demoMemories = [
  {
    id: 'demo_cory_calendar_' + Date.now(),
    ts: Math.floor(Date.now() / 1000) - 300, // 5 minutes ago
    app: 'Google Chrome',
    window_title: 'Invitation: Ayush and Cory Levy @ Fri Sep 26, 2025',
    url: 'https://mail.google.com/mail/u/2/',
    url_host: 'mail.google.com',
    ocr_text: `Invitation: Ayush and Cory Levy @ Fri Sep 26, 2025 7:50pm - 8pm (BST)
    
Today • 7:50 PM – 8:00 PM
Ayush and Cory Levy

Google Meet (instructions in description)
cory@corylevy.com - Organizer

Event Name: 1-1 in Sept
Location: This is a Google Meet web conference.
Meeting link: meet.google.com/tap-bfbz-jtp

Join by phone:
(US) +1 443-593-4491
PIN: 247007225

Please share anything that will help prepare for our meeting.`,
    video_processed: 1,
    video_kept: 1
  },
  {
    id: 'demo_cory_search_' + Date.now(),  
    ts: Math.floor(Date.now() / 1000) - 600, // 10 minutes ago
    app: 'Google Chrome',
    window_title: 'cory levy - Google Search',
    url: 'https://www.google.com/search?q=cory+levy',
    url_host: 'google.com',
    ocr_text: `cory levy founder After School
    
Cory Levy - Co-founder of After School
Entrepreneur, Angel Investor
Previous: Z Fellows, Product Hunt
Stanford University Graduate
Twitter: @corylevy
LinkedIn: Cory Levy
Notable investments: Figma, Notion, Superhuman`,
    video_processed: 1,
    video_kept: 1
  }
];

// Insert demo memories
demoMemories.forEach(memory => {
  // First, try to delete any existing demo memory
  db.run('DELETE FROM memories WHERE id LIKE "demo_%"', [], (err) => {
    if (err) console.log('Clean up error (ok if none exist):', err.message);
    
    // Insert the new memory
    const sql = `
      INSERT INTO memories (
        id, ts, app, window_title, url, url_host, 
        ocr_text, video_processed, video_kept
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.run(sql, [
      memory.id,
      memory.ts,
      memory.app,
      memory.window_title,
      memory.url,
      memory.url_host,
      memory.ocr_text,
      memory.video_processed,
      memory.video_kept
    ], function(err) {
      if (err) {
        console.error('Failed to insert:', err);
      } else {
        console.log(`✅ Inserted demo memory: ${memory.window_title}`);
      }
    });
  });
});

// Wait a bit then close
setTimeout(() => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Database connection closed.');
  });
}, 2000);


