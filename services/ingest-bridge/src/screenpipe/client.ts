/**
 * Screenpipe API Client for Photographic Memory MVP
 * 
 * This client provides a clean interface to interact with Screenpipe's REST API
 * for capturing screen data, OCR text, and metadata needed for memory ingestion.
 * 
 * Debug: Enable detailed logging by setting DEBUG=screenpipe:* environment variable
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { createLogger } from '../utils/logger';

const logger = createLogger('screenpipe-client');

// Core interfaces based on Screenpipe API structure
export interface ScreenpipeEvent {
  id: string;
  timestamp: number;
  app: string;
  window_title: string;
  url?: string;
  ocr_text: string;
  media_path: string;
  frame_id?: string;
  content_type: 'ocr' | 'audio' | 'ui';
  focused?: boolean;
  browser_url?: string;
}

export interface ScreenpipeSearchQuery {
  q?: string;
  limit?: number;
  offset?: number;
  content_type?: 'all' | 'ocr' | 'audio' | 'ui' | 'audio ui' | 'audio+ui' | 'ocr ui' | 'ocr+ui' | 'audio ocr' | 'audio+ocr';
  start_time?: string; // ISO string
  end_time?: string;   // ISO string
  app_name?: string;
  window_name?: string;
  include_frames?: boolean;
  min_length?: number;
  max_length?: number;
  focused?: boolean;
  browser_url?: string;
}

export interface ScreenpipeSearchResult {
  data: ScreenpipeSearchMatch[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

export interface ScreenpipeSearchMatch {
  type: 'OCR' | 'Audio' | 'UI';
  content: {
    frame_id?: number;
    text?: string;
    timestamp: string;
    file_path: string;
    offset_index?: number;
    app_name?: string;
    window_name?: string;
    tags?: string[];
    frame?: string | null;
    frame_name?: string;
    browser_url?: string | null;
    focused?: boolean;
    transcription?: string;
  };
}

export interface ScreenpipeHealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  last_frame_timestamp?: number;
  last_audio_timestamp?: number;
  frame_status: 'ok' | 'stale' | 'error';
  audio_status: 'ok' | 'stale' | 'error' | 'disabled';
  ui_status?: 'ok' | 'stale' | 'error' | 'not_started';
  db_health?: 'ok' | 'error';
}

/**
 * Screenpipe API Client
 * 
 * Provides methods to interact with Screenpipe's REST API for data ingestion.
 */
export class ScreenpipeClient {
  private client: AxiosInstance;
  private baseUrl: string;
  private isHealthy: boolean = false;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 30000; // 30 seconds

