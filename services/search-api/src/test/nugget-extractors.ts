#!/usr/bin/env tsx

/**
 * Nugget Extractors Test
 * Tests YouTube title, Amazon price, and game score extraction
 */

import { NuggetExtractor } from '../services/nugget-extractor';
import { logger } from '../utils/logger';

interface TestCase {
  name: string;
  ocrText: string;
  app: string;
  urlHost?: string | null;
  expectedType: 'price' | 'score' | 'title' | 'generic' | null;
  expectedValue?: string;
  minConfidence?: number;
}

const TEST_CASES: TestCase[] = [
  // YouTube title extraction
  {
    name: 'YouTube title with dash',
    ocrText: 'Introduction to Microeconomics - YouTube\n\nSubscribe 1.2M views',
    app: 'Safari',
    urlHost: 'youtube.com',
    expectedType: 'title',
    expectedValue: 'Introduction to Microeconomics',
    minConfidence: 0.8
  },
  {
    name: 'YouTube title with bullet',
    ocrText: 'Advanced Economics Concepts • 850K views\n\nLike Share Subscribe',
    app: 'Safari',
    urlHost: 'youtube.com',
    expectedType: 'title',
    expectedValue: 'Advanced Economics Concepts',
    minConfidence: 0.8
  },
  
  // Amazon price extraction
  {
    name: 'Amazon price with dollar sign',
    ocrText: 'OMEGA Seamaster Aqua Terra\n\nPrice: $3,495.00\n\nAdd to Cart',
    app: 'Safari',
    urlHost: 'amazon.com',
    expectedType: 'price',
    expectedValue: '$3,495.00',
    minConfidence: 0.8
  },
  {
    name: 'Amazon price with euro symbol',
    ocrText: 'Premium Watch Collection\n\n€2,850.99\n\nBuy Now',
    app: 'Safari',
    urlHost: 'amazon.com',
    expectedType: 'price',
    expectedValue: '€2,850.99',
    minConfidence: 0.8
  },
  
  // Game score extraction
  {
    name: 'Apex Legends kills',
    ocrText: 'MATCH SUMMARY\n\nKILLS: 12\nDAMAGE: 2,450\nPLACEMENT: #3',
    app: 'Apex Legends',
    urlHost: null,
    expectedType: 'score',
    expectedValue: '12',
    minConfidence: 0.7
  },
  {
    name: 'Game damage score',
    ocrText: 'FINAL STATS\n\nDamage Dealt: 3,250\nKills: 8\nAssists: 4',
    app: 'Steam',
    urlHost: null,
    expectedType: 'score',
    expectedValue: '3,250',
    minConfidence: 0.7
  },
  
  // Generic extraction
  {
    name: 'Generic text extraction',
    ocrText: 'Important Meeting Notes\n\nProject deadline: Next Friday\nBudget: $50,000',
    app: 'TextEdit',
    urlHost: null,
    expectedType: 'generic',
    expectedValue: 'Important Meeting Notes',
    minConfidence: 0.5
  },
  
  // Edge cases
  {
    name: 'No extractable content',
    ocrText: 'OK Cancel Close',
    app: 'System',
    urlHost: null,
    expectedType: null
  },
  {
    name: 'Multiple prices - should get highest',
    ocrText: 'Similar items:\n$199.99\n$299.99\n$1,499.99 (Premium)',
    app: 'Safari',
    urlHost: 'amazon.com',
    expectedType: 'price',
    expectedValue: '$1,499.99',
    minConfidence: 0.8
  }
];

class NuggetExtractorTest {
  private extractor: NuggetExtractor;
  private results: any[] = [];

  constructor() {
    this.extractor = new NuggetExtractor();
  }

  async runTests(): Promise<void> {
    logger.info('🧪 Starting Nugget Extractor Tests');
    logger.info('=' .repeat(50));
    
    for (const testCase of TEST_CASES) {
      await this.testCase(testCase);
    }
    
    this.generateReport();
  }

  private async testCase(testCase: TestCase): Promise<void> {
    logger.info(`Testing: ${testCase.name}`);
    
    try {
      const result = this.extractor.extractNugget(
        testCase.ocrText,
        testCase.app,
        testCase.urlHost
      );
      
      const passed = this.evaluateResult(testCase, result);
      
      const testResult = {
        name: testCase.name,
        expected: {
          type: testCase.expectedType,
          value: testCase.expectedValue,
          minConfidence: testCase.minConfidence
        },
        actual: result,
        passed
      };
      
      this.results.push(testResult);
      
      if (passed) {
        if (result) {
          logger.info(`✅ ${testCase.name}: ${result.type}="${result.value}" (conf=${result.confidence})`);
        } else {
          logger.info(`✅ ${testCase.name}: No extraction (expected)`);
        }
      } else {
        logger.warn(`❌ ${testCase.name}: Failed criteria`);
        if (result) {
          logger.warn(`   Got: ${result.type}="${result.value}" (conf=${result.confidence})`);
        } else {
          logger.warn(`   Got: null`);
        }
        logger.warn(`   Expected: ${testCase.expectedType}="${testCase.expectedValue}"`);
      }
      
    } catch (error) {
      logger.error(`❌ ${testCase.name}: Error -`, error);
      this.results.push({
        name: testCase.name,
        error: error instanceof Error ? error.message : 'Unknown error',
        passed: false
      });
    }
  }

