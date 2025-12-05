// search.ts - MIT BILD
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { supabase } from '../services/database.ts';

const app = new Hono();

app.use('*', cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Hilfsfunktion für Terminal-Ausgabe MIT BILD
function formatRecipeForTerminal(recipe: any, index: number): string {
  return `
==================================================
ERGEBNIS ${index + 1}: ${recipe.name}
==================================================
📝 Beschreibung: ${recipe.description?.substring(0, 100)}...
🥗 Diät: ${recipe.diet} | 🥬 Vegan: ${recipe.vegan} | 🌱 Vegetarisch: ${recipe.vegetarian}
⏱️  Zeit: ${recipe.total_time}min | 🎯 Schwierigkeit: ${recipe.difficulty}/5
💰 Preis: ${recipe.price_per_serving} | 🏆 FINAL SCORE: ${recipe.score?.toFixed(4) || 'N/A'}
🖼️  Bild: ${recipe.image_url || 'Kein Bild verfügbar'}

📋 ZUTATEN (${recipe.ingredients?.length || 0}):
${recipe.ingredients?.slice(0, 5).map((ing: any) => `  • ${ing.name}: ${ing.quantity_text || ''}`).join('\n')}
${recipe.ingredients && recipe.ingredients.length > 5 ? `  ... und ${recipe.ingredients.length - 5} weitere Zutaten\n` : ''}
📖 ZUBEREITUNG:
${recipe.instructions?.substring(0, 200) || 'Keine Anleitung verfügbar'}...

🔗 Recipe ID: ${recipe.recipe_id}
`;
}

// Health endpoint
app.get('/health', (c) => {
  return c.json({
    ok: true,
    service: 'search',
    semanticSearch: 'Python-backend-integrated',
    timestamp: new Date().toISOString()
  });
});

// Haupt-Suche
app.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { query, k = 5, filters = {} } = body;

    console.log('\n' + '='.repeat(60));
    console.log(`🔍 SEMANTISCHE SUCHE START für: "${query}"`);
    console.log('='.repeat(60));

    // ========== PYTHON SEMANTISCHE SUCHE AUFRUFEN ==========
    const pythonScriptPath = "C:/Users/nicow/Documents/SoupMate/src/supabase/functions/server/scripts/main.py";

    const command = new Deno.Command("python", {
      args: [
        "-c",
        `import sys; sys.path.append(r'C:/Users/nicow/Documents/SoupMate/src/supabase/functions/server/scripts'); from services.search_service import EmbeddingService; s = EmbeddingService(); r = s.search_by_text('${query.replace(/'/g, "\\'")}', ${k}); import json; from decimal import Decimal; print(json.dumps(r, default=lambda x: float(x) if isinstance(x, Decimal) else x))`
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await command.output();

    if (code !== 0) {
      const error = new TextDecoder().decode(stderr);
      console.error("[PYTHON] Error:", error);
      throw new Error(`Python search failed: ${error}`);
    }

    const pythonOutput = new TextDecoder().decode(stdout);

    // JSON parsen
    let pythonResults;
    try {
      pythonResults = JSON.parse(pythonOutput);
    } catch (e) {
      console.error("[JSON PARSE ERROR]:", pythonOutput);
      throw new Error("Failed to parse Python output");
    }

    if (!Array.isArray(pythonResults)) {
      throw new Error("Python did not return an array of recipes");
    }

    console.log(`✅ Python returned ${pythonResults.length} recipes\n`);

    // ========== DETAILLIERTE TERMINAL-AUSGABE ==========
    console.log('🏆 ERGEBNISSE MIT SCORES:');
    console.log('-'.repeat(60));

    pythonResults.forEach((recipe: any, index: number) => {
      console.log(formatRecipeForTerminal(recipe, index));

      // Zusätzliche Score-Details
      console.log(`🔍 SCORE DETAILS für "${recipe.name}":`);
      if (recipe.distance_text !== undefined) {
        const textSim = 1.0 / (1.0 + recipe.distance_text);
        const textScore = 0.6 * textSim;
        const ingSim = recipe.distance_ingredients ? 1.0 / (1.0 + recipe.distance_ingredients) : 0;
        const ingScore = 0.4 * ingSim;
        const baseScore = textScore + ingScore;

        console.log(`   Text Distance: ${recipe.distance_text.toFixed(4)}`);
        console.log(`   Text Similarity: 1/(1+${recipe.distance_text.toFixed(4)}) = ${textSim.toFixed(4)}`);
        console.log(`   Text Score: 0.6 × ${textSim.toFixed(4)} = ${textScore.toFixed(4)}`);

        if (recipe.distance_ingredients) {
          console.log(`   Ingredients Distance: ${recipe.distance_ingredients.toFixed(4)}`);
          console.log(`   Ingredients Similarity: 1/(1+${recipe.distance_ingredients.toFixed(4)}) = ${ingSim.toFixed(4)}`);
          console.log(`   Ingredients Score: 0.4 × ${ingSim.toFixed(4)} = ${ingScore.toFixed(4)}`);
        }

        console.log(`   Base Score (Text + Ingredients): ${baseScore.toFixed(4)}`);

        if (recipe.score !== undefined) {
          const boostPenalty = recipe.score - baseScore;
          if (Math.abs(boostPenalty) > 0.001) {
            console.log(`   Adjustments: ${boostPenalty > 0 ? '➕' : '➖'} ${Math.abs(boostPenalty).toFixed(4)}`);
          }
        }
      }
      console.log('');
    });

    console.log('='.repeat(60));
    console.log(`📊 ZUSAMMENFASSUNG: ${pythonResults.length} Rezepte gefunden`);
    if (pythonResults.length > 0) {
      const avgScore = pythonResults.reduce((sum: number, r: any) => sum + (r.score || 0), 0) / pythonResults.length;
      const maxScore = Math.max(...pythonResults.map((r: any) => r.score || 0));
      const minScore = Math.min(...pythonResults.map((r: any) => r.score || 0));
      console.log(`   Durchschnittlicher Score: ${avgScore.toFixed(4)}`);
      console.log(`   Bester Score: ${maxScore.toFixed(4)}`);
      console.log(`   Schlechtester Score: ${minScore.toFixed(4)}`);
    }
    console.log('='.repeat(60) + '\n');

    // ========== FILTER ANWENDEN ==========
    const { dietType, difficulty, totalTime = [0, 240] } = filters;
    let filteredRecipes = pythonResults;

    if (dietType && dietType !== 'alle') {
      if (dietType === 'vegan') {
        filteredRecipes = filteredRecipes.filter((recipe: any) => recipe.vegan === true);
      } else if (dietType === 'vegetarisch') {
        filteredRecipes = filteredRecipes.filter((recipe: any) => recipe.vegetarian === true);
      }
    }

    if (difficulty && difficulty > 0) {
      filteredRecipes = filteredRecipes.filter((recipe: any) => recipe.difficulty === difficulty);
    }

    if (Array.isArray(totalTime) && totalTime.length === 2) {
      filteredRecipes = filteredRecipes.filter((recipe: any) =>
        recipe.total_time >= totalTime[0] && recipe.total_time <= totalTime[1]
      );
    }

    // ========== ZUTATEN AUS DATENBANK HOLEN (optional) ==========
    const finalRecipes = await Promise.all(
      filteredRecipes.slice(0, k).map(async (recipe: any) => {
        try {
          // Hole zusätzliche Zutaten-Details aus Supabase
          const { data: recipeIngredients } = await supabase
            .from('test_recipe_ingredients')
            .select('ingredient_id, amount, unit, quantity_text')
            .eq('recipe_id', recipe.recipe_id);

          let detailedIngredients = recipe.ingredients || [];

          if (recipeIngredients && recipeIngredients.length > 0) {
            const ingredientIds = recipeIngredients.map((ri: any) => ri.ingredient_id);
            const { data: ingredientsData } = await supabase
              .from('test_ingredients')
              .select('ingredient_id, name')
              .in('ingredient_id', ingredientIds);

            if (ingredientsData) {
              const ingredientMap: Record<string, string> = {};
              ingredientsData.forEach((ing: any) => {
                ingredientMap[ing.ingredient_id] = ing.name;
              });

              detailedIngredients = recipeIngredients.map((ri: any) => ({
                name: ingredientMap[ri.ingredient_id] || ri.ingredient_id,
                amount: ri.amount,
                unit: ri.unit,
                quantity_text: ri.quantity_text
              }));
            }
          }

          return {
            ...recipe,
            ingredients: detailedIngredients
          };
        } catch (error) {
          console.error(`[RECIPE ENHANCE] Error for ${recipe.recipe_id}:`, error);
          return recipe; // Fallback zum Original-Rezept
        }
      })
    );

    // ========== ANTWORT AN FRONTEND ==========
    return c.json({
      success: true,
      query,
      recipes: finalRecipes,
      count: finalRecipes.length,
      strategy: 'semantic_embedding',
      summary: {
        average_score: pythonResults.length > 0 ?
          (pythonResults.reduce((sum: number, r: any) => sum + (r.score || 0), 0) / pythonResults.length).toFixed(4) : 0,
        best_score: pythonResults.length > 0 ?
          Math.max(...pythonResults.map((r: any) => r.score || 0)).toFixed(4) : 0,
        worst_score: pythonResults.length > 0 ?
          Math.min(...pythonResults.map((r: any) => r.score || 0)).toFixed(4) : 0
      }
    });

  } catch (err: any) {
    console.error('[SEARCH] Error:', err);
    return c.json({
      success: false,
      error: err.message,
      note: 'Check Python backend'
    }, 500);
  }
});

export default app;