  constructor(baseUrl: string = 'http://localhost:3030') {
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 10000, // 10 second timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request/response interceptors for debugging
    this.client.interceptors.request.use(
      (config: any) => {
        logger.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`, {
          params: config.params,
          data: config.data
        });
        return config;
      },
      (error: any) => {
        logger.error('API Request Error:', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response: any) => {
        logger.debug(`API Response: ${response.status} ${response.config.url}`, {
          dataSize: JSON.stringify(response.data).length
        });
        return response;
      },
      (error: any) => {
        logger.error('API Response Error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          message: error.message
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Check if Screenpipe server is healthy and accessible
   * 
   * Debug: Check response time and server status
   */
  async healthCheck(): Promise<ScreenpipeHealthStatus> {
    try {
      const startTime = Date.now();
      const response: AxiosResponse<ScreenpipeHealthStatus> = await this.client.get('/health');
      const responseTime = Date.now() - startTime;
      
      logger.debug('Health check completed', {
        responseTime: `${responseTime}ms`,
        status: response.data.status
      });

      this.isHealthy = response.data.status === 'healthy';
      this.lastHealthCheck = Date.now();
      
      return response.data;
    } catch (error) {
      logger.error('Health check failed:', error);
      this.isHealthy = false;
      throw new Error(`Screenpipe health check failed: ${error}`);
    }
  }

  /**
   * Search for screen capture events
   * 
   * Debug: Log query parameters and result count
   */
  async search(query: ScreenpipeSearchQuery): Promise<ScreenpipeSearchResult> {
    try {
      logger.debug('Searching Screenpipe data', {
        query: query.q,
        timeRange: query.start_time && query.end_time ? 
          `${query.start_time} to ${query.end_time}` : 'all time',
        contentType: query.content_type || 'all',
        limit: query.limit || 50
      });

      const response: AxiosResponse<ScreenpipeSearchResult> = await this.client.get('/search', {
        params: query
      });

      logger.debug('Search completed', {
        resultCount: response.data.data.length,
        totalAvailable: response.data.pagination.total
      });

      return response.data;
    } catch (error) {
      logger.error('Search failed:', error);
      throw new Error(`Screenpipe search failed: ${error}`);
    }
  }

  /**
   * Get recent screen capture events for continuous ingestion
   * 
   * This method is optimized for polling - it fetches the most recent events
   * since a given timestamp for efficient incremental ingestion.
   * 
   * Debug: Log polling frequency and event counts
   */
  async getRecentEvents(sinceTimestamp?: number, limit: number = 100): Promise<ScreenpipeEvent[]> {
    const query: ScreenpipeSearchQuery = {
      limit,
      offset: 0,
      content_type: 'ocr', // Focus on OCR (screen text) for MVP
      include_frames: false // Disable frame extraction to prevent crashes with corrupted videos
    };

    // If we have a timestamp, only get events after that time
    if (sinceTimestamp && !isNaN(sinceTimestamp) && sinceTimestamp > 0) {
      query.start_time = new Date(sinceTimestamp).toISOString();
    }

    try {
      const result = await this.search(query);
      
      // Debug: Log first few raw results to understand timestamp format
      if (result.data.length > 0) {
        logger.debug('Sample raw Screenpipe data', {
          sampleCount: Math.min(2, result.data.length),
          samples: result.data.slice(0, 2).map(match => ({
            type: match.type,
            timestamp: match.content.timestamp,
            timestampType: typeof match.content.timestamp,
            frameId: match.content.frame_id,
            appName: match.content.app_name
          }))
        });
      }
      
      const validEvents: ScreenpipeEvent[] = [];
      
      for (const match of result.data) {
        // Handle the nested content structure from Screenpipe
        const content = match.content || match;
        const timestamp = new Date(content.timestamp).getTime();
        
        // Skip events with invalid timestamps
        if (isNaN(timestamp)) {
          logger.warn('Skipping event with invalid timestamp', { 
            rawTimestamp: content.timestamp,
            frameId: content.frame_id,
            matchType: match.type
          });
          continue;
        }
        
        validEvents.push({
          id: content.frame_id?.toString() || `${content.timestamp}-${Math.random()}`,
          timestamp,
          app: content.app_name || 'unknown',
          window_title: content.window_name || '',
          url: content.browser_url || undefined,
          ocr_text: content.text || '',
          media_path: content.file_path,
          frame_id: content.frame_id?.toString(),
          content_type: match.type.toLowerCase() as 'ocr' | 'audio' | 'ui',
          focused: content.focused,
          browser_url: content.browser_url || undefined
        });
      }
      
      const events = validEvents;

      logger.debug('Retrieved recent events', {
        eventCount: events.length,
        sinceTimestamp: (sinceTimestamp && !isNaN(sinceTimestamp)) ? new Date(sinceTimestamp).toISOString() : 'beginning',
        timeRange: events.length > 0 ? 
          `${new Date(events[events.length - 1].timestamp).toISOString()} to ${new Date(events[0].timestamp).toISOString()}` : 'none'
      });

      return events;
    } catch (error) {
      logger.error('Failed to get recent events:', error);
      throw error;
    }
  }

  /**
   * Get frame data for a specific frame ID
   * 
   * Debug: Log frame retrieval and file size
   */
  async getFrameData(frameId: string): Promise<Buffer> {
    try {
      logger.debug('Retrieving frame data', { frameId });

      const response: AxiosResponse<Buffer> = await this.client.get(`/frames/${frameId}`, {
        responseType: 'arraybuffer'
      });

      logger.debug('Frame data retrieved', {
        frameId,
        sizeBytes: response.data.byteLength,
        contentType: response.headers['content-type']
      });

      return Buffer.from(response.data);
    } catch (error) {
      logger.error('Failed to get frame data:', { frameId, error });
      throw new Error(`Failed to get frame data for ${frameId}: ${error}`);
    }
  }

  /**
   * Test connection and basic functionality
   * 
   * Debug: Comprehensive connection test with timing
   */
  async testConnection(): Promise<{
    healthy: boolean;
    responseTime: number;
    recentEventCount: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let healthy = false;
    let responseTime = 0;
    let recentEventCount = 0;

    try {
      logger.info('Testing Screenpipe connection...');
      
      // Test 1: Health check
      const healthStart = Date.now();
      const health = await this.healthCheck();
      responseTime = Date.now() - healthStart;
      
      if (health.status !== 'healthy') {
        errors.push(`Server unhealthy: ${health.status}`);
      } else {
        healthy = true;
      }

      // Test 2: Try to get recent events
      try {
        const events = await this.getRecentEvents(Date.now() - 60000, 10); // Last minute
        recentEventCount = events.length;
        logger.debug('Connection test - recent events', { count: recentEventCount });
      } catch (error) {
        errors.push(`Failed to retrieve recent events: ${error}`);
      }

      // Test 3: Basic search
      try {
        await this.search({ limit: 1 });
        logger.debug('Connection test - basic search successful');
      } catch (error) {
        errors.push(`Basic search failed: ${error}`);
      }

    } catch (error) {
      errors.push(`Health check failed: ${error}`);
      logger.error('Connection test failed:', error);
    }

    const result = {
      healthy,
      responseTime,
      recentEventCount,
      errors
    };

    logger.info('Connection test completed', result);
    return result;
  }

  /**
   * Start continuous polling for new events
   * 
   * Returns an async iterator that yields new events as they become available.
   * This is the main method used by the ingest bridge for real-time data ingestion.
   * 
   * Debug: Log polling intervals and event rates
   */
  async *pollEvents(pollIntervalMs: number = 5000): AsyncGenerator<ScreenpipeEvent[], void, unknown> {
    let lastTimestamp = Date.now() - 60000; // Start from 1 minute ago
    let pollCount = 0;
    let totalEvents = 0;

    logger.info('Starting event polling', {
      pollIntervalMs,
      startingFrom: new Date(lastTimestamp).toISOString()
    });

    while (true) {
      try {
        // Check health periodically
        if (Date.now() - this.lastHealthCheck > this.healthCheckInterval) {
          await this.healthCheck();
        }

        if (!this.isHealthy) {
          logger.warn('Screenpipe unhealthy, skipping poll');
          await new Promise(resolve => setTimeout(resolve, pollIntervalMs * 2));
          continue;
        }

        const events = await this.getRecentEvents(lastTimestamp, 100);
        pollCount++;
        totalEvents += events.length;

        if (events.length > 0) {
          // Update timestamp to the most recent event
          lastTimestamp = Math.max(...events.map(e => e.timestamp)) + 1;
          
          logger.debug('Poll completed', {
            pollNumber: pollCount,
            newEvents: events.length,
            totalEventsPolled: totalEvents,
            latestTimestamp: new Date(lastTimestamp).toISOString()
          });

          yield events;
        } else {
          logger.debug('Poll completed - no new events', { pollNumber: pollCount });
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));

      } catch (error) {
        logger.error('Polling error:', error);
        
        // Wait longer on error
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs * 3));
      }
    }
  }

  /**
   * Get server information and capabilities
   */
  async getServerInfo(): Promise<any> {
    try {
      // Try to get some basic info about the server
      const response = await this.client.get('/health');
      return {
        baseUrl: this.baseUrl,
        healthy: this.isHealthy,
        lastHealthCheck: this.lastHealthCheck,
        serverResponse: response.data
      };
    } catch (error) {
      logger.error('Failed to get server info:', error);
      throw error;
    }
  }
}

/**
 * Factory function to create and test a Screenpipe client
 * 
 * Debug: Comprehensive setup validation
 */
export async function createScreenpipeClient(baseUrl?: string): Promise<ScreenpipeClient> {
  const client = new ScreenpipeClient(baseUrl);
  
  logger.info('Creating Screenpipe client', { baseUrl: client['baseUrl'] });
  
  // Test the connection immediately
  const testResult = await client.testConnection();
  
  if (!testResult.healthy) {
    const errorMsg = `Screenpipe client creation failed: ${testResult.errors.join(', ')}`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  logger.info('Screenpipe client created successfully', {
    responseTime: `${testResult.responseTime}ms`,
    recentEvents: testResult.recentEventCount
  });

  return client;
}

export default ScreenpipeClient;