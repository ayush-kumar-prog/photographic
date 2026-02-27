#!/bin/bash

echo "🧠 PHOTOGRAPHIC MEMORY DEMO"
echo "============================"
echo ""

DB_PATH="data/sqlite/memories.db"

echo "📚 ALL CAPTURED MEMORIES"
echo "────────────────────────────────────────────────"

# Count total memories
TOTAL=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM memories;")
echo "📊 Total memories stored: $TOTAL"
echo ""

# Show all memories
echo "📱 Your captured memories:"
sqlite3 "$DB_PATH" "
SELECT 
  '📱 Memory ' || ROW_NUMBER() OVER (ORDER BY ts DESC) || ':' as header,
  '   ⏰ Time: ' || datetime(ts, 'unixepoch') as time,
  '   📱 App: ' || app as application,
  '   🪟 Window: ' || window_title as window,
  '   📝 Content: ' || CASE 
    WHEN length(ocr_text) > 100 
    THEN substr(ocr_text, 1, 100) || '...'
    ELSE ocr_text 
  END as content,
  '' as separator
FROM memories 
ORDER BY ts DESC;
"

echo ""
echo "🎯 SEARCH DEMONSTRATIONS"
echo "════════════════════════════════════════════════"

# Demo search function
search_demo() {
  local query="$1"
  echo ""
  echo "🔍 Searching for: \"$query\""
  echo "──────────────────────────────────────────────"
  
  RESULTS=$(sqlite3 "$DB_PATH" "
    SELECT COUNT(*) 
    FROM memories_fts 
    JOIN memories m ON memories_fts.id = m.id 
    WHERE memories_fts MATCH '$query';
  ")
  
  if [ "$RESULTS" -eq 0 ]; then
    echo "❌ No memories found"
  else
    echo "✅ Found $RESULTS memory(ies):"
    echo ""
    sqlite3 "$DB_PATH" "
      SELECT 
        '📱 Match:' as header,
        '   ⏰ Time: ' || datetime(m.ts, 'unixepoch') as time,
        '   📱 App: ' || m.app as application,
        '   🪟 Window: ' || m.window_title as window,
        '   📝 Content: ' || m.ocr_text as content,
        '' as separator
      FROM memories_fts 
      JOIN memories m ON memories_fts.id = m.id 
      WHERE memories_fts MATCH '$query' 
      ORDER BY m.ts DESC;
    "
  fi
}

# Run search demos
search_demo "Memory"
search_demo "database" 
search_demo "verification"
search_demo "Terminal"
search_demo "Cursor"
search_demo "Photographic"

echo ""
echo "🎉 Demo complete! Your photographic memory is working!"
echo ""
echo "💡 What you just saw:"
echo "   ✅ Screen content capture and storage"
echo "   ✅ Full-text search across all memories"
echo "   ✅ Timestamp tracking"
echo "   ✅ App and window identification"
echo "   ✅ OCR text extraction"
echo ""
echo "🚀 Next: Start the REST API services for web interface!"
