// server/routes/search.ts - VOLLSTÄNDIG MIT DETAILLIERTER TERMINALAUSGABE
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { EmbeddingService } from '../services/embedding.ts';
import { supabase } from '../services/database.ts';
import { config } from '../config/environment.ts';

const app = new Hono();

app.use(
  '*',
  cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'apikey', 'Access-Control-Allow-Origin'],
    exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
    credentials: true,
    maxAge: 86400,
  })
);

const embeddingService = new EmbeddingService();

// Allergie-Schlüsselwörter Mapping
const allergyKeywords: Record<string, string[]> = {
  "Gluten": [
    "wheat", "rye", "barley", "oats", "spelt", "bulgur",
    "semolina", "couscous", "flour", "gluten", "wheat flour",
    "rye flour", "spelt flour", "wheat bran", "whole wheat flour",
    "bread", "pasta", "noodle", "breadcrumbs", "cereal", "granola",
    "malt", "brewers", "beer", "ale", "stout", "wheat beer",
    "soy sauce", "teriyaki", "worcestershire", "gravy", "roux",
    "breading", "batter", "cake", "cookie", "biscuit", "cracker",
    "pastry", "pie crust", "pancake", "waffle", "dough", "doughnut",
    "muffin", "bagel", "pretzel", "crouton", "stuffing", "dressing",
    "seitan", "farro", "kamut", "triticale", "matzo", "matzah",
    "wheat germ", "wheat grass", "wheat starch", "modified food starch",
    "hydrolyzed wheat protein", "wheat protein", "vital wheat gluten"
  ],
  "Laktose": [
    "milk", "cream", "yogurt", "curd", "cheese", "butter",
    "lactose", "whey", "cream", "sour cream", "crème fraîche",
    "buttermilk", "kefir", "mozzarella", "feta", "parmesan",
    "cottage cheese", "ricotta", "gouda", "cheddar", "brie",
    "camembert", "provolone", "swiss", "monterey jack", "blue cheese",
    "goat cheese", "cream cheese", "mascarpone", "quark", "yoghurt",
    "greek yogurt", "ice cream", "gelato", "whipped cream", "half and half",
    "evaporated milk", "condensed milk", "powdered milk", "dry milk",
    "milk powder", "lactose", "milk solid", "milk protein", "casein",
    "caseinate", "whey protein", "whey powder", "dairy", "dairy product"
  ],
  "Nüsse": [
    "nut", "nuts", "almond", "almonds", "hazelnut", "walnut",
    "peanut", "cashew", "brazil nut", "pistachio", "macadamia",
    "marzipan", "nut butter", "peanut butter", "nut oil", "peanut oil",
    "pecan", "chestnut", "pine nut", "pignoli", "pinenut",
    "beech nut", "butternut", "hickory nut", "kuiku nut", "lichee nut",
    "nutella", "praline", "nut meal", "nut paste", "nut extract",
    "walnut oil", "almond oil", "hazelnut oil", "macadamia oil",
    "peanut flour", "almond flour", "hazelnut flour", "chestnut flour",
    "mixed nuts", "trail mix", "granola with nuts", "nut crunch",
    "nut brittle", "nut cluster", "nut topping", "nut sprinkles"
  ],
  "Soja": [
    "soy", "soya", "tofu", "soy milk", "soy sauce", "soy oil",
    "soy lecithin", "edamame", "tempeh", "soybean", "soy flour",
    "soy protein", "miso", "soybean paste", "natto", "soy curd",
    "soy yogurt", "soy cream", "soy cheese", "soy butter",
    "soy nut", "soy bacon", "soy chorizo", "soy burger", "soy hot dog",
    "textured vegetable protein", "tvp", "soy isolate", "soy concentrate",
    "soy fiber", "soy germ", "soy sprout", "soy milk powder",
    "soy protein concentrate", "soy protein isolate", "hydrolyzed soy protein",
    "soy sauce powder", "soy lecithin", "soybean oil", "soy margarine",
    "teriyaki sauce", "hoisin sauce", "soy-based", "soy-derived"
  ],
  "Eier": [
    "egg", "eggs", "egg white", "egg yolk", "whole egg",
    "chicken egg", "egg powder", "egg substitute", "egg nog",
    "mayonnaise", "mayo", "albumin", "albumen", "ovalbumin",
    "ovomucin", "ovomucoid", "ovotransferrin", "ovoglobulin",
    "livetin", "vitellin", "egg protein", "dried egg", "frozen egg",
    "egg solid", "egg wash", "egg glaze", "egg batter", "egg breading",
    "egg noodle", "egg pasta", "egg roll", "egg wrap", "egg drop soup",
    "custard", "flan", "creme brulee", "meringue", "souffle",
    "hollandaise", "béarnaise", "aioli", "tartar sauce", "cream puff",
    "eclair", "macaron", "marzipan", "nougat", "marshmallow",
    "quiche", "frittata", "omelet", "scrambled egg", "deviled egg"
  ],
  "Fisch": [
    "fish", "salmon", "tuna", "trout", "cod", "pollock",
    "herring", "sardine", "mackerel", "flounder", "zander",
    "fish fillet", "fish broth", "fish sauce", "anchovy", "anchovies",
    "seafood", "shellfish", "bass", "catfish", "grouper", "haddock",
    "halibut", "mahi mahi", "orange roughy", "perch", "pike", "snapper",
    "sole", "swordfish", "tilapia", "whitefish", "whiting", "monkfish",
    "caviar", "roe", "fish egg", "fish cake", "fish ball", "fish stick",
    "fish patty", "fish stock", "fish soup", "fish chowder", "fish stew",
    "fish curry", "fish paste", "fish powder", "fish extract", "fish oil",
    "omega-3", "fish collagen", "fish gelatin", "isinglass", "worcestershire",
    "caesar dressing", "thai fish sauce", "nam pla", "nuoc mam",
    "bagoong", "patis", "fish vinegar", "bonito", "dashi", "katsuobushi"
  ],
  "Schalentiere": [
    "shrimp", "prawn", "crab", "lobster", "crayfish",
    "scampi", "mussel", "oyster", "clam", "squid",
    "octopus", "cuttlefish", "shellfish", "crustacean",
    "seafood", "crawfish", "craw dad", "langoustine", "krill",
    "barnacle", "conch", "whelk", "periwinkle", "abalone",
    "escargot", "snail", "limpet", "cockle", "geoduck",
    "surimi", "imitation crab", "imitation lobster", "seafood stick",
    "crab stick", "lobster paste", "shrimp paste", "fish paste",
    "seafood broth", "shellfish stock", "clam juice", "oyster sauce",
    "shrimp sauce", "crab sauce", "lobster sauce", "seafood seasoning",
    "old bay", "cajun seasoning", "paella", "cioppino", "bouillabaisse",
    "seafood gumbo", "clam chowder", "lobster bisque", "shrimp bisque"
  ],
  "Sellerie": [
    "celery", "celery leaf", "celery stalk", "celery root",
    "celery seed", "celery salt", "celery powder", "celeriac",
    "celery juice", "celery extract", "celery essential oil",
    "celery flake", "dried celery", "celery herb", "celery greens",
    "celery tops", "celery heart", "celery rib", "celery stick",
    "celery soup", "celery broth", "celery stock", "celery seasoning",
    "celery spice", "celery flavor", "natural celery flavor",
    "celery concentrate", "celery derivative", "celery-based"
  ]
};

