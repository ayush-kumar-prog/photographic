export class AnswerService {
  async initialize() {
    console.log('AnswerService initialized (stub)');
  }
  
  async generateAnswer(body: any) {
    return {
      text: 'Stub answer',
      citations: [],
      confidence: 0.5
    };
  }
}
