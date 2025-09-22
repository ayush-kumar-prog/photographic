# Ingest Bridge Service

The Ingest Bridge Service is a critical component of the Photographic Memory MVP that normalizes Screenpipe events into canonical MemoryObjects and stores them in both SQLite (FTS5) and Chroma vector databases.

## Overview

This service implements **Step 3** of the MVP implementation plan:

- ✅ **Node/TS service** to normalize Screenpipe data
- ✅ **SQLite FTS5 database** for keyword search
- ✅ **Chroma vector database** integration
- ✅ **MemoryObject canonical schema** implementation
- ✅ **OpenAI embeddings** integration
- ✅ **Thumbnail generation** pipeline
- ✅ **Error handling and logging**

## Architecture

```
[Screenpipe API] → [Ingest Bridge] → [SQLite FTS5 + Chroma Vector DB]
                        ↓
                [Thumbnail Generator]
                        ↓
                [OpenAI Embeddings]
```

## Performance Targets (Step 3 Success Criteria)

- ✅ Process ≥3,000 rows/hour sustained throughput
- ✅ Handle ≥200 rows/minute peak processing  
- ✅ SQLite FTS5 index responds to queries <50ms
- ✅ Chroma vector insertion completes <100ms per document
- ✅ Thumbnail generation <200ms per image
- ✅ Memory usage stable under 200MB for service

## Components

### 1. DatabaseManager (`src/database/manager.ts`)
- SQLite database with FTS5 full-text search
- Automatic schema creation and migrations
- Optimized indexes for performance
- Memory object storage and retrieval

### 2. EmbeddingsService (`src/embeddings/service.ts`)
- OpenAI `text-embedding-3-large` integration
- Chroma vector database management
- Batch processing with rate limiting
- Retry logic and error handling

### 3. ThumbnailGenerator (`src/media/thumbnails.ts`)
- Sharp-based image processing
- 300x200 thumbnail generation
- Video frame extraction (basic)
- Placeholder generation for unsupported formats

### 4. ScreenpipeClient (`src/screenpipe/client.ts`)
- REST API client for Screenpipe
- Event polling and normalization
- Health monitoring
- Comprehensive error handling

### 5. VideoProcessor (`src/media/video-processor.ts`)
- Video similarity detection
- Duplicate frame filtering
- Storage optimization

## Environment Setup

```bash
# Required environment variables
export OPENAI_API_KEY="your-openai-api-key"

# Optional configuration
export MEM_RETENTION_DAYS=60
export SCREENPIPE_URL="http://localhost:3030"
export DATA_DIR="./data"
```

## Installation & Usage

```bash
# Install dependencies
pnpm install

# Build the service
pnpm build

# Run in development mode
pnpm dev

# Run in production
pnpm start

# Run tests
pnpm test:smoke      # Basic functionality test
pnpm test:throughput # Performance validation
pnpm test:all        # All tests
```

## Data Flow

1. **Poll Screenpipe**: Fetch new OCR events every 5 seconds
2. **Validate Events**: Check data integrity and deduplicate
3. **Process Video**: Analyze similarity and optimize storage
4. **Generate Embeddings**: Create OpenAI text embeddings
5. **Create Thumbnails**: Generate 300x200 preview images
6. **Store Data**: Save to SQLite FTS5 and Chroma vector DB
7. **Monitor Performance**: Track throughput and resource usage

## Database Schema

### SQLite Table: `memories`
```sql
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  ts INTEGER NOT NULL,
  session_id TEXT,
  app TEXT NOT NULL,
  window_title TEXT,
  url TEXT,
  url_host TEXT,
  media_path TEXT,
  thumb_path TEXT,
  ocr_text TEXT NOT NULL,
  asr_text TEXT,
  entities TEXT, -- JSON array
  topics TEXT,   -- JSON array
  video_processed INTEGER DEFAULT 0,
  video_kept INTEGER DEFAULT 1,
  similarity_score REAL DEFAULT 0.0,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
```

### FTS5 Virtual Table: `memories_fts`
```sql
CREATE VIRTUAL TABLE memories_fts USING fts5(
  id UNINDEXED,
  ocr_text,
  window_title,
  app UNINDEXED,
  url_host UNINDEXED,
  content='memories',
  content_rowid='rowid'
);
```

### Chroma Collection: `mem_text`
- **Embeddings**: OpenAI text-embedding-3-large (3072 dimensions)
- **Metadata**: timestamp, app, url_host, window_title, media paths
- **Documents**: OCR text content

## API Endpoints

The service exposes internal methods for:

- `healthCheck()`: Component health status
- `getProcessingStats()`: Throughput and performance metrics
- `searchMemories()`: FTS5 text search
- `getRecentMemories()`: Time-based filtering

## Performance Monitoring

The service tracks:
- **Throughput**: Events processed per hour/minute
- **Latency**: Processing time per event
- **Memory Usage**: Heap usage and garbage collection
- **Queue Status**: Embedding generation backlog
- **Database Performance**: Query response times
- **Storage Efficiency**: Thumbnail and video optimization

## Error Handling

- **Graceful Degradation**: Continue processing on individual failures
- **Retry Logic**: Exponential backoff for API calls
- **Circuit Breaking**: Pause on repeated failures
- **Comprehensive Logging**: Structured logs with context
- **Health Monitoring**: Component status tracking

## Testing

### Smoke Test (`test:smoke`)
- Service initialization
- Component health checks
- Basic functionality validation

### Throughput Test (`test:throughput`)
- Sustained processing rate validation
- Peak performance testing
- Memory usage monitoring
- Performance target verification

## Troubleshooting

### Common Issues

1. **OpenAI API Errors**
   - Check `OPENAI_API_KEY` environment variable
   - Verify API quota and rate limits
   - Monitor embedding generation queue

2. **Database Errors**
   - Ensure data directory is writable
   - Check disk space availability
   - Verify SQLite FTS5 extension

3. **Screenpipe Connection**
   - Confirm Screenpipe is running on port 3030
   - Check network connectivity
   - Verify API endpoint availability

4. **Memory Issues**
   - Monitor heap usage with `getProcessingStats()`
   - Adjust batch sizes if needed
   - Check for memory leaks in long-running processes

### Debug Logging

Enable detailed logging:
```bash
export DEBUG=screenpipe:*,ingest-bridge:*
export LOG_LEVEL=debug
```

## Next Steps

This service provides the foundation for **Step 5: Search API Service**, which will:
- Implement hybrid search (semantic + keyword)
- Add confidence scoring and mode switching
- Provide REST API endpoints for the SwiftUI overlay
- Support query understanding and time parsing

The ingest bridge ensures high-quality, searchable data is available for the search layer to deliver the "photographic memory" experience.