// ========== HILFSFUNKTION FÜR TERMINAL-AUSGABE ==========
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

// ========== ZUTATEN-FILTER FUNKTION ==========
function filterByIngredients(recipes: any[], ingredientsFilter: string): any[] {
  if (!ingredientsFilter || ingredientsFilter.trim() === '') {
    console.log('[INGREDIENTS] No ingredients filter');
    return recipes;
  }

  // BINDEWÖRTER DURCH KOMMAS ERSETZEN
  const normalizedInput = ingredientsFilter
    .toLowerCase()
    .replace(/\b(and|und|&|with|mit|plus|also|as well as|lastly|last|\+)\b/gi, ',')
    .replace(/\s*,\s*/g, ',')
    .replace(/,+/g, ',')
    .replace(/^,|,$/g, '');

  const searchTerms = normalizedInput
    .split(',')
    .map(term => term.trim())
    .filter(term => term !== '');

  console.log(`[INGREDIENTS] Original input: "${ingredientsFilter}"`);
  console.log(`[INGREDIENTS] Normalized input: "${normalizedInput}"`);
  console.log(`[INGREDIENTS] Filtering ${recipes.length} recipes for ingredients: ${searchTerms.join(', ')}`);

  const filtered = recipes.filter(recipe => {
    const ingredientsArray = recipe.ingredients || [];

    const allIngredients = ingredientsArray
      .map((ing: any) => {
        if (typeof ing === 'string') {
          return ing.toLowerCase();
        } else if (ing && typeof ing === 'object' && ing.name) {
          return ing.name.toLowerCase();
        }
        return '';
      })
      .join(' ')
      .toLowerCase();

    const allTermsFound = searchTerms.every(term =>
      allIngredients.includes(term.toLowerCase())
    );

    if (!allTermsFound) {
      const missingTerms = searchTerms.filter(term =>
        !allIngredients.includes(term.toLowerCase())
      );
      console.log(`[INGREDIENTS] ❌ Excluded: "${recipe.name}" - Missing: ${missingTerms.join(', ')}`);
      return false;
    }

    console.log(`[INGREDIENTS] ✅ Included: "${recipe.name}"`);
    return true;
  });

  console.log(`[INGREDIENTS] Filter result: ${recipes.length} -> ${filtered.length} recipes`);
  return filtered;
}

