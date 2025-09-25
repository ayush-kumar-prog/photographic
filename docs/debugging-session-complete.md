# Complete Debugging Session: Photographic Memory Desktop App
## Date: September 25, 2025

## Executive Summary
This document captures a comprehensive debugging session for the Photographic Memory Desktop App - a multi-service system that captures screen content, processes it into searchable memories, and provides an overlay UI for instant memory retrieval. The session involved fixing critical path issues, service configuration problems, and API response structure mismatches.

## System Architecture Overview

### Components
1. **Screenpipe** - Screen capture service (0.5 FPS, OCR via Apple Native)
   - Port: 3030
   - Status API: `/health`
   - Search API: `/search`
   
2. **Ingest Bridge** - Data processing pipeline
   - Port: 3001 (configured but not used when started manually)
   - Polls Screenpipe every 10 seconds
   - Stores in SQLite (FTS5) and ChromaDB
   - Generates thumbnails
   
3. **Search API** - Query service
   - Port: 3032 (default, should be 3002 per config)
   - Hybrid search (keyword + semantic)
   - Confidence scoring
   
4. **ChromaDB** - Vector database
   - Port: 8000
   - Docker container
   - Stores embeddings for semantic search
   
5. **SwiftUI Overlay** - macOS UI
   - Global hotkey: ⌘⇧" (Command+Shift+Quote)
   - "Liquid glass" memory cards
   - Real-time search as you type

## Critical Issues Discovered and Fixed

### 1. Screenpipe Health Status Mismatch
**Problem**: Screenpipe returns "degraded" status when UI monitoring is disabled, but frame capture still works.

**Discovery**: 
```json
{
  "status": "degraded",
  "frame_status": "ok",
  "ui_status": "not_started"
}
```

**Fix Applied**: Modified Ingest Bridge to accept "degraded" status if `frame_status` is "ok":
```typescript
// services/ingest-bridge/src/index.ts
const isFrameCaptureWorking = health.frame_status === 'ok';
const isAcceptableStatus = health.status === 'healthy' || 
  (health.status === 'degraded' && isFrameCaptureWorking);
```

**Interface Update**: Added 'degraded' to ScreenpipeHealthStatus type:
```typescript
export interface ScreenpipeHealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  // ...
}
```

### 2. Screenpipe Crashing with Corrupted Videos
**Problem**: Screenpipe crashes with "moov atom not found" and "ffmpeg process failed" errors when trying to extract frames from corrupted video files.

**Root Cause**: Some video files in `data/data/` directory were corrupted, causing ffmpeg to fail when Screenpipe tried to extract frames for API responses.

**Fix Applied**: Disabled frame extraction in API calls:
```typescript
// services/ingest-bridge/src/screenpipe/client.ts
const query: ScreenpipeSearchQuery = {
  limit,
  offset: 0,
  content_type: 'ocr',
  include_frames: false // Disable frame extraction to prevent crashes
};
```

**Impact**: Thumbnails are still generated separately by the Ingest Bridge using a different process that handles errors gracefully.

### 3. Invalid Timestamp Errors
**Problem**: "Invalid time value" errors when creating Date objects from Screenpipe timestamps.

**Fix Applied**: Added validation before using timestamps:
```typescript
if (sinceTimestamp && !isNaN(sinceTimestamp) && sinceTimestamp > 0) {
  query.start_time = new Date(sinceTimestamp).toISOString();
}
```

### 4. Screenpipe API Response Structure Change
**Problem**: Screenpipe API response structure changed - fields are now nested under a `content` object.

**Discovery**: The API now returns:
```json
{
  "type": "OCR",
  "content": {
    "frame_id": 123,
    "text": "...",
    "timestamp": "...",
    // other fields
  }
}
```

**Fix Applied**: Updated data mapping to handle nested structure:
```typescript
for (const match of result.data) {
  const content = match.content || match; // Handle both old and new structure
  const timestamp = new Date(content.timestamp).getTime();
  // ... map fields from content object
}
```

### 5. Database Path Issue - Critical for Distribution
**Problem**: Ingest Bridge was creating database in service subdirectory (`services/ingest-bridge/data/sqlite/memories.db`) instead of project root (`data/sqlite/memories.db`).

