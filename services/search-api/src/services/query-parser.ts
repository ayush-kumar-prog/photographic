import * as chrono from 'chrono-node';
import { logger } from '../utils/logger';

interface ParsedQuery {
  text: string;
  time_window?: { from: Date; to: Date };
  app_hints: string[];
  topic_hints: string[];
  answer_field?: string;
  strict: boolean;
}

interface SearchRequest {
  q: string;
  from?: string;
  to?: string;
  app?: string;
  host?: string;
  k?: number;
}

export class QueryParser {
  async parseQuery(queryText: string, request: SearchRequest): Promise<ParsedQuery> {
    // Parse time expressions
    let timeWindow: { from: Date; to: Date } | undefined;
    
    if (request.from && request.to) {
      timeWindow = {
        from: new Date(request.from),
        to: new Date(request.to)
      };
    } else {
      // Use chrono to parse natural language time expressions
      const chronoResults = chrono.parse(queryText);
      if (chronoResults.length > 0) {
        const result = chronoResults[0];
        if (result.start && result.end) {
          timeWindow = {
            from: result.start.date(),
            to: result.end.date()
          };
        } else if (result.start) {
          const startDate = result.start.date();
          
          // Handle relative time expressions
          const text = result.text.toLowerCase();
          if (text.includes('yesterday')) {
            const endDate = new Date(startDate);
            endDate.setHours(23, 59, 59, 999);
            timeWindow = { from: startDate, to: endDate };
          } else if (text.includes('week') || text.includes('weeks')) {
            // For "2 weeks ago", create a range around that time
            const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
            timeWindow = { from: startDate, to: endDate };
          } else if (text.includes('month') || text.includes('months')) {
            // For "last month", create a range
            const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
            timeWindow = { from: startDate, to: endDate };
          } else {
            // Default: add 24 hours
            timeWindow = {
              from: startDate,
              to: new Date(startDate.getTime() + 24 * 60 * 60 * 1000)
            };
          }
        }
      }
    }
    
    // Extract app hints
    const appHints: string[] = [];
    if (request.app) {
      appHints.push(request.app);
    }
    
    // Common app names to look for in query
    const commonApps = [
      'Safari', 'Chrome', 'Firefox', 'YouTube', 'Amazon', 'Apex', 
      'Code', 'Terminal', 'Slack', 'Discord', 'Cursor', 'VS Code',
      'Figma', 'Photoshop', 'Illustrator', 'Sketch'
    ];
    
    for (const app of commonApps) {
      if (queryText.toLowerCase().includes(app.toLowerCase())) {
        appHints.push(app);
      }
    }
    
    // Extract topic hints (simple keyword extraction)
    const stopWords = [
      'what', 'when', 'where', 'that', 'this', 'from', 'with', 'about',
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
      'was', 'were', 'is', 'are', 'been', 'being', 'have', 'has', 'had',
      'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may',
      'might', 'can', 'must', 'shall', 'ago', 'last', 'yesterday'
    ];
    
    const topicHints = queryText.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !stopWords.includes(word))
      .filter(word => !/^\d+$/.test(word)) // Remove pure numbers
      .slice(0, 10); // Limit to top 10 keywords
    
    // Detect answer field type
    let answerField: string | undefined;
    const lowerQuery = queryText.toLowerCase();
    
    if (lowerQuery.includes('price') || queryText.includes('$') || lowerQuery.includes('cost')) {
      answerField = 'price';
    } else if (lowerQuery.includes('score') || lowerQuery.includes('kills') || lowerQuery.includes('points')) {
      answerField = 'score';
    } else if (lowerQuery.includes('title') || lowerQuery.includes('video') || lowerQuery.includes('name')) {
      answerField = 'title';
    }
    
    const parsed: ParsedQuery = {
      text: queryText,
      time_window: timeWindow,
      app_hints: [...new Set(appHints)], // Remove duplicates
      topic_hints: [...new Set(topicHints)],
      answer_field: answerField,
      strict: false
    };
    
    logger.debug('Query parsed:', {
      original: queryText,
      time_window: timeWindow ? {
        from: timeWindow.from.toISOString(),
        to: timeWindow.to.toISOString()
      } : undefined,
      app_hints: parsed.app_hints,
      topic_hints: parsed.topic_hints.slice(0, 5), // Log first 5 only
      answer_field: parsed.answer_field
    });
    
    return parsed;
  }
}
