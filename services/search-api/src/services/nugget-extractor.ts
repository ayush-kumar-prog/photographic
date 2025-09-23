interface NuggetResult {
  type: 'price' | 'score' | 'title' | 'generic';
  value: string;
  confidence: number;
}

export class NuggetExtractor {
  extractNugget(ocrText: string, app: string, urlHost?: string | null): NuggetResult | null {
    // YouTube title extraction
    if (app === 'Safari' && urlHost?.includes('youtube.com')) {
      return this.extractYouTubeTitle(ocrText);
    }
    
    // Amazon price extraction
    if (app === 'Safari' && urlHost?.includes('amazon.com')) {
      return this.extractAmazonPrice(ocrText);
    }
    
    // Game score extraction
    if (this.isGameContext(app, ocrText)) {
      return this.extractGameScore(ocrText);
    }
    
    // Generic extraction - find the most prominent text
    return this.extractGeneric(ocrText);
  }

  private extractYouTubeTitle(ocrText: string): NuggetResult | null {
    const titlePatterns = [
      /(.+?)\s*-\s*YouTube/i,
      /(.+?)\s*•\s*\d+[KMB]?\s*views/i,
      /Watch\s*"([^"]+)"/i,
      /^([^\n]{10,80})\s*\n/m, // First substantial line
      /(.+?)\s*\|\s*YouTube/i,
      /(.+?)\s*-\s*\d+[KMB]?\s*views/i
    ];
    
    for (const pattern of titlePatterns) {
      const match = ocrText.match(pattern);
      if (match && match[1]) {
        const title = match[1].trim();
        // Filter out common UI elements
        if (this.isValidTitle(title)) {
          return {
            type: 'title',
            value: title,
            confidence: 0.9
          };
        }
      }
    }
    
    return null;
  }

  private extractAmazonPrice(ocrText: string): NuggetResult | null {
    const pricePatterns = [
      /(\$|£|€|USD|GBP|EUR)\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
      /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(\$|£|€|USD|GBP|EUR)/gi
    ];
    
    const allMatches: RegExpMatchArray[] = [];
    
    for (const pattern of pricePatterns) {
      const matches = Array.from(ocrText.matchAll(pattern));
      allMatches.push(...matches);
    }
    
    if (allMatches.length > 0) {
      // Find the highest price (likely the main product price)
      const highestPrice = allMatches.reduce((max, current) => {
        const currentValue = this.extractPriceValue(current);
        const maxValue = this.extractPriceValue(max);
        return currentValue > maxValue ? current : max;
      });
      
      const symbol = highestPrice[1] || highestPrice[3] || '$';
      const value = highestPrice[2] || highestPrice[1];
      
      return {
        type: 'price',
        value: `${symbol}${value}`,
        confidence: 0.85
      };
    }
    
    return null;
  }

  private extractGameScore(ocrText: string): NuggetResult | null {
    const scorePatterns = [
      // Apex Legends patterns
      /(?:KILLS|ELIMINATIONS)[:\s]*(\d+)/i,
      /(\d+)\s*(?:KILLS|ELIMINATIONS)/i,
      /(?:DAMAGE)[:\s]*(\d{1,5})/i,
      /(\d{1,5})\s*(?:DAMAGE)/i,
      /(?:SCORE|POINTS)[:\s]*(\d+)/i,
      /(\d+)\s*(?:SCORE|POINTS)/i,
      /(?:RANKED|RANK)[:\s]*(\d+)/i,
      /(?:XP|EXP)[:\s]*(\d+)/i,
      
      // Generic game patterns
      /LEVEL[:\s]*(\d+)/i,
      /LVL[:\s]*(\d+)/i,
      /(\d+)\s*(?:XP|EXP)/i,
      
      // Match results
      /(\d+)\s*-\s*(\d+)/i, // Score like "15-3"
    ];
    
    const scores: { value: string; confidence: number; type: string }[] = [];
    
    for (const pattern of scorePatterns) {
      const match = ocrText.match(pattern);
      if (match) {
        const value = match[1] || match[2];
        if (value && this.isValidScore(value)) {
          scores.push({
            value,
            confidence: this.getScoreConfidence(pattern.source, value),
            type: this.getScoreType(pattern.source)
          });
        }
      }
    }
    
    if (scores.length > 0) {
      // Return the highest confidence score
      const bestScore = scores.reduce((max, current) => 
        current.confidence > max.confidence ? current : max
      );
      
      return {
        type: 'score',
        value: bestScore.value,
        confidence: bestScore.confidence
      };
    }
    
    return null;
  }

  private extractGeneric(ocrText: string): NuggetResult | null {
    const lines = ocrText.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 5)
      .filter(line => !this.isUIElement(line));
    
    if (lines.length > 0) {
      const prominentLine = lines[0];
      if (prominentLine.length >= 10 && prominentLine.length <= 100) {
        return {
          type: 'generic',
          value: prominentLine,
          confidence: 0.6
        };
      }
    }
    
    return null;
  }

  private isGameContext(app: string, ocrText: string): boolean {
    const gameApps = ['apex', 'steam', 'origin', 'epic'];
    const gameKeywords = ['kills', 'damage', 'score', 'rank', 'level', 'xp', 'match'];
    
    const appMatch = gameApps.some(game => app.toLowerCase().includes(game));
    const textMatch = gameKeywords.some(keyword => 
      ocrText.toLowerCase().includes(keyword)
    );
    
    return appMatch || textMatch;
  }

  private isValidTitle(title: string): boolean {
    const invalidPatterns = [
      /^(subscribe|like|share|comment)$/i,
      /^(home|trending|subscriptions)$/i,
      /^(search|settings|profile)$/i,
      /^\d+:\d+$/i, // Time stamps
      /^[^\w\s]+$/i, // Only special characters
    ];
    
    return !invalidPatterns.some(pattern => pattern.test(title)) && 
           title.length >= 10 && 
           title.length <= 100;
  }

  private isUIElement(text: string): boolean {
    const uiPatterns = [
      /^(ok|cancel|close|back|next|submit)$/i,
      /^(menu|settings|options|preferences)$/i,
      /^(search|filter|sort|view)$/i,
      /^\d+:\d+$/i, // Timestamps
      /^[^\w\s]+$/i, // Only special characters
      /^(loading|please wait)$/i
    ];
    
    return uiPatterns.some(pattern => pattern.test(text));
  }

  private isValidScore(value: string): boolean {
    const num = parseInt(value);
    return !isNaN(num) && num >= 0 && num <= 999999; // Reasonable score range
  }

  private extractPriceValue(match: RegExpMatchArray): number {
    const value = match[2] || match[1];
    return parseFloat(value.replace(',', '')) || 0;
  }

  private getScoreConfidence(patternSource: string, value: string): number {
    const num = parseInt(value);
    
    // Higher confidence for specific game terms
    if (patternSource.includes('KILLS|ELIMINATIONS')) return 0.9;
    if (patternSource.includes('DAMAGE')) return 0.85;
    if (patternSource.includes('SCORE|POINTS')) return 0.8;
    if (patternSource.includes('RANKED|RANK')) return 0.75;
    
    // Lower confidence for very high or very low numbers
    if (num > 10000 || num < 1) return 0.5;
    
    return 0.7;
  }

  private getScoreType(patternSource: string): string {
    if (patternSource.includes('KILLS')) return 'kills';
    if (patternSource.includes('DAMAGE')) return 'damage';
    if (patternSource.includes('SCORE')) return 'score';
    if (patternSource.includes('RANK')) return 'rank';
    if (patternSource.includes('XP')) return 'xp';
    return 'score';
  }
}