  private evaluateResult(testCase: TestCase, result: any): boolean {
    // If we expect null and got null, that's correct
    if (testCase.expectedType === null && result === null) {
      return true;
    }
    
    // If we expect something but got null, that's wrong
    if (testCase.expectedType !== null && result === null) {
      return false;
    }
    
    // If we expect null but got something, that's wrong
    if (testCase.expectedType === null && result !== null) {
      return false;
    }
    
    // Check type matches
    if (result.type !== testCase.expectedType) {
      return false;
    }
    
    // Check confidence meets minimum
    if (testCase.minConfidence && result.confidence < testCase.minConfidence) {
      return false;
    }
    
    // Check value matches (if specified)
    if (testCase.expectedValue && result.value !== testCase.expectedValue) {
      // For prices, allow some flexibility in formatting
      if (testCase.expectedType === 'price') {
        const normalizePrice = (price: string) => price.replace(/[,\s]/g, '');
        if (normalizePrice(result.value) !== normalizePrice(testCase.expectedValue)) {
          return false;
        }
      } else {
        return false;
      }
    }
    
    return true;
  }

  private generateReport(): void {
    logger.info('');
    logger.info('📊 Nugget Extractor Test Report');
    logger.info('=' .repeat(50));
    
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    
    logger.info(`Overall: ${passed}/${total} tests passed (${((passed/total) * 100).toFixed(1)}%)`);
    logger.info('');
    
    // Group by extraction type
    const byType: { [key: string]: any[] } = {};
    for (const result of this.results) {
      const type = result.expected.type || 'null';
      if (!byType[type]) byType[type] = [];
      byType[type].push(result);
    }
    
    logger.info('Results by Type:');
    for (const [type, results] of Object.entries(byType)) {
      const typePassed = results.filter(r => r.passed).length;
      const typeTotal = results.length;
      const percentage = ((typePassed / typeTotal) * 100).toFixed(1);
      
      logger.info(`  ${type}: ${typePassed}/${typeTotal} (${percentage}%) ${typePassed === typeTotal ? '✅' : '❌'}`);
    }
    
    logger.info('');
    logger.info('Failed Tests:');
    const failed = this.results.filter(r => !r.passed);
    if (failed.length === 0) {
      logger.info('  None! 🎉');
    } else {
      for (const result of failed) {
        logger.info(`  ❌ ${result.name}`);
        if (result.error) {
          logger.info(`     Error: ${result.error}`);
        } else {
          logger.info(`     Expected: ${result.expected.type}="${result.expected.value}"`);
          if (result.actual) {
            logger.info(`     Got: ${result.actual.type}="${result.actual.value}" (conf=${result.actual.confidence})`);
          } else {
            logger.info(`     Got: null`);
          }
        }
      }
    }
    
    // Success criteria
    logger.info('');
    logger.info('Success Criteria:');
    const youtubeTests = this.results.filter(r => r.name.includes('YouTube'));
    const amazonTests = this.results.filter(r => r.name.includes('Amazon'));
    const gameTests = this.results.filter(r => r.name.includes('Apex') || r.name.includes('Game') || r.name.includes('damage'));
    
    const youtubeSuccess = youtubeTests.filter(r => r.passed).length / youtubeTests.length;
    const amazonSuccess = amazonTests.filter(r => r.passed).length / amazonTests.length;
    const gameSuccess = gameTests.filter(r => r.passed).length / gameTests.length;
    
    logger.info(`  ✅ YouTube title extraction ≥80%: ${(youtubeSuccess * 100).toFixed(1)}% ${youtubeSuccess >= 0.8 ? 'PASS' : 'FAIL'}`);
    logger.info(`  ✅ Amazon price extraction ≥80%: ${(amazonSuccess * 100).toFixed(1)}% ${amazonSuccess >= 0.8 ? 'PASS' : 'FAIL'}`);
    logger.info(`  ✅ Game score extraction ≥70%: ${(gameSuccess * 100).toFixed(1)}% ${gameSuccess >= 0.7 ? 'PASS' : 'FAIL'}`);
    logger.info(`  ✅ Overall success ≥75%: ${((passed/total) * 100).toFixed(1)}% ${(passed/total) >= 0.75 ? 'PASS' : 'FAIL'}`);
  }
}

async function main() {
  const test = new NuggetExtractorTest();
  
  try {
    await test.runTests();
    
    logger.info('🎉 Nugget extractor tests completed');
    process.exit(0);
  } catch (error) {
    logger.error('Nugget extractor tests failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
