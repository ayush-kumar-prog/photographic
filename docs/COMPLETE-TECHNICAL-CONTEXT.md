# Complete Technical Context: Photographic Memory Desktop App
## Date: September 25, 2025

## 🎯 Executive Summary

We built a "Photographic Memory" desktop app that was supposed to let users search their visual computer history with natural language queries like "blue dress amazon" or "recipe pasta yesterday". Instead, we accidentally built a glorified app launcher that only searches app names, not content, and doesn't store or display any screenshots.

## 📊 Current System Architecture

```
User Screen (ALL apps captured by Screenpipe)
    ↓
Screenpipe (Captures OCR + Screenshots at 0.5 FPS)
    ↓
Ingest Bridge (BUG: Only stores 13 specific apps)
    ↓
SQLite Database (Stores app names, not content)
    ↓
Search API (Searches app names only)
    ↓
SwiftUI Overlay (Shows text cards, not screenshots)
    ↓
User sees: "Audible" → Opens Audible app ❌
```

## 🔴 Critical Bugs That Must Be Fixed

### Bug #1: Ingest Bridge Selective Storage
**Location**: `services/ingest-bridge/src/index.ts`
**Issue**: Only 13 apps are stored in database despite Screenpipe capturing 30+ apps
**Evidence**:
```sql
-- Apps in database:
App Store|92
Audible|49
Eclipse|92
-- Missing completely:
Cursor|0
Terminal|0
Google Chrome|0
```
**Root Cause**: Unknown filtering or processing error in Ingest Bridge
**Impact**: Missing 70% of user activity including all browser and development work

### Bug #2: No Screenshot Storage
**Issue**: System only stores OCR text, no visual memories
**Evidence**: No screenshot files exist, only placeholder thumbnails
**Impact**: Cannot show visual memories - the core feature

### Bug #3: Content Not Indexed
**Location**: `services/ingest-bridge/src/database/manager.ts`
**Issue**: OCR text stored but not searchable
**Evidence**: Searching "terminal" returns 0 results despite Terminal being used
**Impact**: Can only search by app name, not content

### Bug #4: UI Shows Text Not Images
**Location**: `apps/overlay-macos/Sources/MemoryOverlay/MemoryCard.swift`
**Issue**: Memory cards show text only, no screenshots
**Impact**: Not a visual memory browser

## ✅ What's Actually Working

1. **Screenpipe**: Capturing ALL apps correctly including Cursor, Terminal, Chrome
   - Proof: `curl http://localhost:3030/search` returns all apps
   - OCR extraction working
   - Frame capture working at 0.5 FPS

2. **Search API**: Returns results when data exists
   - Working on port 3032
   - Hybrid search functional
   - API response structure fixed (snake_case → camelCase)

3. **SwiftUI Overlay**: UI displays results correctly
   - Fixed decoding issue with CodingKeys
   - Shows results for apps that ARE in database
   - Hotkey ⌘⇧" working

4. **Database Structure**: Tables and FTS5 working
   - Correct path: `/Users/kumar/Documents/Projects/memories/data/sqlite/memories.db`
   - ChromaDB storing embeddings

## 🛠 Exact Fixes Required

### Fix 1: Debug & Fix Ingest Bridge App Filtering

**File**: `services/ingest-bridge/src/index.ts`

**Add debugging to find why apps are filtered**:
```typescript
private async processNewEvents(events: ScreenpipeEvent[]): Promise<void> {
  // ADD: Log all incoming apps
  const appCounts = events.reduce((acc, e) => {
    acc[e.app] = (acc[e.app] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  logger.info('Incoming events by app:', appCounts);

  for (const event of events) {
    try {
      // ADD: Log each app being processed
      logger.debug('Processing event from app:', event.app);
      
      if (!this.validateEvent(event)) {
        // ADD: Log why validation failed
        logger.warn('Event validation failed', {
          app: event.app,
          hasId: !!event.id,
          hasTimestamp: !!event.timestamp,
          hasApp: !!event.app,
          hasOcrText: !!event.ocr_text
        });
        continue;
      }

      // ADD: Log successful storage
      const stored = await this.databaseManager.storeMemory(memory);
      logger.debug('Memory stored for app:', event.app, 'success:', stored);
    } catch (error) {
      // ADD: Log which apps fail
      logger.error('Failed to process event from app:', event.app, error);
    }
  }
}
```

