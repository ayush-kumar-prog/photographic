# LLM Implementation Prompt for Photographic Memory Desktop App

## Context for New LLM Session

You are taking over development of a "Photographic Memory" desktop app that captures and searches visual computer history. The system is 80% built but has critical bugs preventing the core functionality from working.

## Essential Files to Read First

**CRITICAL - Read these files in this order:**

1. **`docs/COMPLETE-TECHNICAL-CONTEXT.md`** - Complete technical diagnosis and exact fixes needed
2. **`docs/CURRENT-STATE-VS-VISION.md`** - What we built vs what we wanted  
3. **`docs/debugging-session-complete.md`** - Full debugging session history

**SUPPORTING CONTEXT:**
4. **`services/ingest-bridge/src/index.ts`** - Main service with bugs
5. **`services/ingest-bridge/src/screenpipe/client.ts`** - API client 
6. **`apps/overlay-macos/Sources/MemoryOverlay/Models.swift`** - UI models
7. **`README.md`** - Project overview

## Current System Status

### ✅ What Works
- **Screenpipe**: Captures ALL apps (30+) including Cursor, Terminal, Chrome
- **Search API**: Returns results when data exists (port 3032)
- **SwiftUI Overlay**: UI displays results correctly, hotkey ⌘⇧" works
- **Database**: SQLite + ChromaDB structure is correct

### 🔴 Critical Bugs (Must Fix)
1. **Ingest Bridge Selective Storage**: Only stores 13 apps despite Screenpipe capturing 30+
2. **No Screenshot Storage**: System only stores OCR text, no visual memories
3. **Content Not Indexed**: OCR text stored but not searchable
4. **UI Shows Text Not Images**: Memory cards show app names, not screenshots

### 🎯 The Vision vs Reality Gap

**INTENDED**: User searches "blue dress amazon" → sees screenshots of Amazon pages with blue dresses
**CURRENT**: User searches "amazon" → opens Amazon app (glorified app launcher)

## Your Mission

Fix the 4 critical bugs in this exact order:

### Phase 1: Debug Ingest Bridge App Filtering (URGENT)
**Problem**: Screenpipe captures Cursor, Terminal, Chrome but Ingest Bridge doesn't store them
**Evidence**: 
```sql
-- Database has only:
App Store|92, Audible|49, Eclipse|92
-- Missing completely:
Cursor|0, Terminal|0, Google Chrome|0
```

**Action**: Add comprehensive logging to `services/ingest-bridge/src/index.ts` to find why apps are filtered out

### Phase 2: Implement Screenshot Pipeline
**Problem**: No visual memories stored or displayed
**Action**: Create screenshot extraction from video files and storage system

### Phase 3: Fix Content Indexing  
**Problem**: Can't search OCR content, only app names
**Action**: Fix FTS5 indexing to make OCR text searchable

### Phase 4: Update UI for Visual Display
**Problem**: Shows text cards instead of screenshot thumbnails
**Action**: Update SwiftUI to display images with AsyncImage

## Key Technical Details

### Architecture
```
Screenpipe (port 3030) → Ingest Bridge (port 3001) → SQLite + ChromaDB → Search API (port 3032) → SwiftUI Overlay
```

### Current Evidence of the Bug
- **Screenpipe API**: `curl localhost:3030/search` returns 30+ apps including Cursor/Terminal
- **Database**: Only 13 apps stored, missing all development tools
- **Search**: "terminal" returns 0 results despite heavy Terminal usage
- **UI**: Only shows "Audible" type results, launches apps instead of showing memories

### Environment
- **Project Root**: `/Users/kumar/Documents/Projects/memories`
- **Database**: `data/sqlite/memories.db` 
- **ChromaDB**: Docker container on port 8000
- **Video Files**: `data/data/*.mp4` (many missing, causing ENOENT errors)

## Success Criteria

After your fixes:
- ✅ Search "terminal" → See terminal screenshots with commands
- ✅ Search "blue dress" → See shopping screenshots  
- ✅ All 30+ apps stored in database
- ✅ Visual memory cards with thumbnails
- ✅ True photographic memory, not app launcher

## Development Commands

```bash
# Start services
cd /Users/kumar/Documents/Projects/memories
pnpm start:screenpipe --background
cd services/ingest-bridge && source ../../.env && OPENAI_API_KEY="$OPENAI_API_KEY" node dist/index.js
cd services/search-api && source ../../.env && npm start
cd apps/overlay-macos && swift run

# Debug database
sqlite3 data/sqlite/memories.db "SELECT DISTINCT app, COUNT(*) FROM memories GROUP BY app ORDER BY COUNT(*) DESC;"

# Test Screenpipe
curl "http://localhost:3030/search?q=&limit=100" | jq '[.data[].content.app_name] | group_by(.) | map({app: .[0], count: length})'
```

## Critical Path

**START WITH PHASE 1** - The Ingest Bridge bug is blocking everything. 70% of user activity is missing. Without fixing this first, implementing screenshots and content search is pointless.

Add logging, find the filtering issue, fix it, then move to visual implementation.

The system architecture is sound - this is purely a debugging and implementation task, not a redesign.