// ========== ALLERGIEN-FILTER FUNKTION ==========
function filterByAllergies(recipes: any[], allergies: string[]): any[] {
  if (!allergies || allergies.length === 0) {
    console.log('[ALLERGY] No allergies to filter');
    return recipes;
  }

  console.log(`[ALLERGY] Filtering ${recipes.length} recipes for allergies: ${allergies.join(', ')}`);

  const filtered = recipes.filter(recipe => {
    const ingredientsArray = recipe.ingredients || [];

    const allIngredients = ingredientsArray
      .map((ing: any) => {
        if (typeof ing === 'string') {
          return ing.toLowerCase();
        } else if (ing && typeof ing === 'object' && ing.name) {
          return ing.name.toLowerCase();
        } else if (ing && typeof ing === 'object' && ing.display) {
          return ing.display.toLowerCase();
        }
        return '';
      })
      .join(' ')
      .toLowerCase();

    let excludedReason = '';

    const hasAllergen = allergies.some(allergy => {
      const keywords = allergyKeywords[allergy];
      if (!keywords) {
        console.log(`[ALLERGY] Warning: No keywords defined for allergy: ${allergy}`);
        return false;
      }

      const matchingKeyword = keywords.find(keyword => {
        const pattern = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'i');
        return pattern.test(allIngredients);
      });

      if (matchingKeyword) {
        excludedReason = `${allergy} (keyword: ${matchingKeyword})`;
        return true;
      }

      return false;
    });

    if (hasAllergen) {
      console.log(`[ALLERGY] ❌ Excluded: "${recipe.name}" - Reason: ${excludedReason}`);
      console.log(`[ALLERGY]   Ingredients: ${allIngredients}`);
      return false;
    }

    console.log(`[ALLERGY] ✅ Included: "${recipe.name}"`);
    return true;
  });

  console.log(`[ALLERGY] Filter result: ${recipes.length} -> ${filtered.length} recipes`);
  return filtered;
}

function normalizeError(err: any) {
  return {
    message: err?.message ?? String(err),
    code: err?.code,
    details: err?.details,
    hint: err?.hint,
  };
}

function ok<T>(c: any, payload: T) {
  return c.json(payload, 200);
}

function fail(c: any, err: any, httpStatus = 500, label = 'Error') {
  const info = normalizeError(err);
  console.error(`[${label}]`, info);
  return c.json(
    {
      error: 'Database query failed',
      ...info,
    },
    httpStatus
  );
}