**Hypothesis**: The issue might be:
1. Video processing timeout for certain apps
2. Special characters in app names causing database errors
3. Rate limiting or batch size issues
4. Silent failures in the storage pipeline

### Fix 2: Implement Screenshot Pipeline

**New File**: `services/ingest-bridge/src/screenshots/service.ts`

```typescript
import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class ScreenshotService {
  private screenshotDir: string;
  private thumbnailDir: string;

  constructor() {
    const projectRoot = process.env.PROJECT_ROOT || path.resolve(__dirname, '../../../..');
    this.screenshotDir = path.join(projectRoot, 'data/screenshots');
    this.thumbnailDir = path.join(projectRoot, 'data/thumbnails');
    this.ensureDirectories();
  }

  async ensureDirectories() {
    await fs.mkdir(this.screenshotDir, { recursive: true });
    await fs.mkdir(this.thumbnailDir, { recursive: true });
  }

  async extractAndStoreScreenshot(
    videoPath: string,
    eventId: string,
    timestamp: number
  ): Promise<{ screenshot: string; thumbnail: string } | null> {
    try {
      const screenshotPath = path.join(this.screenshotDir, `${eventId}.jpg`);
      const thumbnailPath = path.join(this.thumbnailDir, `${eventId}_thumb.jpg`);

      // Extract frame from video using ffmpeg
      await execAsync(
        `ffmpeg -i "${videoPath}" -vframes 1 -q:v 2 "${screenshotPath}" -y`
      );

      // Generate thumbnail using sharp
      await sharp(screenshotPath)
        .resize(400, 300, { fit: 'inside' })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);

      return {
        screenshot: screenshotPath,
        thumbnail: thumbnailPath
      };
    } catch (error) {
      logger.error('Failed to extract screenshot:', error);
      return null;
    }
  }

  async getScreenshotUrl(eventId: string): string {
    // Return URL path for API to serve
    return `/screenshots/${eventId}.jpg`;
  }
}
```

**Update**: `services/ingest-bridge/src/index.ts`

```typescript
import { ScreenshotService } from './screenshots/service';

class IngestBridge {
  private screenshotService: ScreenshotService;

  constructor() {
    this.screenshotService = new ScreenshotService();
  }

  private async processEvent(event: ScreenpipeEvent) {
    // Extract and store screenshot
    let screenshotPaths = null;
    if (event.media_path) {
      screenshotPaths = await this.screenshotService.extractAndStoreScreenshot(
        event.media_path,
        event.id,
        event.timestamp
      );
    }

    // Store memory with screenshot paths
    const memory: MemoryObject = {
      ...existingMemoryFields,
      screenshot_path: screenshotPaths?.screenshot || null,
      thumbnail_path: screenshotPaths?.thumbnail || null
    };
  }
}
```

### Fix 3: Index Full OCR Content

**File**: `services/ingest-bridge/src/database/manager.ts`

**Current Problem**: OCR text not being properly indexed for search

