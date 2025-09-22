/**
 * Answer/RAG request and response types
 */
export interface AnswerRequest {
  q: string;
  topk?: number;
}

export interface AnswerResponse {
  text: string;
  citations: Citation[];
  confidence: number;
}

export interface Citation {
  id: string;
  ts: number;
  app: string;
  snippet: string;
  relevanceScore: number;
}

/**
 * Health check response
 */
export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    [key: string]: {
      status: 'up' | 'down';
      latency?: number;
    };
  };
  timestamp: number;
}

/**
 * Error response format
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: number;
}

