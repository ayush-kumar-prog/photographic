export class SearchService {
  async initialize() {
    console.log('SearchService initialized (stub)');
  }
  
  async search(query: any) {
    return {
      mode: 'jog',
      confidence: 0.5,
      cards: []
    };
  }
}
