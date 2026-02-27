#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Connect to raw Screenpipe database
const db = new sqlite3.Database('./data/db.sqlite', sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Failed to connect to Screenpipe database:', err);
    process.exit(1);
  }
  console.log('✅ Connected to raw Screenpipe database');
});

// Search endpoint
app.get('/search', (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.json({ cards: [], mode: 'raw_screenpipe' });
  }

  console.log(`🔍 Searching for: "${query}"`);

  // Search in raw OCR text with FTS if available, otherwise LIKE
  const searchQuery = `
    SELECT 
      frame_id,
      text,
      app_name,
      window_name,
      CASE 
        WHEN LENGTH(text) > 200 THEN SUBSTR(text, 1, 200) || '...'
        ELSE text
      END as snippet
    FROM ocr_text 
    WHERE text LIKE '%' || ? || '%' 
    ORDER BY frame_id DESC 
    LIMIT 20
  `;

  db.all(searchQuery, [query], (err, rows) => {
    if (err) {
      console.error('Search error:', err);
      return res.status(500).json({ error: 'Search failed' });
    }

    const cards = rows.map((row, index) => ({
      id: `raw_${row.frame_id}`,
      title: row.window_name || row.app_name || 'Unknown App',
      app: row.app_name || 'Unknown',
      text: row.snippet,
      timestamp: new Date().toISOString(), // Placeholder
      relativeTime: `Frame ${row.frame_id}`,
      hasScreenshot: true, // We can get screenshots from Screenpipe API
      screenshotUrl: `http://localhost:3030/frames/${row.frame_id}`,
      confidence: 0.8,
      frameId: row.frame_id
    }));

    console.log(`📊 Found ${cards.length} results`);
    
    res.json({
      cards,
      mode: 'raw_screenpipe',
      query,
      total: cards.length
    });
  });
});

// Health check
app.get('/health', (req, res) => {
  db.get('SELECT COUNT(*) as total FROM ocr_text', (err, row) => {
    if (err) {
      return res.status(500).json({ status: 'error', error: err.message });
    }
    
    res.json({
      status: 'healthy',
      database: {
        total_records: row.total,
        type: 'raw_screenpipe'
      },
      timestamp: Date.now()
    });
  });
});

const PORT = 3003;
app.listen(PORT, () => {
  console.log(`🚀 Raw Screenpipe Search API running on http://localhost:${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`🔍 Search: http://localhost:${PORT}/search?q=your_query`);
});


