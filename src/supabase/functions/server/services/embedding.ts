// services/embedding.ts

// Falls ihr später echte Embeddings (OpenAI, HuggingFace etc.) nutzt,
// kannst du die Implementierung hier ersetzen.
export class EmbeddingService {
    constructor() {}

  // häufig genutzter Name
  async embed(text: string): Promise<number[]> {
    // TODO: echte Embedding-Logik
    return [];
  }

  // Alias, falls im Code embedText verwendet wird
  async embedText(text: string): Promise<number[]> {
    return this.embed(text);
  }

  // Praktisch für Batch-Operationen
  async embedMany(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embed(t)));
  }
}

// 👉 damit geht sowohl:
// import { EmbeddingService } from "../services/embedding.ts"
// als auch:
// import EmbeddingService from "../services/embedding.ts"
export default EmbeddingService;
