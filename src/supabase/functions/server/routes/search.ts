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

// 1. Health endpoint
app.get('/health', (c) => {
  return c.json({
    ok: true,
    service: 'search',
    semanticSearch: 'frontend-compatible',
    timestamp: new Date().toISOString()
  });
});

// Hilfsfunktion: Escape Regex-Sonderzeichen
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// LADE HÄUFIGSTE ZUTATEN AUS DATENBANK
let commonIngredientsCache: string[] = [];
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000;

async function loadCommonIngredients(): Promise<string[]> {
  const now = Date.now();

  if (commonIngredientsCache.length > 0 && (now - cacheTimestamp) < CACHE_DURATION) {
    return commonIngredientsCache;
  }

  try {
    console.log('[INGREDIENTS] Loading common ingredients from database...');

    // Hole häufige Zutaten (vereinfachte Version)
    const { data: ingredients, error } = await supabase
      .from('test_ingredients')
      .select('name')
      .limit(200);

    if (error || !ingredients) {
      console.error('[INGREDIENTS] Error:', error);
      return getFallbackIngredients();
    }

    // Verarbeite Zutaten-Namen
    const commonIngredients = ingredients
      .map(ing => ing.name.toLowerCase().trim())
      .filter(name => {
        // Filtere problematische Namen (zu kurz oder mit vielen Sonderzeichen)
        if (name.length < 2) return false;
        if (name.includes(')') && !name.includes('(')) return false; // Ungleiche Klammern
        if (/[{}[\]\\]/.test(name)) return false; // Andere problematische Zeichen
        return true;
      })
      .map(name => {
        // Einfache Plural-zu-Singular Konvertierung
        let baseName = name;
        if (baseName.endsWith('ies')) baseName = baseName.replace(/ies$/, 'y');
        if (baseName.endsWith('es')) baseName = baseName.replace(/es$/, '');
        if (baseName.endsWith('s')) baseName = baseName.replace(/s$/, '');
        return baseName;
      })
      .filter((name, index, self) => {
        // Einzigartig und nicht zu ähnlich zu anderen
        const isUnique = self.indexOf(name) === index;
        const isNotSubstring = !self.some(other =>
          other !== name && (other.includes(name) || name.includes(other))
        );
        return isUnique && isNotSubstring;
      });

    // Cache speichern
    commonIngredientsCache = commonIngredients;
    cacheTimestamp = now;

    console.log(`[INGREDIENTS] Loaded ${commonIngredients.length} common ingredients`);
    console.log(`[INGREDIENTS] Sample: ${commonIngredients.slice(0, 10).join(', ')}`);

    return commonIngredients;

  } catch (error) {
    console.error('[INGREDIENTS] Error:', error);
    return getFallbackIngredients();
  }
}

function getFallbackIngredients(): string[] {
  return [
    'tomato', 'onion', 'garlic', 'potato', 'carrot', 'salt', 'pepper',
    'oil', 'butter', 'water', 'sugar', 'flour', 'egg', 'milk', 'cheese',
    'chicken', 'beef', 'pork', 'fish', 'rice', 'pasta', 'bread',
    'lemon', 'lime', 'herb', 'spice', 'cream', 'broth', 'stock',
    'salad', 'lettuce', 'cucumber', 'pepper', 'bean', 'lentil', 'pea'
  ];
}