```typescript
async storeMemory(memory: MemoryObject): Promise<void> {
  const stmt = this.db.prepare(`
    INSERT INTO memories (
      id, ts, app, url, window_title, 
      ocr_text, focused, screenshot_path, thumbnail_path
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    memory.id,
    memory.timestamp,
    memory.app,
    memory.url || null,
    memory.window_title || null,
    memory.ocr_text, // ENSURE FULL TEXT IS STORED
    memory.focused ? 1 : 0,
    memory.screenshot_path || null,
    memory.thumbnail_path || null
  );

  // Update FTS5 index with full content
  const ftsStmt = this.db.prepare(`
    INSERT INTO memories_fts (id, app, window_title, ocr_text)
    VALUES (?, ?, ?, ?)
  `);
  
  ftsStmt.run(
    memory.id,
    memory.app,
    memory.window_title || '',
    memory.ocr_text // INDEX FULL OCR TEXT
  );
}
```

**Update Search**: `services/search-api/src/services/search.ts`

```typescript
async search(query: string): Promise<SearchResult[]> {
  // Search OCR content, not just app names
  const sql = `
    SELECT m.*, 
           snippet(memories_fts, -1, '<mark>', '</mark>', '...', 32) as snippet
    FROM memories m
    JOIN memories_fts ON m.id = memories_fts.id
    WHERE memories_fts MATCH ?
    ORDER BY rank
    LIMIT 50
  `;
  
  const results = this.db.prepare(sql).all(query);
  
  return results.map(row => ({
    id: row.id,
    ts: row.ts,
    app: row.app,
    title_snippet: row.snippet, // Return actual content snippet
    screenshot_url: `/api/screenshots/${row.id}.jpg`,
    thumbnail_url: `/api/thumbnails/${row.id}_thumb.jpg`,
    ocr_text: row.ocr_text,
    score: row.rank
  }));
}
```

### Fix 4: Update UI to Display Screenshots

**File**: `apps/overlay-macos/Sources/MemoryOverlay/Models.swift`

```swift
struct SearchResult: Identifiable, Codable, Equatable {
    let id: String
    let ts: Int64
    let app: String
    let urlHost: String?
    let titleSnippet: String
    let screenshotUrl: String?  // ADD
    let thumbnailUrl: String?   // ADD
    let ocrText: String?        // ADD
    let score: Double
    let nugget: Nugget?
    
    enum CodingKeys: String, CodingKey {
        case id, ts, app
        case urlHost = "url_host"
        case titleSnippet = "title_snippet"
        case screenshotUrl = "screenshot_url"  // ADD
        case thumbnailUrl = "thumbnail_url"    // ADD
        case ocrText = "ocr_text"              // ADD
        case score, nugget
    }
}
```

**File**: `apps/overlay-macos/Sources/MemoryOverlay/MemoryCard.swift`

```swift
struct MemoryCard: View {
    let memory: SearchResult
    @State private var loadingImage = true
    @State private var image: NSImage?
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Screenshot thumbnail
            if let thumbnailUrl = memory.thumbnailUrl {
                AsyncImage(url: URL(string: "http://localhost:3032\(thumbnailUrl)")) { phase in
                    switch phase {
                    case .empty:
                        ProgressView()
                            .frame(height: 200)
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(maxHeight: 200)
                            .cornerRadius(8)
                    case .failure(_):
                        Image(systemName: "photo")
                            .frame(height: 200)
                    @unknown default:
                        EmptyView()
                    }
                }
            }
            
            // Content snippet with highlighting
            if let snippet = memory.titleSnippet {
                Text(snippet)
                    .font(.system(.body, design: .rounded))
                    .foregroundColor(.white.opacity(0.9))
            }
            
            // Metadata
            HStack {
                Label(memory.app, systemImage: memory.appIcon)
                Spacer()
                Text(memory.timestamp.formatted(.relative(presentation: .abbreviated)))
            }
            .font(.caption)
            .foregroundColor(.white.opacity(0.6))
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(.ultraThinMaterial)
        )
    }
}
```

### Fix 5: Add "Remembering..." Animation

**File**: `apps/overlay-macos/Sources/MemoryOverlay/LiquidSearchBar.swift`

```swift
struct LiquidSearchBar: View {
    @State private var isSearching = false
    @State private var shimmerPhase = 0.0
    