**Root Cause**: When running from `services/ingest-bridge/`, relative paths were interpreted from that directory.

**Initial Incorrect Fix Attempt**:
```typescript
// This created path: /services/data/sqlite/memories.db (WRONG!)
const projectRoot = path.resolve(__dirname, '../../..');
```

**Correct Fix Applied**:
```typescript
// services/ingest-bridge/src/database/manager.ts
constructor(dataDir: string = '../../data/sqlite') {
  // Running from services/ingest-bridge/dist, need 4 levels up
  const projectRoot = process.env.PROJECT_ROOT || path.resolve(__dirname, '../../../..');
  this.dataDir = path.resolve(projectRoot, 'data/sqlite');
  this.dbPath = path.join(this.dataDir, 'memories.db');
}
```

**Why This Matters**: For a distributable application, we need relative paths that work regardless of installation location. Absolute paths would break on different machines.

### 6. Video Processing Blocking Event Processing
**Problem**: Missing video files caused entire event processing to fail.

**Fix Applied**: Wrapped video processing in try-catch to make it non-blocking:
```typescript
if (event.media_path) {
  try {
    const videoResult = await this.videoProcessor.processVideoFile(
      event.media_path, 
      event.ocr_text
    );
    // ... process video
  } catch (error) {
    logger.warn('Video processing failed, continuing without video data', {
      eventId: event.id,
      mediaPath: event.media_path,
      error: error instanceof Error ? error.message : String(error)
    });
    // Continue processing the event without video data
    shouldKeepVideo = false;
    videoProcessingInfo = null;
  }
}
```

### 7. Environment Variable Loading Issue
**Problem**: Services don't automatically load `.env` file when started via `pnpm start` commands.

**Workaround**: Start services with explicit environment variable:
```bash
cd services/ingest-bridge && source ../../.env && OPENAI_API_KEY="$OPENAI_API_KEY" node dist/index.js
```

**Long-term Fix Needed**: Add dotenv loading to service initialization or update package.json scripts.

### 8. Search API Port Discrepancy
**Problem**: Search API defaults to port 3032 instead of configured 3002.

**Code**:
```typescript
const port = parseInt(process.env.SEARCH_API_PORT || '3032');
```

**Impact**: SwiftUI overlay might be looking for API on wrong port. Need to verify overlay configuration.

## Current System State

### What's Working ✅
1. **Screenpipe**: Capturing screens at 0.5 FPS
2. **Ingest Bridge**: Processing events, storing in correct database path
3. **Database**: 170+ memories stored and growing
4. **ChromaDB**: 799+ documents with embeddings
5. **Search API**: Responding to queries on port 3032
6. **SwiftUI Overlay**: UI loads, searches are being made

### What's Not Working ❌
1. **Memory Display**: Search returns 0 results for queries like "terminal", "BBC", "amazon"
2. **API Response Mismatch**: SwiftUI expects `titleSnippet` field but API doesn't provide it
3. **Multiple Ingest Bridge Processes**: Shows 3 running (likely from restart attempts)

## Search Issue Analysis

From the terminal logs, we can see:

### Search API Side:
```
info: Search completed: query="terminal", mode=jog, confidence=0.000, results=0
info: Search completed: query="BBC", mode=jog, confidence=0.311, results=1
```

### SwiftUI Overlay Side:
```
🔍 Performing search for: 'terminal'
✅ Real search results loaded: 0 results

🔍 Performing search for: 'BBC'
⚠️ Failed to decode search response: keyNotFound(CodingKeys(stringValue: "titleSnippet", intValue: nil)
🎭 Using mock data for development
```

### Key Discovery: API Response Structure Mismatch
The SwiftUI overlay expects a `titleSnippet` field that the Search API isn't providing. When decoding fails, it falls back to mock data.

## Video File Path Structure Issue
**Observation**: Screenpipe stores videos in `data/data/` (double nesting)
- Expected: `/Users/kumar/Documents/Projects/memories/data/monitor_1_*.mp4`
- Actual: `/Users/kumar/Documents/Projects/memories/data/data/monitor_1_*.mp4`

**Reason**: Screenpipe is configured with `--data-dir ./data` and creates its own `data` subdirectory inside.

**Impact**: Non-critical - video warnings are non-blocking thanks to our fixes.

## Commands and Procedures

