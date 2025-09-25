import * as sqlite3 from 'sqlite3';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { MemoryObjectWithEmbedding } from '../types/memory';

interface DatabaseRow {
  id: string;
  ts: number;
  app: string;
  url_host: string | null;
  window_title: string | null;
  ocr_text: string;
  media_path: string | null;
  thumb_path: string | null;
  asr_text: string | null;
  entities: string | null; // JSON string
  topics: string | null;   // JSON string
  session_id: string | null;
  url: string | null;
  video_processed: number; // SQLite boolean (0/1)
  video_kept: number;      // SQLite boolean (0/1)
  similarity_score: number;
}

export class DatabaseManager {
  private db: sqlite3.Database | null = null;
  private dbPath: string;
  private dataDir: string;
  private isInitialized: boolean = false;

  constructor(dataDir: string = '../../data/sqlite') {
    // If running from services/ingest-bridge/dist, go up to project root
    const projectRoot = process.env.PROJECT_ROOT || path.resolve(__dirname, '../../../..');
    this.dataDir = path.resolve(projectRoot, 'data/sqlite');
    this.dbPath = path.join(this.dataDir, 'memories.db');
    logger.info('DatabaseManager initialized', { dbPath: this.dbPath });
  }

  async initialize(): Promise<void> {
    try {
      // Ensure data directory exists
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
        logger.info('Created data directory', { dataDir: this.dataDir });
      }

      // Initialize SQLite database
      await this.initializeDatabase();
      
      this.isInitialized = true;
      logger.info('Database manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database manager:', error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          logger.error('Failed to open database:', err);
          reject(err);
          return;
        }

        logger.info('SQLite database opened successfully');
        
        // Create tables and indexes
        this.createTables()
          .then(() => resolve())
          .catch(reject);
      });
    });
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const runAsync = promisify(this.db.run.bind(this.db));

    try {
      // Create main memories table
      await runAsync(`
        CREATE TABLE IF NOT EXISTS memories (
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
        )
      `);

      // Create FTS5 virtual table for full-text search
      await runAsync(`
        CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
          id UNINDEXED,
          ocr_text,
          window_title,
          app UNINDEXED,
          url_host UNINDEXED,
          content='memories',
          content_rowid='rowid'
        )
      `);

      // Create indexes for performance
      await runAsync('CREATE INDEX IF NOT EXISTS idx_memories_ts ON memories(ts DESC)');
      await runAsync('CREATE INDEX IF NOT EXISTS idx_memories_app_ts ON memories(app, ts DESC)');
      await runAsync('CREATE INDEX IF NOT EXISTS idx_memories_url_host_ts ON memories(url_host, ts DESC)');
      await runAsync('CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(session_id)');

      // Create triggers to keep FTS5 in sync
      await runAsync(`
        CREATE TRIGGER IF NOT EXISTS memories_fts_insert AFTER INSERT ON memories BEGIN
          INSERT INTO memories_fts(id, ocr_text, window_title, app, url_host)
          VALUES (new.id, new.ocr_text, new.window_title, new.app, new.url_host);
        END
      `);

      await runAsync(`
        CREATE TRIGGER IF NOT EXISTS memories_fts_delete AFTER DELETE ON memories BEGIN
          DELETE FROM memories_fts WHERE id = old.id;
        END
      `);

      await runAsync(`
        CREATE TRIGGER IF NOT EXISTS memories_fts_update AFTER UPDATE ON memories BEGIN
          DELETE FROM memories_fts WHERE id = old.id;
          INSERT INTO memories_fts(id, ocr_text, window_title, app, url_host)
          VALUES (new.id, new.ocr_text, new.window_title, new.app, new.url_host);
        END
      `);

      logger.info('Database tables and indexes created successfully');
    } catch (error) {
      logger.error('Failed to create database tables:', error);
      throw error;
    }
  }

  async eventExists(eventId: string): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.get('SELECT 1 FROM memories WHERE id = ?', [eventId], (err, result) => {
        if (err) {
          logger.error('Failed to check if event exists:', err);
          resolve(false);
        } else {
          resolve(!!result);
        }
      });
    });
  }

  async storeMemoryObject(memoryObject: MemoryObjectWithEmbedding): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      logger.info('💾 ATTEMPTING TO STORE MEMORY', { 
        id: memoryObject.id, 
        app: memoryObject.app,
        windowTitle: memoryObject.window_title?.substring(0, 50),
        textLength: memoryObject.ocr_text?.length || 0,
        hasEmbedding: !!memoryObject.embedding,
        videoProcessed: memoryObject.video_processed
      });

      // Prepare data for insertion
      const params = [
        memoryObject.id,
        memoryObject.ts,
        memoryObject.session_id || null,
        memoryObject.app,
        memoryObject.window_title || null,
        memoryObject.url || null,
        memoryObject.url_host || null,
        memoryObject.media_path || null,
        memoryObject.thumb_path || null,
        memoryObject.ocr_text,
        memoryObject.asr_text || null,
        memoryObject.entities ? JSON.stringify(memoryObject.entities) : null,
        memoryObject.topics ? JSON.stringify(memoryObject.topics) : null,
        memoryObject.video_processed ? 1 : 0,
        memoryObject.video_kept !== false ? 1 : 0, // Default to true
        memoryObject.similarity_score || 0.0
      ];

      // Insert into main table (triggers will handle FTS5)
      this.db!.run(`
        INSERT OR REPLACE INTO memories (
          id, ts, session_id, app, window_title, url, url_host,
          media_path, thumb_path, ocr_text, asr_text, entities, topics,
          video_processed, video_kept, similarity_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, params, function(err) {
        if (err) {
          logger.error('❌ DATABASE STORAGE FAILED', {
            error: err.message,
            errorCode: err.code,
            app: memoryObject.app,
            id: memoryObject.id,
            paramsLength: params.length,
            appCharCodes: memoryObject.app.split('').map(c => c.charCodeAt(0))
          });
          resolve(false); // Return false instead of rejecting
        } else {
          logger.info('✅ DATABASE STORAGE SUCCESS', { 
            id: memoryObject.id,
            app: memoryObject.app,
            timestamp: new Date(memoryObject.ts).toISOString(),
            rowsChanged: this.changes
          });
          resolve(true); // Return true for success
        }
      });
    });
  }

  /**
   * Search memories using FTS5 full-text search
   */
  async searchMemories(query: string, limit: number = 50, offset: number = 0): Promise<MemoryObjectWithEmbedding[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.all(`
        SELECT m.* FROM memories m
        JOIN memories_fts fts ON m.id = fts.id
        WHERE fts.memories_fts MATCH ?
        ORDER BY fts.rank, m.ts DESC
        LIMIT ? OFFSET ?
      `, [query, limit, offset], (err, results) => {
        if (err) {
          logger.error('Failed to search memories:', err);
          reject(err);
        } else {
          const memories = (results as any[]).map(this.rowToMemoryObject.bind(this));
          resolve(memories);
        }
      });
    });
  }

  /**
   * Get recent memories within a time range
   */
  async getRecentMemories(
    sinceTimestamp?: number, 
    limit: number = 100,
    app?: string,
    urlHost?: string
  ): Promise<MemoryObjectWithEmbedding[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM memories WHERE 1=1';
      const params: any[] = [];

      if (sinceTimestamp) {
        query += ' AND ts >= ?';
        params.push(sinceTimestamp);
      }

      if (app) {
        query += ' AND app = ?';
        params.push(app);
      }

      if (urlHost) {
        query += ' AND url_host = ?';
        params.push(urlHost);
      }

      query += ' ORDER BY ts DESC LIMIT ?';
      params.push(limit);

      this.db!.all(query, params, (err, results) => {
        if (err) {
          logger.error('Failed to get recent memories:', err);
          reject(err);
        } else {
          const memories = (results as any[]).map(this.rowToMemoryObject.bind(this));
          resolve(memories);
        }
      });
    });
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    totalMemories: number;
    oldestMemory: number | null;
    newestMemory: number | null;
    appCounts: { [app: string]: number };
  }> {
    if (!this.db) throw new Error('Database not initialized');

    const getAsync = promisify(this.db.get.bind(this.db));
    const allAsync = promisify(this.db.all.bind(this.db));

    try {
      const totalResult = await getAsync('SELECT COUNT(*) as count FROM memories') as any;
      const totalMemories = totalResult?.count || 0;

      const timeResult = await getAsync('SELECT MIN(ts) as oldest, MAX(ts) as newest FROM memories') as any;
      const oldestMemory = timeResult?.oldest || null;
      const newestMemory = timeResult?.newest || null;

      const appResults = await allAsync('SELECT app, COUNT(*) as count FROM memories GROUP BY app ORDER BY count DESC') as any[];
      const appCounts: { [app: string]: number } = {};
      appResults.forEach((row: any) => {
        appCounts[row.app] = row.count;
      });

      return {
        totalMemories,
        oldestMemory,
        newestMemory,
        appCounts
      };
    } catch (error) {
      logger.error('Failed to get database stats:', error);
      throw error;
    }
  }

  private rowToMemoryObject(row: any): MemoryObjectWithEmbedding {
    return {
      id: row.id,
      ts: row.ts,
      session_id: row.session_id,
      app: row.app,
      window_title: row.window_title,
      url: row.url,
      url_host: row.url_host,
      media_path: row.media_path,
      thumb_path: row.thumb_path,
      ocr_text: row.ocr_text,
      asr_text: row.asr_text,
      entities: row.entities ? JSON.parse(row.entities) : [],
      topics: row.topics ? JSON.parse(row.topics) : [],
      video_processed: !!row.video_processed,
      video_kept: !!row.video_kept,
      similarity_score: row.similarity_score || 0.0
    };
  }

  async close(): Promise<void> {
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db!.close((err) => {
          if (err) {
            logger.error('Error closing database:', err);
            reject(err);
          } else {
            logger.info('Database closed successfully');
            this.db = null;
            resolve();
          }
        });
      });
    }
  }

  isReady(): boolean {
    return this.isInitialized && !!this.db;
  }
}
