// services/spoonacular.ts
export class SpoonacularService {
    private apiKey: string;

constructor(apiKey = Deno.env.get("SPOONACULAR_API_KEY") ?? "") {
    this.apiKey = apiKey;
  }

  // Benenne die Methoden so, wie sie in routes/recipes.ts aufgerufen werden.
  // Zur Sicherheit bieten wir zwei gängige Varianten an:

  async search(query: string, number = 10) {
    console.log(`[Spoonacular] search "${query}" x${number} (key ${this.apiKey.slice(0,4)}***)`);
    return [];
  }

  async fetchRecipes(query: string, number = 10) {
    // Alias auf search, falls im Code fetchRecipes verwendet wird
    return this.search(query, number);
  }

  async getById(id: number) {
    console.log(`[Spoonacular] getById ${id}`);
    return null;
  }
}

// ➜ so funktioniert sowohl `import { SpoonacularService } ...` als auch `import SpoonacularService ...`
export default SpoonacularService;
