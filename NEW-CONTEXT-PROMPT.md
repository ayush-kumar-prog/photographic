# New Context Window Prompt

## Instructions for LLM

You are taking over development of a Photographic Memory desktop app. Read these files in this exact order to understand the full context:

### REQUIRED READING (in order):

1. **`docs/LLM-IMPLEMENTATION-PROMPT.md`** - Your mission and current status
2. **`docs/COMPLETE-TECHNICAL-CONTEXT.md`** - Complete technical diagnosis with exact fixes
3. **`docs/CURRENT-STATE-VS-VISION.md`** - What we built vs what we wanted

### SUPPORTING FILES (as needed):

4. **`services/ingest-bridge/src/index.ts`** - Main service with the critical bug
5. **`services/ingest-bridge/src/screenpipe/client.ts`** - Screenpipe API client
6. **`apps/overlay-macos/Sources/MemoryOverlay/Models.swift`** - SwiftUI models
7. **`README.md`** - Project overview

### YOUR IMMEDIATE TASK:

**Phase 1**: Debug why Ingest Bridge only stores 13 apps when Screenpipe captures 30+ apps. Add comprehensive logging to find the filtering issue.

**Evidence**: Screenpipe captures Cursor, Terminal, Chrome but they're missing from the database completely.

**Start here**: `services/ingest-bridge/src/index.ts` - Add logging to `processNewEvents()` method to track which apps are being filtered out and why.

The system is 80% complete but the core functionality is broken due to this selective storage bug. Fix this first, then implement screenshot pipeline, content indexing, and visual UI.

Project path: `/Users/kumar/Documents/Projects/memories`