### Starting Services (Correct Order)
```bash
# 1. Start ChromaDB (if not running)
docker run -d --name chromadb -p 8000:8000 chromadb/chroma:latest

# 2. Start Screenpipe
pnpm start:screenpipe --background

# 3. Start Ingest Bridge (with env vars)
cd services/ingest-bridge && source ../../.env && OPENAI_API_KEY="$OPENAI_API_KEY" node dist/index.js &

# 4. Start Search API (with env vars)
cd services/search-api && source ../../.env && OPENAI_API_KEY="$OPENAI_API_KEY" npm start &

# 5. Start SwiftUI Overlay
cd apps/overlay-macos && swift run
```

### Killing All Services
```bash
pkill -f screenpipe
pkill -f "node.*dist"
pkill -f MemoryOverlay
docker stop chromadb && docker rm chromadb
```

### Verification Commands
```bash
# Check all services
ps aux | grep -E "(screenpipe|node.*dist|MemoryOverlay)" | grep -v grep

# Check service health
curl -s http://localhost:3030/health | jq .  # Screenpipe
curl -s http://localhost:3032/health | jq .  # Search API
docker ps | grep chromadb                     # ChromaDB

# Check database
sqlite3 data/sqlite/memories.db "SELECT COUNT(*) FROM memories;"
```

## File Structure Discoveries

### Database Locations
- **Correct**: `/Users/kumar/Documents/Projects/memories/data/sqlite/memories.db`
- **Incorrect** (old): `/Users/kumar/Documents/Projects/memories/services/ingest-bridge/data/sqlite/memories.db`

### Important Files Modified
1. `services/ingest-bridge/src/index.ts` - Health check logic, video processing try-catch
2. `services/ingest-bridge/src/screenpipe/client.ts` - API response mapping, frame extraction disable
3. `services/ingest-bridge/src/database/manager.ts` - Database path resolution
4. `services/ingest-bridge/src/embeddings/service.ts` - ChromaDB path resolution

## Permissions Required
- **Screen Recording**: Terminal needs to be added to System Settings > Privacy & Security > Screen & System Audio Recording
- **Accessibility**: For UI monitoring (currently disabled with `--disable-ui-monitoring`)

## Next Steps to Fix Memory Display

### 1. Investigate API Response Format
The Search API needs to provide the fields expected by SwiftUI:
- `titleSnippet` (currently missing)
- Verify other required fields match

### 2. Check Search API Database Connection
The Search API health shows only 10 memories while the actual database has 170+. Need to verify:
- Is Search API using the correct database path?
- Is it using the same database as Ingest Bridge?

### 3. Debug Search Query Processing
- Why are some queries returning 0 results when memories exist?
- Check if FTS5 indexing is working correctly
- Verify embedding search is functioning

### 4. Fix Port Configuration
- Search API should use port 3002 (from .env) not 3032
- Verify SwiftUI overlay is connecting to correct port

## Lessons Learned

1. **Path Resolution in Distributed Apps**: Always consider how relative paths resolve from different execution contexts. Use environment variables or careful path calculation.

2. **Graceful Degradation**: Services should handle partial failures (like video processing) without blocking core functionality.

3. **API Contract Validation**: When services communicate, ensure response structures match expectations. Missing fields can cause complete failures.

4. **Health Check Flexibility**: Accept degraded states when core functionality still works.

5. **Environment Variable Loading**: Don't assume .env files are automatically loaded - be explicit in service initialization.

6. **Error Isolation**: Wrap risky operations (file I/O, external API calls) in try-catch blocks to prevent cascading failures.

## Current Test Query Status
- "terminal" → 0 results (should have many)
- "BBC" → 1 result found but UI can't decode it
- "amazon" → 0 results
- "cursor" → 0 results (despite being used extensively)

## System Performance Metrics
- Memory ingestion rate: ~10 events every 6-10 seconds
- Database growth: From 0 to 170+ memories in ~30 minutes
- ChromaDB documents: 799+ and growing
- Search response time: 400-750ms average

## Conclusion
The system is functionally complete but has a critical API response format mismatch preventing the UI from displaying search results. All services are running, data is being captured and stored correctly, but the final step of displaying memories to the user is blocked by the missing `titleSnippet` field in the Search API response.