async function getIngredientsForRecipes(recipeIds: string[]) {
  try {
    console.log('🔍 STEP 1: Searching for recipe IDs in test_recipe_ingredients:', recipeIds);

    if (!recipeIds || recipeIds.length === 0) {
      console.log('⚠️ No recipe IDs provided');
      return {};
    }

    const { data: recipeIngredients, error: recipeIngredientsError } = await supabase
      .from('test_recipe_ingredients')
      .select('recipe_id, ingredient_id, amount, unit, quantity_text')
      .in('recipe_id', recipeIds);

    if (recipeIngredientsError) {
      console.error('❌ Error searching test_recipe_ingredients:', recipeIngredientsError);
      return {};
    }

    console.log('📊 Found in test_recipe_ingredients:', {
      count: recipeIngredients?.length,
      data: recipeIngredients
    });

    if (!recipeIngredients || recipeIngredients.length === 0) {
      console.log('⚠️ No entries found in test_recipe_ingredients for these recipe IDs');
      return {};
    }

    const ingredientIds = recipeIngredients.map(item => item.ingredient_id).filter(Boolean);
    const uniqueIngredientIds = [...new Set(ingredientIds)];

    console.log('🔍 STEP 2: Unique ingredient IDs to search in test_ingredients:', uniqueIngredientIds);

    if (uniqueIngredientIds.length === 0) {
      console.log('⚠️ No valid ingredient IDs found');
      return {};
    }

    const { data: ingredients, error: ingredientsError } = await supabase
      .from('test_ingredients')
      .select('ingredient_id, name')
      .in('ingredient_id', uniqueIngredientIds);

    if (ingredientsError) {
      console.error('❌ Error searching test_ingredients:', ingredientsError);
      return {};
    }

    console.log('📊 Found in test_ingredients:', {
      count: ingredients?.length,
      data: ingredients
    });

    if (!ingredients || ingredients.length === 0) {
      console.log('⚠️ No ingredient names found in test_ingredients for these IDs');
      return {};
    }

    const ingredientNameMap: Record<string, string> = {};
    ingredients.forEach(ingredient => {
      ingredientNameMap[ingredient.ingredient_id] = ingredient.name;
    });

    console.log('📋 Ingredient ID to Name mapping:', ingredientNameMap);

    const ingredientsByRecipe: Record<string, any[]> = {};

    recipeIngredients.forEach(recipeIngredient => {
      const recipeId = recipeIngredient.recipe_id;
      const ingredientId = recipeIngredient.ingredient_id;

      if (!ingredientsByRecipe[recipeId]) {
        ingredientsByRecipe[recipeId] = [];
      }

      const ingredientName = ingredientNameMap[ingredientId];
      if (ingredientName) {
        const finalIngredient = {
          name: ingredientName,
          amount: recipeIngredient.amount,
          unit: recipeIngredient.unit,
          quantity_text: recipeIngredient.quantity_text
        };

        ingredientsByRecipe[recipeId].push(finalIngredient);
        console.log(`✅ ADDED: Recipe ${recipeId} -> ${ingredientName}`, finalIngredient);
      } else {
        console.log(`❌ MISSING: No name found for ingredient_id ${ingredientId} in recipe ${recipeId}`);
      }
    });

    console.log('🎯 FINAL RESULT - Ingredients grouped by recipe:', {
      recipesWithIngredients: Object.keys(ingredientsByRecipe),
      totalIngredients: Object.values(ingredientsByRecipe).flat().length,
      details: ingredientsByRecipe
    });

    return ingredientsByRecipe;

  } catch (err) {
    console.error('❌ Unexpected error in getIngredientsForRecipes:', err);
    return {};
  }
}

// ========== ROUTES ==========
app.post('/debug-search', async (c) => {
  try {
    const body = await c.req.json();
    const { query } = body;

    console.log('[DEBUG] Raw database query for:', query);

    const { data: rawRecipes, error } = await supabase
      .from('test_recipes')
      .select('recipe_id, name')
      .ilike('name', `%${query}%`);

    if (error) throw error;

    console.log('[DEBUG] Raw results:', {
      count: rawRecipes?.length,
      recipes: rawRecipes?.map(r => ({ id: r.recipe_id, name: r.name }))
    });

    const recipeIdCounts: Record<string, number> = {};
    rawRecipes?.forEach(recipe => {
      recipeIdCounts[recipe.recipe_id] = (recipeIdCounts[recipe.recipe_id] || 0) + 1;
    });

    const duplicates = Object.entries(recipeIdCounts).filter(([_, count]) => count > 1);

    console.log('[DEBUG] Duplicate analysis:', {
      totalRecipes: rawRecipes?.length,
      uniqueRecipes: new Set(rawRecipes?.map(r => r.recipe_id)).size,
      duplicates: duplicates.length > 0 ? duplicates : 'No duplicates found'
    });

    return c.json({
      success: true,
      analysis: {
        total: rawRecipes?.length,
        unique: new Set(rawRecipes?.map(r => r.recipe_id)).size,
        duplicates: duplicates
      },
      recipes: rawRecipes
    });

  } catch (err) {
    console.error('[DEBUG] Error:', err);
    return c.json({ error: err.message }, 500);
  }
});

app.get('/health', (c) => ok(c, { ok: true, service: 'search', ts: new Date().toISOString() }));

app.get('/debug-db', async (c) => {
  try {
    console.log('🔍 DEBUG: Checking actual data in tables...');

    const { data: recipes, error: recipesError } = await supabase
      .from('test_recipes')
      .select('recipe_id, name')
      .limit(3);

    console.log('📊 Sample recipes:', recipes);

    if (recipesError) {
      console.error('❌ Error fetching recipes:', recipesError);
    }

    const recipeIds = recipes?.map(r => r.recipe_id) || [];
    let recipeIngredients = [];

    if (recipeIds.length > 0) {
      const { data: relations, error: relationsError } = await supabase
        .from('test_recipe_ingredients')
        .select('*')
        .in('recipe_id', recipeIds)
        .limit(10);

      console.log('📊 test_recipe_ingredients for sample recipes:', relations);
      recipeIngredients = relations || [];

      if (relationsError) {
        console.error('❌ Error fetching recipe_ingredients:', relationsError);
      }
    }

    const { data: allIngredients, error: ingredientsError } = await supabase
      .from('test_ingredients')
      .select('ingredient_id, name')
      .limit(10);

    console.log('📊 Sample ingredients:', allIngredients);

    if (ingredientsError) {
      console.error('❌ Error fetching ingredients:', ingredientsError);
    }

    let ingredientsResult = {};
    if (recipeIds.length > 0) {
      ingredientsResult = await getIngredientsForRecipes(recipeIds);
    }

    return c.json({
      success: true,
      sample_recipes: recipes,
      sample_recipe_ingredients: recipeIngredients,
      sample_ingredients: allIngredients,
      ingredients_test_result: ingredientsResult,
      message: 'Check server logs for detailed database info'
    });

  } catch (err) {
    console.error('❌ Debug error:', err);
    return c.json({ error: String(err) }, 500);
  }
});