// EXTRAHIERE ZUTATEN AUS QUERY - SICHERE VERSION
async function extractIngredientsFromQuery(query: string): Promise<string[]> {
  if (!query || !query.trim()) return [];

  try {
    // Lade häufige Zutaten
    const commonIngredients = await loadCommonIngredients();

    const queryLower = query.toLowerCase();
    const foundIngredients: string[] = [];

    // Liste von wichtigen Zutaten, die besonders priorisiert werden sollten
    const priorityIngredients = [
      'tomato', 'tomatoes', 'soup', 'lentil', 'lentils', 'parsley',
      'olive oil', 'olive', 'oil', 'fish', 'potato', 'potatoes',
      'chicken', 'beef', 'pork', 'salmon', 'cod', 'shrimp'
    ];

    // 1. Suche zuerst nach PRIORITÄTS-ZUTATEN
    priorityIngredients.forEach(ingredient => {
      if (queryLower.includes(ingredient)) {
        foundIngredients.push(ingredient);
      }
    });

    // 2. Dann nach anderen Zutaten suchen
    commonIngredients.forEach(ingredient => {
      if (queryLower.includes(ingredient) && !foundIngredients.includes(ingredient)) {
        // Prüfe ob es ein ganzes Wort ist
        const index = queryLower.indexOf(ingredient);
        const before = index > 0 ? queryLower[index - 1] : ' ';
        const after = index + ingredient.length < queryLower.length
          ? queryLower[index + ingredient.length]
          : ' ';

        const isWordBoundary = !/\w/.test(before) && !/\w/.test(after);

        if (isWordBoundary || ingredient.length > 4) {
          foundIngredients.push(ingredient);
        }
      }
    });

    // 3. Extrahiere "tomato soup" als Kombination
    if (queryLower.includes('tomato') && queryLower.includes('soup')) {
      if (!foundIngredients.includes('tomato soup')) {
        foundIngredients.push('tomato soup');
      }
    }

    // Entferne Duplikate
    const uniqueIngredients = [...new Set(foundIngredients.filter(i => i.length > 0))];

    console.log(`[QUERY-EXTRACT] Extracted ingredients: ${uniqueIngredients.join(', ')}`);
    return uniqueIngredients;

  } catch (error) {
    console.error('[QUERY-EXTRACT] Error:', error);
    return extractIngredientsSimple(query);
  }
}

// EINFACHE EXTRAKTION (Fallback)
function extractIngredientsSimple(query: string): string[] {
  if (!query) return [];

  const queryLower = query.toLowerCase();
  const found: string[] = [];

  // Liste von bekannten Zutaten (ohne problematische)
  const knownIngredients = [
    'tomato', 'tomatoes', 'salad', 'potato', 'potatoes', 'fish',
    'parsley', 'olive', 'oil', 'chicken', 'beef', 'pork', 'rice',
    'pasta', 'cheese', 'egg', 'milk', 'cream', 'butter', 'garlic',
    'onion', 'carrot', 'pepper', 'salt', 'sugar', 'flour', 'bread',
    'lemon', 'lime', 'herb', 'spice', 'water', 'broth', 'stock'
  ];

  knownIngredients.forEach(ing => {
    if (queryLower.includes(ing)) {
      found.push(ing);
    }
  });

  return [...new Set(found)];
}

