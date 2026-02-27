const http = require('http');
const url = require('url');
const { spawn } = require('child_process');

const PORT = 3004;

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  
  if (parsedUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', 
      type: 'raw_screenpipe',
      timestamp: Date.now() 
    }));
    return;
  }
  
  if (parsedUrl.pathname === '/search') {
    const query = parsedUrl.query.q;
    
    if (!query) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ cards: [] }));
      return;
    }

    console.log(`🔍 Searching for: "${query}"`);
    
    // Use sqlite3 to search raw Screenpipe database
    const sqlQuery = `SELECT frame_id, text, app_name, window_name FROM ocr_text WHERE text LIKE '%${query}%' ORDER BY frame_id DESC LIMIT 10`;
    
    const sqlite = spawn('sqlite3', [
      './data/db.sqlite',
      sqlQuery
    ]);
    
    let output = '';
    sqlite.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    sqlite.on('close', (code) => {
      const lines = output.trim().split('\n').filter(line => line);
      
      const cards = lines.map((line, index) => {
        const parts = line.split('|');
        const frameId = parts[0] || 'unknown';
        const text = (parts[1] || '').replace(/[^\x20-\x7E]/g, ' ').trim(); // Clean non-ASCII chars
        const appName = (parts[2] || 'Unknown App').trim();
        const windowName = (parts[3] || '').trim();
        
        // Extract meaningful snippet from text
        let snippet = text;
        if (text.length > 150) {
          // Try to find the query in the text and get context around it
          const queryIndex = text.toLowerCase().indexOf(query.toLowerCase());
          if (queryIndex !== -1) {
            const start = Math.max(0, queryIndex - 50);
            const end = Math.min(text.length, queryIndex + 100);
            snippet = '...' + text.substring(start, end) + '...';
          } else {
            snippet = text.substring(0, 150) + '...';
          }
        }
        
        return {
          id: `raw_${frameId}`,
          title: windowName || appName || `Memory ${frameId}`,
          titleSnippet: snippet.substring(0, 60),
          app: appName || 'Screen Capture',
          text: snippet,
          timestamp: new Date().toISOString(),
          relativeTime: `Frame ${frameId}`,
          hasScreenshot: true,
          screenshotUrl: `http://localhost:3030/frames/${frameId}`,
          thumbnailUrl: `http://localhost:3030/frames/${frameId}`,
          confidence: 0.8,
          frameId: parseInt(frameId)
        };
      });
      
      console.log(`📊 Found ${cards.length} results`);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        cards,
        mode: 'raw_screenpipe',
        query,
        total: cards.length
      }));
    });
    
    sqlite.on('error', (err) => {
      console.error('SQLite error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Search failed' }));
    });
    
    return;
  }
  
  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`🚀 Raw Screenpipe Search running on http://localhost:${PORT}`);
  console.log(`🔍 Try: http://localhost:${PORT}/search?q=calendar`);
});