app.get('/debug', async (c) => {
  try {
    const table = config.database.tableNames.recipes;
    const { error } = await supabase
      .from(table)
      .select('recipe_id', { count: 'exact', head: true });

    if (error) throw error;
    return ok(c, { ok: true, table, reachable: true });
  } catch (err) {
    return fail(c, err, 500, 'DebugError');
  }
});

// ========== HAUPT-SUCHE MIT PYTHON & FILTERN ==========
app.post('/', async (c) => {
  const t0 = Date.now();

  try {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 HAUPTSUCHE MIT PYTHON-BACKEND');
    console.log('='.repeat(60));

    let body;
    try {
      body = await c.req.json();
      console.log('[SEARCH] Request body:', body);
    } catch (parseError) {
      return c.json({ error: 'Invalid JSON' }, 400);
    }

    const { query, type = 'text', k = 5, filters = {} } = body ?? {};

    const {
      dietType = 'alle',
      difficulty = 0,
      workTime = [0, 120],
      totalTime = [0, 240],
      allergies = [],
      ingredients: ingredientsFilter = ''
    } = filters;

    console.log('[SEARCH] Filter für diese Suche:', {
      query,
      dietType,
      difficulty,
      workTime,
      totalTime,
      allergies: allergies.length,
      ingredientsFilter
    });

    // ========== PYTHON SEMANTISCHE SUCHE ==========
    console.log('\n🔍 STARTE PYTHON-SEMANTISCHE SUCHE');
    console.log('-'.repeat(40));

    let pythonResults: any[] = [];
    try {
      const command = new Deno.Command("python", {
        args: [
          "-c",
          `import sys; sys.path.append(r'C:/Users/nicow/Documents/SoupMate/src/supabase/functions/server/scripts'); from services.search_service import EmbeddingService; s = EmbeddingService(); r = s.search_by_text('${query.replace(/'/g, "\\'")}', ${k * 3}); import json; from decimal import Decimal; print(json.dumps(r, default=lambda x: float(x) if isinstance(x, Decimal) else x))`
        ],
        stdout: "piped",
        stderr: "piped",
      });

      const { code, stdout, stderr } = await command.output();

      if (code !== 0) {
        const error = new TextDecoder().decode(stderr);
        console.error('[PYTHON] Error:', error);
        throw new Error(`Python search failed: ${error}`);
      }

      const pythonOutput = new TextDecoder().decode(stdout);
      pythonResults = JSON.parse(pythonOutput);

      if (!Array.isArray(pythonResults)) {
        throw new Error("Python did not return an array of recipes");
      }

      console.log(`✅ Python lieferte ${pythonResults.length} Roh-Ergebnisse`);

      // Detaillierte Python-Ergebnisse anzeigen
      console.log('\n📊 PYTHON ERGEBNISSE MIT SCORES:');
      console.log('-'.repeat(60));

      pythonResults.forEach((recipe: any, index: number) => {
        console.log(`\n${index + 1}. ${recipe.name}`);
        console.log(`   Score: ${recipe.score?.toFixed(4) || 'N/A'} | Text Distanz: ${recipe.distance_text?.toFixed(4) || 'N/A'}`);
        console.log(`   Vegan: ${recipe.vegan} | Vegetarisch: ${recipe.vegetarian}`);
        console.log(`   Zeit: ${recipe.total_time}min | Schwierigkeit: ${recipe.difficulty}/5`);

        // Score Details
        if (recipe.base_score !== undefined) {
          console.log(`   Base Score: ${recipe.base_score.toFixed(4)}`);
        }
        if (recipe.ingredient_match_score !== undefined) {
          console.log(`   Ingredient Match Score: ${recipe.ingredient_match_score.toFixed(4)}`);
        }

        // Query Zutaten anzeigen
        if (recipe.query_ingredients && recipe.query_ingredients.length > 0) {
          console.log(`   Query Zutaten: ${recipe.query_ingredients.join(', ')}`);
        }
      });

    } catch (pythonError) {
      console.error('[PYTHON] Python search error:', pythonError);
      console.log('[SEARCH] Fallback zu Datenbanksuche');

      const { data, error } = await supabase
        .from('test_recipes')
        .select('*')
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(k * 2);

      if (error) throw error;
      pythonResults = data || [];
    }

    // ========== DUPLIKATE ENTFERNEN ==========
    console.log('\n🧹 ENTFERNE DUPLIKATE');
    console.log('-'.repeat(40));

    const seenNames = new Set<string>();
    const uniqueResults = [];

    for (const recipe of pythonResults) {
      if (!recipe.name || seenNames.has(recipe.name)) {
        console.log(`⚠️ Überspringe Duplikat: ${recipe.name || 'Unnamed'}`);
        continue;
      }
      seenNames.add(recipe.name);
      uniqueResults.push(recipe);
    }

    console.log(`📊 Nach Duplikat-Entfernung: ${uniqueResults.length} eindeutige Rezepte`);

    // ========== ZUTATEN AUS DATENBANK HOLEN ==========
    let recipesWithIngredients = uniqueResults;
    if (uniqueResults.length > 0) {
      console.log('\n🗃️ HOLE ZUTATEN AUS DATENBANK');
      console.log('-'.repeat(40));

      const recipeIds = uniqueResults.map(r => r.recipe_id);
      const ingredientsByRecipe = await getIngredientsForRecipes(recipeIds);

      recipesWithIngredients = uniqueResults.map(recipe => ({
        ...recipe,
        ingredients: ingredientsByRecipe[recipe.recipe_id] || []
      }));
    }

    // ========== FILTER ANWENDEN ==========
    console.log('\n🎯 WENDE FILTER AN');
    console.log('-'.repeat(40));

    let filteredRecipes = recipesWithIngredients;
    const filterStats = {
      initialCount: uniqueResults.length,
      afterIngredients: 0,
      afterAllergies: 0,
      afterDiet: 0,
      afterDifficulty: 0,
      afterTime: 0,
      finalCount: 0
    };

    // 1. ZUTATENFILTER
    if (ingredientsFilter && ingredientsFilter.trim() !== '' && filteredRecipes.length > 0) {
      const beforeCount = filteredRecipes.length;
      filteredRecipes = filterByIngredients(filteredRecipes, ingredientsFilter);
      filterStats.afterIngredients = filteredRecipes.length;
      console.log(`📊 Zutatenfilter: ${beforeCount} -> ${filteredRecipes.length} Rezepte`);
    }

    // 2. ALLERGIEN FILTER
    if (allergies && allergies.length > 0 && filteredRecipes.length > 0) {
      const beforeCount = filteredRecipes.length;
      filteredRecipes = filterByAllergies(filteredRecipes, allergies);
      filterStats.afterAllergies = filteredRecipes.length;
      console.log(`📊 Allergiefilter: ${beforeCount} -> ${filteredRecipes.length} Rezepte`);
    }

    // 3. ERNÄHRUNGSTYP FILTER
    if (dietType !== 'alle' && filteredRecipes.length > 0) {
      const beforeCount = filteredRecipes.length;

      if (dietType === 'vegan') {
        filteredRecipes = filteredRecipes.filter(recipe => recipe.vegan === true);
      } else if (dietType === 'vegetarisch') {
        filteredRecipes = filteredRecipes.filter(recipe => recipe.vegetarian === true);
      }
      filterStats.afterDiet = filteredRecipes.length;
      console.log(`📊 Diätfilter (${dietType}): ${beforeCount} -> ${filteredRecipes.length} Rezepte`);
    }

    // 4. SCHWIERIGKEITSGRAD FILTER
    if (difficulty > 0 && filteredRecipes.length > 0) {
      const beforeCount = filteredRecipes.length;
      filteredRecipes = filteredRecipes.filter(recipe => recipe.difficulty === difficulty);
      filterStats.afterDifficulty = filteredRecipes.length;
      console.log(`📊 Schwierigkeitsfilter (${difficulty}): ${beforeCount} -> ${filteredRecipes.length} Rezepte`);
    }

    // 5. ZEITFILTER
    if (totalTime && totalTime.length === 2 && filteredRecipes.length > 0) {
      const beforeCount = filteredRecipes.length;
      const [minTime, maxTime] = totalTime;

      if (minTime > 0 || maxTime < 240) {
        filteredRecipes = filteredRecipes.filter(recipe => {
          const recipeTime = recipe.total_time || 0;
          return recipeTime >= minTime && recipeTime <= maxTime;
        });
      }
      filterStats.afterTime = filteredRecipes.length;
      console.log(`📊 Zeitfilter (${minTime}-${maxTime}min): ${beforeCount} -> ${filteredRecipes.length} Rezepte`);
    }

    filterStats.finalCount = filteredRecipes.length;

    // ========== DETAILLIERTE ERGEBNIS-AUSGABE ==========
    console.log('\n' + '='.repeat(60));
    console.log('🏆 FINALE ERGEBNISSE');
    console.log('='.repeat(60));

    if (filteredRecipes.length === 0) {
      console.log('❌ Keine Rezepte gefunden, die allen Filtern entsprechen.');
    } else {
      filteredRecipes.forEach((recipe: any, index: number) => {
        console.log(formatRecipeForTerminal(recipe, index));

        // Score Details anzeigen
        console.log(`🔍 SCORE DETAILS für "${recipe.name}":`);

        if (recipe.base_score !== undefined) {
          console.log(`   Base Score (from Python): ${recipe.base_score.toFixed(4)}`);
        }

        if (recipe.ingredient_match_score !== undefined) {
          console.log(`   Ingredient Match Score: ${recipe.ingredient_match_score.toFixed(4)}`);
        }

        if (recipe.distance_text !== undefined) {
          const textSim = Math.max(0, 1.0 - recipe.distance_text / 2.0);
          const textScore = 0.9 * textSim;

          const ingSim = recipe.distance_ingredients ?
            Math.max(0, 1.0 - recipe.distance_ingredients / 2.0) : 0;
          const ingScore = 0.1 * ingSim;

          const baseScore = textScore + ingScore;

          console.log(`   Text Distance: ${recipe.distance_text.toFixed(4)}`);
          console.log(`   Text Similarity: 1 - ${recipe.distance_text.toFixed(4)}/2 = ${textSim.toFixed(4)}`);
          console.log(`   Text Score: 0.9 × ${textSim.toFixed(4)} = ${textScore.toFixed(4)}`);

          if (recipe.distance_ingredients) {
            console.log(`   Ingredients Distance: ${recipe.distance_ingredients.toFixed(4)}`);
            console.log(`   Ingredients Similarity: 1 - ${recipe.distance_ingredients.toFixed(4)}/2 = ${ingSim.toFixed(4)}`);
            console.log(`   Ingredients Score: 0.1 × ${ingSim.toFixed(4)} = ${ingScore.toFixed(4)}`);
          }

          console.log(`   Base Score (Text + Ingredients): ${baseScore.toFixed(4)}`);

          if (recipe.base_score !== undefined && recipe.score !== undefined) {
            const adjustments = recipe.score - recipe.base_score;
            if (Math.abs(adjustments) > 0.001) {
              console.log(`   Adjustments: ${adjustments > 0 ? '➕' : '➖'} ${Math.abs(adjustments).toFixed(4)}`);
            }
          }

          console.log(`   Final Score: ${recipe.score?.toFixed(4) || 'N/A'}`);
        }

        // Query-Zutaten und Matches anzeigen
        if (recipe.query_ingredients && recipe.ingredients) {
          console.log(`   Query Zutaten: ${recipe.query_ingredients.join(', ') || 'keine'}`);

          const matched = recipe.query_ingredients.filter((qIng: string) =>
            recipe.ingredients.some((rIng: any) => {
              const qLower = qIng.toLowerCase();
              const rLower = rIng.name.toLowerCase();
              return rLower.includes(qLower) || qLower.includes(rLower);
            })
          );
          console.log(`   Gematchte Zutaten: ${matched.join(', ') || 'keine'} (${matched.length}/${recipe.query_ingredients.length})`);
        }
        console.log('');
      });
    }

    // ========== FILTER-ZUSAMMENFASSUNG ==========
    console.log('\n' + '='.repeat(60));
    console.log('📊 FILTER-ZUSAMMENFASSUNG');
    console.log('='.repeat(60));

    console.log(`🔍 Suchbegriff: "${query}"`);
    console.log(`📈 Python Roh-Ergebnisse: ${pythonResults.length}`);
    console.log(`🧹 Nach Duplikat-Entfernung: ${uniqueResults.length}`);

    if (ingredientsFilter && ingredientsFilter.trim() !== '') {
      const excludedByIngredients = filterStats.initialCount - filterStats.afterIngredients;
      console.log(`🥕 Zutatenfilter ("${ingredientsFilter}"): ${filterStats.afterIngredients} Rezepte (+${excludedByIngredients} ausgeschlossen)`);
    }

    if (allergies && allergies.length > 0) {
      const excludedByAllergies = filterStats.afterIngredients - filterStats.afterAllergies;
      console.log(`⚠️  Allergiefilter (${allergies.join(', ')}): ${filterStats.afterAllergies} Rezepte (+${excludedByAllergies} ausgeschlossen)`);
    }

    if (dietType !== 'alle') {
      const excludedByDiet = filterStats.afterAllergies - filterStats.afterDiet;
      console.log(`🌱 Diätfilter (${dietType}): ${filterStats.afterDiet} Rezepte (+${excludedByDiet} ausgeschlossen)`);
    }

    if (difficulty > 0) {
      const excludedByDifficulty = filterStats.afterDiet - filterStats.afterDifficulty;
      console.log(`⭐ Schwierigkeitsfilter (${difficulty}/5): ${filterStats.afterDifficulty} Rezepte (+${excludedByDifficulty} ausgeschlossen)`);
    }

    if (totalTime && totalTime.length === 2 && (totalTime[0] > 0 || totalTime[1] < 240)) {
      const excludedByTime = filterStats.afterDifficulty - filterStats.afterTime;
      console.log(`⏱️  Zeitfilter (${totalTime[0]}-${totalTime[1]}min): ${filterStats.afterTime} Rezepte (+${excludedByTime} ausgeschlossen)`);
    }

    console.log(`\n🎯 FINALE ERGEBNISSE: ${filteredRecipes.length} Rezepte`);

    if (filteredRecipes.length > 0) {
      const avgScore = filteredRecipes.reduce((sum: number, r: any) => sum + (r.score || 0), 0) / filteredRecipes.length;
      const maxScore = Math.max(...filteredRecipes.map((r: any) => r.score || 0));
      const minScore = Math.min(...filteredRecipes.map((r: any) => r.score || 0));
      console.log(`📊 Score Statistik:`);
      console.log(`   Durchschnitt: ${avgScore.toFixed(4)}`);
      console.log(`   Bester: ${maxScore.toFixed(4)}`);
      console.log(`   Schlechtester: ${minScore.toFixed(4)}`);
    }

    const totalExcluded = filterStats.initialCount - filterStats.finalCount;
    console.log(`\n📉 INSGESAMT AUSGESCHLOSSEN: ${totalExcluded} von ${filterStats.initialCount} Rezepten`);
    console.log('='.repeat(60) + '\n');

    // ========== ERGEBNISSE BEGRENZEN ==========
    const finalRecipes = filteredRecipes.slice(0, k);

    const dt = Date.now() - t0;
    console.log(`⏱️  Gesamtdauer: ${dt}ms`);

    // ========== ANTWORT AN FRONTEND ==========
    return c.json({
      success: true,
      type,
      k,
      query: query || '',
      recipes: finalRecipes,
      count: finalRecipes.length,
      responseTime: dt,
      filterSummary: {
        pythonResults: pythonResults.length,
        afterDeduplication: uniqueResults.length,
        afterIngredientsFilter: filterStats.afterIngredients,
        afterAllergyFilter: filterStats.afterAllergies,
        afterDietFilter: filterStats.afterDiet,
        afterDifficultyFilter: filterStats.afterDifficulty,
        afterTimeFilter: filterStats.afterTime,
        finalResults: filterStats.finalCount,
        totalExcluded: totalExcluded
      }
    });

  } catch (err: any) {
    console.error('[SEARCH] Unexpected error:', err);
    return c.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: err.message
      },
      500
    );
  }
});

app.get('/debug-recipe-structure', async (c) => {
  try {
    console.log('🔍 DEBUG: Checking recipe structure and diet flags...');

    const { data: recipes, error } = await supabase
      .from('test_recipes')
      .select('*')
      .limit(5);

    if (error) {
      console.error('❌ Error fetching recipes:', error);
      return c.json({ error: error.message }, 500);
    }

    console.log('📊 Full recipe structure:', recipes);

    const dietInfo = recipes?.map(recipe => ({
      recipe_id: recipe.recipe_id,
      name: recipe.name,
      vegan: recipe.vegan,
      vegetarian: recipe.vegetarian,
      is_vegan: recipe.is_vegan,
      is_vegetarian: recipe.is_vegetarian,
      diet_type: recipe.diet_type,
      all_columns: Object.keys(recipe)
    }));

    return c.json({
      success: true,
      diet_info: dietInfo,
      message: 'Check server logs for full structure'
    });

  } catch (err) {
    console.error('❌ Debug error:', err);
    return c.json({ error: String(err) }, 500);
  }
});

export default app;