// SEMANTISCHE ZUTATENSUCHE
async function semanticIngredientSearchWithBonus(query: string, limit: number = 30) {
  try {
    console.log(`[SEMANTIC] Semantic search for: "${query}"`);

    // Extrahiere Zutaten (mit Error-Handling)
    let queryIngredients: string[] = [];
    try {
      queryIngredients = await extractIngredientsFromQuery(query);
    } catch (error) {
      console.error('[SEMANTIC] Error extracting ingredients, using simple method:', error);
      queryIngredients = extractIngredientsSimple(query);
    }

    if (queryIngredients.length === 0) {
      console.log('[SEMANTIC] No ingredients extracted from query');
      return { ingredients: [], queryIngredients: [] };
    }

    // Hole Zutaten aus der Datenbank
    const { data: allIngredients, error } = await supabase
      .from('test_ingredients')
      .select('ingredient_id, name')
      .limit(300); // Begrenzt für Performance

    if (error || !allIngredients) {
      console.error('[SEMANTIC] Error loading ingredients:', error);
      return { ingredients: [], queryIngredients };
    }

    // Finde ähnliche Zutaten
    const allSimilarIngredients: Array<{
      ingredient_id: string;
      name: string;
      similarity: number;
      matched_query_ingredient: string;
    }> = [];

    queryIngredients.forEach(queryIngredient => {
      const queryIngLower = queryIngredient.toLowerCase();

      allIngredients.forEach(ingredient => {
        const nameLower = ingredient.name.toLowerCase();
        let similarity = 0;

        // 1. Exakter oder teilweiser Match
        if (nameLower === queryIngLower) {
          similarity = 1.0;
        } else if (nameLower.includes(queryIngLower) || queryIngLower.includes(nameLower)) {
          similarity = 0.8;
        }
        // 2. Ähnliche Basis (Plural/Singular)
        else {
          const nameBase = nameLower.replace(/s$/, '').replace(/es$/, '').replace(/ies$/, 'y');
          const queryBase = queryIngLower.replace(/s$/, '').replace(/es$/, '').replace(/ies$/, 'y');

          if (nameBase === queryBase) {
            similarity = 0.7;
          }
          // 3. Wort-Stamm Matching
          else if (nameBase.startsWith(queryBase) || queryBase.startsWith(nameBase)) {
            similarity = 0.6;
          }
        }

        if (similarity > 0.3) {
          allSimilarIngredients.push({
            ingredient_id: ingredient.ingredient_id,
            name: ingredient.name,
            similarity: similarity,
            matched_query_ingredient: queryIngredient
          });
        }
      });
    });

    // Sortiere und limitiere
    const sortedIngredients = allSimilarIngredients
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    console.log(`[SEMANTIC] Found ${sortedIngredients.length} ingredient matches`);

    return {
      ingredients: sortedIngredients,
      queryIngredients
    };

  } catch (error) {
    console.error('[SEMANTIC] Error:', error);
    return { ingredients: [], queryIngredients: [] };
  }
}


// NEUE FUNKTION: Berechne Namen-Match-Score (wie zuvor)
function calculateNameMatchScore(recipeName: string, query: string): { score: number, type: string } {
  if (!query || !query.trim()) return { score: 0, type: 'none' };

  const nameLower = recipeName.toLowerCase();
  const queryLower = query.toLowerCase().trim();

  // Extrahiere Schlüsselwörter aus der Query
  const stopWords = new Set(['i', 'want', 'an', 'a', 'the', 'because', 'have', 'and', 'with']);
  const queryWords = queryLower.split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
    .map(w => w.replace(/[.,!?;:]$/, '')); // Entferne Satzzeichen

  console.log(`[NAME-MATCH] Query words for "${recipeName}": ${queryWords.join(', ')}`);

  // 1. Exakter Match (Name = Query)
  if (nameLower === queryLower) {
    return { score: 12.0, type: 'exact' };
  }

  // 2. Name enthält die wichtigsten Query-Wörter in Reihenfolge
  // Für "tomato soup" → prüfe ob "tomato" UND "soup" im Namen sind
  const importantWords = queryWords.filter(word =>
    word.length > 3 && ['tomato', 'soup', 'lentil', 'parsley', 'olive', 'oil'].includes(word)
  );

  if (importantWords.length > 0) {
    const allImportantWordsInName = importantWords.every(word => nameLower.includes(word));
    const someImportantWordsInName = importantWords.some(word => nameLower.includes(word));

    if (allImportantWordsInName) {
      // EXTRA HOCHER SCORE FÜR ALLE WICHTIGEN WÖRTER
      const matchRatio = importantWords.filter(word => nameLower.includes(word)).length / importantWords.length;
      return {
        score: 10.0 + (matchRatio * 2.0), // 10.0-12.0
        type: 'all-important-words'
      };
    } else if (someImportantWordsInName) {
      const matchingImportantWords = importantWords.filter(word => nameLower.includes(word));
      const matchRatio = matchingImportantWords.length / importantWords.length;
      return {
        score: 8.0 + (matchRatio * 2.0), // 8.0-10.0
        type: 'some-important-words'
      };
    }
  }

  // 3. Name beginnt mit Query
  if (nameLower.startsWith(queryLower + ' ')) {
    return { score: 9.0, type: 'starts-with' };
  }

  // 4. Name endet mit Query
  if (nameLower.endsWith(' ' + queryLower)) {
    return { score: 8.5, type: 'ends-with' };
  }

  // 5. Name enthält Query als einzelnes Wort
  if (nameLower.includes(' ' + queryLower + ' ')) {
    return { score: 8.0, type: 'contains-word' };
  }

  // 6. Name enthält Query (irgendwo)
  if (nameLower.includes(queryLower)) {
    return { score: 7.0, type: 'contains' };
  }

  // 7. Alle Query-Wörter im Namen (ungeachtet der Reihenfolge)
  if (queryWords.length > 1 && queryWords.every(word => nameLower.includes(word))) {
    const matchRatio = queryWords.filter(word => nameLower.includes(word)).length / queryWords.length;
    return {
      score: 6.0 + (matchRatio * 2.0),
      type: 'all-words'
    };
  }

  // 8. Einige Query-Wörter im Namen
  if (queryWords.length > 0) {
    const matchingWords = queryWords.filter(word => nameLower.includes(word));
    const matchRatio = matchingWords.length / queryWords.length;

    if (matchRatio >= 0.5) {
      return {
        score: 4.0 + (matchRatio * 2.0),
        type: 'some-words'
      };
    } else if (matchRatio > 0) {
      return {
        score: 2.0 + (matchRatio * 2.0),
        type: 'few-words'
      };
    }
  }

  return { score: 0, type: 'none' };
}