    var body: some View {
        VStack {
            // Search field
            TextField("Search your memories...", text: $searchText)
                .onChange(of: searchText) { _ in
                    isSearching = true
                    performSearch()
                }
            
            // Remembering animation
            if isSearching && searchResults.isEmpty {
                HStack(spacing: 8) {
                    ForEach(0..<3) { index in
                        Circle()
                            .fill(Color.white.opacity(0.7))
                            .frame(width: 8, height: 8)
                            .scaleEffect(shimmerPhase == Double(index) ? 1.5 : 1.0)
                            .animation(
                                Animation.easeInOut(duration: 0.6)
                                    .repeatForever()
                                    .delay(Double(index) * 0.2),
                                value: shimmerPhase
                            )
                    }
                    Text("Remembering...")
                        .font(.system(.caption, design: .rounded))
                        .foregroundColor(.white.opacity(0.7))
                }
                .onAppear {
                    shimmerPhase = 1.0
                }
            }
        }
    }
}
```

## 📋 Implementation Order

### Phase 1: Fix Ingest Bridge (CRITICAL - Day 1)
1. Add comprehensive logging to identify filtering issue
2. Test with all apps to find pattern
3. Fix the selective storage bug
4. Verify all apps are being stored

### Phase 2: Screenshot Pipeline (Day 2)
1. Implement ScreenshotService
2. Update database schema to include screenshot paths
3. Extract screenshots from existing videos
4. Set up image serving endpoint in Search API

### Phase 3: Content Indexing (Day 2-3)
1. Fix FTS5 indexing to include full OCR text
2. Update search queries to search content
3. Add snippet generation for search results
4. Test with natural language queries

### Phase 4: Visual UI (Day 3-4)
1. Update Swift models for screenshots
2. Implement AsyncImage loading
3. Add "Remembering..." animation
4. Create image viewer for full screenshots

### Phase 5: Polish & Testing (Day 4-5)
1. Test with real usage scenarios
2. Optimize image storage and loading
3. Add visual clustering of similar memories
4. Implement temporal search ("yesterday", "last week")

## 🔬 Testing Checklist

### After Fix 1 (Ingest Bridge):
```bash
# All apps should be in database
sqlite3 data/sqlite/memories.db "SELECT DISTINCT app FROM memories" | wc -l
# Should be 30+, not 13
```

### After Fix 2 (Screenshots):
```bash
# Screenshots should exist
ls -la data/screenshots/*.jpg | wc -l
# Should match number of memories
```

### After Fix 3 (Content Indexing):
```bash
# Content search should work
curl "http://localhost:3032/search?q=terminal"
# Should return actual terminal content, not empty
```

### After Fix 4 (Visual UI):
- Search "terminal" → See terminal screenshots
- Search "blue" → See anything blue from screen
- Click memory → See full screenshot

## 🎯 Success Metrics

### Current (BROKEN):
- ❌ Search "terminal" → 0 results
- ❌ Search "blue dress" → 0 results  
- ❌ No screenshots shown
- ❌ Only 13 apps stored
- ❌ Acts as app launcher

### Target (FIXED):
- ✅ Search "terminal" → Terminal screenshots with commands
- ✅ Search "blue dress" → Amazon/shopping screenshots
- ✅ Visual memory cards with screenshots
- ✅ All 30+ apps stored
- ✅ True photographic memory

## 💡 Key Insights

1. **Screenpipe works perfectly** - The issue is entirely in Ingest Bridge
2. **The architecture is sound** - Just needs bug fixes and screenshot implementation
3. **UI is ready** - Just needs to display images instead of text
4. **Search works** - Just needs to search content, not app names

## 🚨 Critical Path

**Without fixing the Ingest Bridge bug first, nothing else matters.** 70% of content is missing including all browser and development activity. This must be debugged and fixed before any other work.

## 📝 For the Implementing Developer

You have a system where:
- **Frontend works** but shows wrong data
- **Backend works** but stores wrong data  
- **Capture works** but processing fails
- **Search works** but indexes wrong fields

The fixes are straightforward but require careful debugging of the Ingest Bridge to find why it's filtering apps. Once that's fixed, the rest is just adding the screenshot pipeline and updating the UI to display images.

**Start with Fix #1** - Add logging to find why Cursor/Terminal/Chrome aren't being stored. Everything else depends on this.