// 2. Haupt-Suche - MIT DYNAMISCHEN ZUTATEN
app.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { query, k = 5, filters = {} } = body;

    console.log('\n=== SEARCH START ===');
    console.log(`[SEARCH] Query: "${query}"`);
    console.log(`[SEARCH] Requested: ${k} recipes`);

    const { dietType, difficulty, totalTime = [0, 240] } = filters;

    let recipeIds: string[] = [];
    let semanticScore: Record<string, number> = {};
    let searchStrategy = 'popular';
    let searchDetails: string[] = [];
    let queryIngredients: string[] = [];

    // SCHRITT 1: SEMANTISCHE SUCHE MIT ERROR-HANDLING
    if (query && query.trim() !== '') {
      let searchResult;
      try {
        searchResult = await semanticIngredientSearchWithBonus(query, 30);
      } catch (error) {
        console.error('[SEARCH] Semantic search failed, using text search only:', error);
        searchResult = { ingredients: [], queryIngredients: [] };
      }

      const similarIngredients = searchResult.ingredients;
      queryIngredients = searchResult.queryIngredients;

      if (similarIngredients.length > 0) {
        searchStrategy = 'semantic';
        searchDetails.push('ingredient matching');

        const ingredientIds = similarIngredients.map(ing => ing.ingredient_id);

        // Hole Rezept-Zutaten-Beziehungen
        const { data: recipeIngredients } = await supabase
          .from('test_recipe_ingredients')
          .select('recipe_id, ingredient_id')
          .in('ingredient_id', ingredientIds);

        if (recipeIngredients) {
          // Gruppiere nach Rezept und berechne Scores
          const recipeMatches: Record<string, Array<{
            similarity: number;
            matched_query_ingredient: string;
          }>> = {};

          recipeIngredients.forEach(ri => {
            if (!recipeMatches[ri.recipe_id]) {
              recipeMatches[ri.recipe_id] = [];
            }

            const ingMatch = similarIngredients.find(si => si.ingredient_id === ri.ingredient_id);
            if (ingMatch) {
              recipeMatches[ri.recipe_id].push({
                similarity: ingMatch.similarity,
                matched_query_ingredient: ingMatch.matched_query_ingredient
              });
            }
          });

          // Berechne Scores mit Kombinations-Bonus
          Object.entries(recipeMatches).forEach(([recipeId, matches]) => {
            let recipeScore = 0;

            // Basis-Score
            const baseScore = matches.reduce((sum, match) => sum + match.similarity, 0);
            recipeScore += baseScore;

            // KOMBINATIONS-BONUS
            const uniqueMatchedIngredients = [...new Set(matches.map(m => m.matched_query_ingredient))];

            if (uniqueMatchedIngredients.length > 1) {
              // Exponentieller Bonus
              const comboBonus = Math.pow(uniqueMatchedIngredients.length, 1.5) * 0.5;
              recipeScore += comboBonus;

              // Extra Bonuses
              if (uniqueMatchedIngredients.length >= 3) recipeScore += 2.0;
              if (uniqueMatchedIngredients.length >= 5) recipeScore += 3.0;
            }

            semanticScore[recipeId] = recipeScore;
          });

          recipeIds = Object.keys(recipeMatches);
          console.log(`[SEMANTIC] Found ${recipeIds.length} recipes with ingredient matches`);
        }
      }
    }

    // SCHRITT 2: TEXTSUCHE FÜR KURZE QUERIES
    if (recipeIds.length < k && query && query.trim().length < 100) {
      const { data: textMatches } = await supabase
        .from('test_recipes')
        .select('recipe_id')
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(k * 2);

      if (textMatches && textMatches.length > 0) {
        searchDetails.push('text search');

        textMatches.forEach(recipe => {
          if (!recipeIds.includes(recipe.recipe_id)) {
            recipeIds.push(recipe.recipe_id);
          }
          semanticScore[recipe.recipe_id] = Math.max(
            semanticScore[recipe.recipe_id] || 0,
            3.0
          );
        });
      }
    }

    // SCHRITT 3: FALLBACK
    if (recipeIds.length === 0) {
      console.log('[FALLBACK] No specific matches, returning popular recipes');
      const { data: popularRecipes } = await supabase
        .from('test_recipes')
        .select('recipe_id')
        .order('created_at', { ascending: false })
        .limit(k);

      recipeIds = popularRecipes?.map(r => r.recipe_id) || [];
    }

    console.log(`[SEARCH] Found ${recipeIds.length} recipes`);
    console.log(`[SEARCH] Query ingredients: ${queryIngredients.length > 0 ? queryIngredients.join(', ') : 'none detected'}`);

    if (recipeIds.length === 0) {
      return c.json({
        success: true,
        query,
        recipes: [],
        count: 0,
        strategy: searchStrategy,
        note: 'No recipes found'
      });
    }

    // SCHRITT 4: REZEPTDATEN
    const { data: recipes } = await supabase
      .from('test_recipes')
      .select('*')
      .in('recipe_id', recipeIds);

    if (!recipes || recipes.length === 0) {
      return c.json({
        success: true,
        query,
        recipes: [],
        count: 0,
        strategy: searchStrategy
      });
    }

    // SCHRITT 5: FILTER
    let filteredRecipes = recipes;

    if (dietType && dietType !== 'alle') {
      if (dietType === 'vegan') {
        filteredRecipes = filteredRecipes.filter(recipe => recipe.vegan === true);
      } else if (dietType === 'vegetarisch') {
        filteredRecipes = filteredRecipes.filter(recipe => recipe.vegetarian === true);
      }
    }

    if (difficulty && difficulty > 0) {
      filteredRecipes = filteredRecipes.filter(recipe => recipe.difficulty === difficulty);
    }

    if (Array.isArray(totalTime) && totalTime.length === 2) {
      filteredRecipes = filteredRecipes.filter(recipe =>
        recipe.total_time >= totalTime[0] && recipe.total_time <= totalTime[1]
      );
    }

    // SCHRITT 6: SCORING
    const recipesWithScores = filteredRecipes
      .map(recipe => {
        let finalScore = semanticScore[recipe.recipe_id] || 0;
        const nameMatch = calculateNameMatchScore(recipe.name, query || '');

        // Name-Match-Score
        finalScore += nameMatch.score;

        // Beschreibungs-Match
        if (query) {
          const descLower = recipe.description?.toLowerCase() || '';
          if (descLower.includes(query.toLowerCase())) {
            finalScore += 2.0;
          }
        }

        return {
          ...recipe,
          semantic_score: finalScore,
          name_match_type: nameMatch.type,
          name_match_score: nameMatch.score
        };
      })
      .sort((a, b) => b.semantic_score - a.semantic_score);

    // SCHRITT 7: QUALITÄTSFILTERUNG
    const scores = recipesWithScores.map(r => r.semantic_score);
    const maxScore = Math.max(...scores, 1);

    // Dynamischer Grenzwert
    const baseThreshold = Math.max(maxScore * 0.35, 3.0);
    const qualityThreshold = queryIngredients.length > 2
      ? baseThreshold + 1.0
      : baseThreshold;

    console.log(`[SCORE] Max: ${maxScore.toFixed(2)}, Threshold: ${qualityThreshold.toFixed(2)}`);

    const qualityRecipes = recipesWithScores.filter(r => r.semantic_score >= qualityThreshold);

    // Entferne Duplikate
    const seenNames = new Set();
    const uniqueRecipes = qualityRecipes.filter(recipe => {
      if (seenNames.has(recipe.name)) return false;
      seenNames.add(recipe.name);
      return true;
    });

    // Nimm die besten (max k)
    const limitedRecipes = uniqueRecipes.slice(0, k);

    console.log(`[FINAL] Showing ${limitedRecipes.length} recipes`);

    // SCHRITT 8: ZUTATEN LADEN
    const finalRecipeIds = limitedRecipes.map(r => r.recipe_id);

    const { data: recipeIngredients } = await supabase
      .from('test_recipe_ingredients')
      .select('recipe_id, ingredient_id, amount, unit, quantity_text')
      .in('recipe_id', finalRecipeIds);

    const { data: allIngredients } = await supabase
      .from('test_ingredients')
      .select('ingredient_id, name');

    const ingredientMap: Record<string, string> = {};
    if (allIngredients) {
      allIngredients.forEach(ing => {
        ingredientMap[ing.ingredient_id] = ing.name;
      });
    }

    // SCHRITT 9: FINALE REZEPTE
    const finalRecipes = limitedRecipes.map(recipe => {
      let ingredientList: any[] = [];
      let matchedCount = 0;

      if (recipeIngredients) {
        const recipeIngs = recipeIngredients.filter(ri => ri.recipe_id === recipe.recipe_id);
        ingredientList = recipeIngs.map(ri => {
          const ingredientName = ingredientMap[ri.ingredient_id] || 'Unknown';

          // Zähle Matches mit Query-Zutaten
          if (queryIngredients.some(queryIng =>
            ingredientName.toLowerCase().includes(queryIng.toLowerCase())
          )) {
            matchedCount++;
          }

          return {
            name: ingredientName,
            amount: ri.amount,
            unit: ri.unit,
            quantity_text: ri.quantity_text
          };
        }).filter(ing => ing.name !== 'Unknown');
      }

      return {
        ...recipe,
        ingredients: ingredientList,
        // Debug-Info entfernen für Response
      };
    });

    // Debug-Ausgabe
    console.log('[RESULTS] Sorted by relevance:');
    finalRecipes.forEach((recipe, i) => {
      console.log(`  ${i+1}. "${recipe.name}" (score: ${recipe.semantic_score.toFixed(2)})`);
    });

    console.log('=== SEARCH END ===\n');

    return c.json({
          success: true,
          query,
          recipes: finalRecipes,
          count: 0,
          strategy: searchStrategy,
          note: 'Implementation in progress'
        });

      } catch (err: any) {
        console.error('[SEARCH] Error:', err);
        return c.json({
          error: err.message,
          strategy: 'error'
        }, 500);
      }
    });

    export default app;