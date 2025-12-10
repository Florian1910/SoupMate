// server/routes/search.ts - KORRIGIERTE VERSION MIT FIX FÜR PRICE_PER_SERVING
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { EmbeddingService } from '../services/embedding.ts';
import { supabase } from '../services/database.ts';
import { config } from '../config/environment.ts';

const app = new Hono();
const TEXT_WEIGHT = 0.7;
const ING_WEIGHT = 0.3;

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
  // FIX: price_per_serving als String behandeln
  const price = recipe.price_per_serving || 'N/A';
  const priceStr = typeof price === 'number' ? price.toFixed(2) + '€' : String(price);

  return `
==================================================
ERGEBNIS ${index + 1}: ${recipe.name}
==================================================
📝 Beschreibung: ${recipe.description?.substring(0, 100)}...
🥗 Diät: ${recipe.diet} | 🥬 Vegan: ${recipe.vegan} | 🌱 Vegetarisch: ${recipe.vegetarian}
⏱️  Zeit: ${recipe.total_time}min | 🎯 Schwierigkeit: ${recipe.difficulty}/5
💰 Preis: ${priceStr} | 🏆 FINAL SCORE: ${recipe.score?.toFixed(4) || 'N/A'}
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

// ========== KOMBINIERTE SCORE-AUSGABE FUNKTION ==========
function printCombinedScoreDetails(recipe: any) {
  console.log('\nKOMBINIERTE SCORE DETAILS FÜR "' + (recipe.name || 'Ohne Name') + '":');
  console.log('   Text Score: ' + (recipe.text_score !== undefined ? recipe.text_score.toFixed(4) : 'N/A'));
  console.log('   Ingredients Score: ' + (recipe.ingredients_score !== undefined ? recipe.ingredients_score.toFixed(4) : 'N/A'));
  console.log('   Combined Score: ' + (recipe.combined_score !== undefined ? recipe.combined_score.toFixed(4) : 'N/A'));
  console.log('   Final Score: ' + (recipe.score !== undefined ? recipe.score.toFixed(4) : 'N/A'));

  if (recipe.text_score !== undefined && recipe.ingredients_score !== undefined) {
    const textScore = recipe.text_score || 0;
    const ingScore = recipe.ingredients_score || 0;

    const weightedText = textScore * TEXT_WEIGHT;
    const weightedIngredients = ingScore * ING_WEIGHT;
    const sum = weightedText + weightedIngredients;

    console.log(
      '   Berechnung: (Text: ' +
        textScore.toFixed(4) +
        ' x ' +
        TEXT_WEIGHT +
        ') + (Zutaten: ' +
        ingScore.toFixed(4) +
        ' x ' +
        ING_WEIGHT +
        ')'
    );
    console.log('                = ' + weightedText.toFixed(4) + ' + ' + weightedIngredients.toFixed(4));
    console.log('                = ' + sum.toFixed(4));

    if (recipe.combined_score !== undefined) {
      const diff = Math.abs(recipe.combined_score - sum);
      if (diff > 0.0001) {
        console.log(
          '   Hinweis: Combined Score (' +
            recipe.combined_score.toFixed(4) +
            ') weicht von Berechnung ab (Delta=' +
            diff.toFixed(6) +
            ')'
        );
      }
    }
  }
}

// ========== HAUPT-SUCHE MIT PYTHON & FILTERN ==========
app.post('/', async (c) => {
  const t0 = Date.now();

  try {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 HAUPTSUCHE MIT PYTHON CLEAN_SEARCH');
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
    console.log(`\n🐍 STARTE PYTHON CLEAN_SEARCH (KOMBINIERTE SUCHE)`);
    console.log(`🔍 Query: "${query}"`);
    console.log(`📁 Python Skript: clean_search.py`);
    console.log(
      '🎯 Methode: ' +
        (TEXT_WEIGHT * 100) +
        '% Text-Ähnlichkeit + ' +
        (ING_WEIGHT * 100) +
        '% Zutaten-Ähnlichkeit'
    );

    let pythonResults: any[] = [];

    try {
      // ABSOLUTER PFAD ZUM PYTHON-SKRIPT
        const pythonScriptPath = './scripts/clean_search.py';
      console.log("Python script path:", pythonScriptPath);

      const command = new Deno.Command("python", {
        args: [
          pythonScriptPath,
          query
        ],
        stdout: "piped",
        stderr: "piped"
      });

      const { code, stdout, stderr } = await command.output();

      // Debug-Ausgabe
      const stderrText = new TextDecoder().decode(stderr);
      const stdoutText = new TextDecoder().decode(stdout);

      // Python Debug-Output zeigen
      if (
        stderrText.includes('SEARCH') ||
        stderrText.includes('INFO') ||
        stderrText.includes('ERROR')
      ) {
        console.log(); // leere Zeile
        console.log('PYTHON OUTPUT (stderr):');
        console.log(stderrText);
      }

          console.log('[PYTHON] stdout length:', stdoutText.length, 'chars');

          if (code !== 0) {
            console.error('[PYTHON] Error code:', code);
            console.error('[PYTHON] stderr:', stderrText);
            throw new Error('Python search failed: ' + stderrText);
          }

          // Ausgabe-Ausschnitt zeigen
          console.log('[PYTHON] First 500 chars of stdout:\n' + stdoutText.substring(0, 500));

          // Versuche JSON zu parsen
          try {
            pythonResults = JSON.parse(stdoutText);
            console.log('PYTHON clean_search lieferte ' + pythonResults.length + ' Roh-Ergebnisse (COMBINED Search)');

            // Score-Infos der ersten paar Rezepte anzeigen
            console.log('\nPYTHON SCORE DETAILS VON CLEAN_SEARCH:');
            console.log(Array(50).join('-'));

            pythonResults.slice(0, Math.min(3, pythonResults.length)).forEach((recipe: any, index: number) => {
              console.log('\n' + (index + 1) + '. ' + (recipe.name ? recipe.name.substring(0, 40) : 'Ohne Name') + '...');
              console.log('   Text Score: ' + (recipe.text_score !== undefined ? recipe.text_score.toFixed(4) : 'N/A'));
              console.log('   Ingredients Score: ' + (recipe.ingredients_score !== undefined ? recipe.ingredients_score.toFixed(4) : 'N/A'));
              console.log('   Combined Score: ' + (recipe.combined_score !== undefined ? recipe.combined_score.toFixed(4) : 'N/A'));
              console.log('   Final Score (von Python): ' + (recipe.score !== undefined ? recipe.score.toFixed(4) : 'N/A'));
            });

          } catch (parseError: any) {
            console.error('[PYTHON] JSON parse error:', parseError.message);

            // Versuche, nur den JSON-Teil zu extrahieren (falls zusätzlicher Text vorhanden ist)
            const jsonMatch = stdoutText.match(/\[.*\]|\{.*\}/s);
            if (jsonMatch) {
              console.log('[PYTHON] Trying to extract JSON from output...');
              pythonResults = JSON.parse(jsonMatch[0]);
              console.log('[PYTHON] Extracted ' + pythonResults.length + ' Ergebnisse');
            } else {
              throw parseError;
            }
          }

        } catch (pythonError) {
          console.error('[PYTHON] Python search error:', pythonError);
          console.log('[SEARCH] Fallback zu Datenbanksuche');

          const { data, error } = await supabase
            .from('test_recipes')
            .select('*')
            .or('name.ilike.%' + query + '%,description.ilike.%' + query + '%')
            .limit(k * 2);

          if (error) {
            console.error('[SEARCH] Database fallback error:', error);
            pythonResults = [];
          } else {
            pythonResults = data || [];
          }
        }

        // ========== STATISTIK ÜBER PYTHON SCORES ==========
        if (pythonResults.length > 0) {
          const avgText = pythonResults.reduce((sum: number, r: any) => sum + (r.text_score || 0), 0) / pythonResults.length;
          const avgIngredients = pythonResults.reduce((sum: number, r: any) => sum + (r.ingredients_score || 0), 0) / pythonResults.length;
          const avgCombined = pythonResults.reduce((sum: number, r: any) => sum + (r.combined_score || 0), 0) / pythonResults.length;

          console.log('\nPYTHON SCORE STATISTIK:');
          console.log('   Text Score Durchschnitt: ' + avgText.toFixed(4));
          console.log('   Ingredients Score Durchschnitt: ' + avgIngredients.toFixed(4));
          console.log('   Combined Score Durchschnitt: ' + avgCombined.toFixed(4));
          console.log('   Suchmethode: clean_search.py (Kombinierte Suche)');
        }

        // ========== DUPLIKATE ENTFERNEN ==========
        console.log('\nENTFERNE DUPLIKATE');
        console.log(Array(40).join('-'));

        const seenNames = new Set<string>();
        const uniqueResults: any[] = [];

        for (const recipe of pythonResults) {
          if (!recipe.name || seenNames.has(recipe.name)) {
            console.log('Duplikat übersprungen: ' + (recipe.name || 'Unnamed'));
            continue;
          }

          const enrichedRecipe = {
            ...recipe,
            text_score: recipe.text_score || recipe.score || 0,
            ingredients_score: recipe.ingredients_score || 0,
            combined_score: recipe.combined_score || recipe.score || 0,
            _search_source: 'python_clean_search'
          };

          seenNames.add(recipe.name);
          uniqueResults.push(enrichedRecipe);
        }

        console.log('Nach Duplikat-Entfernung: ' + uniqueResults.length + ' eindeutige Rezepte mit Python-Scores');

        // ========== ZUTATEN AUS DATENBANK HOLEN ==========
        let recipesWithIngredients = uniqueResults;
        if (uniqueResults.length > 0) {
          console.log('\nHOLE ZUTATEN AUS DATENBANK');
          console.log(Array(40).join('-'));

          const recipeIds = uniqueResults.map(r => r.recipe_id);
          const ingredientsByRecipe = await getIngredientsForRecipes(recipeIds);

          recipesWithIngredients = uniqueResults.map(recipe => ({
            ...recipe,
            ingredients: ingredientsByRecipe[recipe.recipe_id] || []
          }));
        }

        // ========== FILTER ANWENDEN ==========
        console.log('\nWENDE FILTER AN');
        console.log(Array(40).join('-'));

        let filteredRecipes = recipesWithIngredients;
        const filterStats = {
          initialCount: uniqueResults.length,
          afterIngredients: filteredRecipes.length,
          afterAllergies: filteredRecipes.length,
          afterDiet: filteredRecipes.length,
          afterDifficulty: filteredRecipes.length,
          afterTime: filteredRecipes.length,
          finalCount: filteredRecipes.length
        };

        // 1. Zutatenfilter
        if (ingredientsFilter && ingredientsFilter.trim() !== '' && filteredRecipes.length > 0) {
          const beforeCount = filteredRecipes.length;
          filteredRecipes = filterByIngredients(filteredRecipes, ingredientsFilter);
          filterStats.afterIngredients = filteredRecipes.length;
          console.log('Zutatenfilter: ' + beforeCount + ' -> ' + filteredRecipes.length + ' Rezepte');
        }

        // 2. Allergienfilter
        if (allergies && allergies.length > 0 && filteredRecipes.length > 0) {
          const beforeCount = filteredRecipes.length;
          filteredRecipes = filterByAllergies(filteredRecipes, allergies);
          filterStats.afterAllergies = filteredRecipes.length;
          console.log('Allergiefilter (' + allergies.join(', ') + '): ' + beforeCount + ' -> ' + filteredRecipes.length + ' Rezepte');
        }

        // 3. Diätfilter
        if (dietType !== 'alle' && filteredRecipes.length > 0) {
          const beforeCount = filteredRecipes.length;

          if (dietType === 'vegan') {
            filteredRecipes = filteredRecipes.filter(recipe => recipe.vegan === true);
          } else if (dietType === 'vegetarisch') {
            filteredRecipes = filteredRecipes.filter(recipe => recipe.vegetarian === true);
          }

          filterStats.afterDiet = filteredRecipes.length;
          console.log('Diätfilter (' + dietType + '): ' + beforeCount + ' -> ' + filteredRecipes.length + ' Rezepte');
        }

        // 4. Schwierigkeitsfilter
        if (difficulty > 0 && filteredRecipes.length > 0) {
          const beforeCount = filteredRecipes.length;
          filteredRecipes = filteredRecipes.filter(recipe => recipe.difficulty === difficulty);
          filterStats.afterDifficulty = filteredRecipes.length;
          console.log('Schwierigkeitsfilter (' + difficulty + '): ' + beforeCount + ' -> ' + filteredRecipes.length + ' Rezepte');
        }

        // 5. Zeitfilter
        if (totalTime && totalTime.length === 2 && filteredRecipes.length > 0) {
          const beforeCount = filteredRecipes.length;
          const minTime = totalTime[0];
          const maxTime = totalTime[1];

          if (minTime > 0 || maxTime < 240) {
            filteredRecipes = filteredRecipes.filter(recipe => {
              const recipeTime = recipe.total_time || 0;
              return recipeTime >= minTime && recipeTime <= maxTime;
            });
          }

          filterStats.afterTime = filteredRecipes.length;
          console.log('Zeitfilter (' + minTime + '-' + maxTime + 'min): ' + beforeCount + ' -> ' + filteredRecipes.length + ' Rezepte');
        }

        filterStats.finalCount = filteredRecipes.length;

        // ========== DETAILLIERTE ERGEBNIS-AUSGABE ==========
        console.log('\n' + Array(60).join('='));
        console.log('FINALE ERGEBNISSE MIT KOMBINIERTEN SCORES');
        console.log(Array(60).join('='));

        if (filteredRecipes.length === 0) {
          console.log('Keine Rezepte gefunden, die allen Filtern entsprechen.');
        } else {
          filteredRecipes.forEach((recipe: any, index: number) => {
            console.log('\n' + Array(50).join('='));
            console.log('ERGEBNIS ' + (index + 1) + ': ' + recipe.name);
            console.log(Array(50).join('='));

            console.log('Beschreibung: ' + (recipe.description ? recipe.description.substring(0, 100) + '...' : 'N/A'));
            console.log('Diät: ' + ((recipe.diets && recipe.diets.join(' | ')) || recipe.diet || 'N/A'));
            console.log('Zeit: ' + (recipe.total_time || 0) + 'min | Schwierigkeit: ' + (recipe.difficulty || 0) + '/5');

            const price = recipe.price_per_serving;
            let priceDisplay = 'N/A';
            if (price !== undefined && price !== null) {
              if (typeof price === 'number') {
                priceDisplay = price.toFixed(2) + '€';
              } else {
                priceDisplay = String(price);
              }
            }
            console.log('Preis: ' + priceDisplay);

            console.log('Final Score: ' + (recipe.score !== undefined ? recipe.score.toFixed(4) : 'N/A'));
            console.log('Bild: ' + (recipe.image_url || recipe.image || 'N/A'));

            if (recipe.ingredients && recipe.ingredients.length > 0) {
              console.log('\nZUTATEN (' + recipe.ingredients.length + '):');
              recipe.ingredients.slice(0, 5).forEach((ing: any) => {
                console.log(
                  '  - ' +
                    (ing.name || '') +
                    ': ' +
                    (ing.amount || '') +
                    ' ' +
                    (ing.unit || '') +
                    ' ' +
                    (ing.quantity_text || '')
                );
              });
              if (recipe.ingredients.length > 5) {
                console.log('  ... und ' + (recipe.ingredients.length - 5) + ' weitere Zutaten');
              }
            }

            if (recipe.instructions) {
              console.log('\nZUBEREITUNG:');
              const shortInstructions = recipe.instructions.substring(0, 200);
              console.log(shortInstructions + (recipe.instructions.length > 200 ? '...' : ''));
            }

            console.log('\nRecipe ID: ' + (recipe.id || recipe.recipe_id || 'N/A'));

            // Score-Details
            printCombinedScoreDetails(recipe);
            console.log('');
          });
        }

        // ========== ERWEITERTE FILTER-ZUSAMMENFASSUNG ==========
        console.log('\n' + Array(60).join('='));
        console.log('ERWEITERTE FILTER-ZUSAMMENFASSUNG');
        console.log(Array(60).join('='));

        console.log('Suchbegriff: "' + (query || '') + '"');
        console.log('Python Roh-Ergebnisse (clean_search.py): ' + pythonResults.length);
        console.log('Nach Duplikat-Entfernung: ' + uniqueResults.length);

        if (ingredientsFilter && ingredientsFilter.trim() !== '') {
          const excludedByIngredients = filterStats.initialCount - filterStats.afterIngredients;
          console.log(
            'Zutatenfilter ("' +
              ingredientsFilter +
              '"): ' +
              filterStats.afterIngredients +
              ' Rezepte (+' +
              excludedByIngredients +
              ' ausgeschlossen)'
          );
        }

        if (allergies && allergies.length > 0) {
          const excludedByAllergies = filterStats.afterIngredients - filterStats.afterAllergies;
          console.log(
            'Allergiefilter (' +
              allergies.join(', ') +
              '): ' +
              filterStats.afterAllergies +
              ' Rezepte (+' +
              excludedByAllergies +
              ' ausgeschlossen)'
          );
        }

        if (dietType !== 'alle') {
          const excludedByDiet = filterStats.afterAllergies - filterStats.afterDiet;
          console.log(
            'Diätfilter (' +
              dietType +
              '): ' +
              filterStats.afterDiet +
              ' Rezepte (+' +
              excludedByDiet +
              ' ausgeschlossen)'
          );
        }

        if (difficulty > 0) {
          const excludedByDifficulty = filterStats.afterDiet - filterStats.afterDifficulty;
          console.log(
            'Schwierigkeitsfilter (' +
              difficulty +
              '/5): ' +
              filterStats.afterDifficulty +
              ' Rezepte (+' +
              excludedByDifficulty +
              ' ausgeschlossen)'
          );
        }

        if (totalTime && totalTime.length === 2 && (totalTime[0] > 0 || totalTime[1] < 240)) {
          const excludedByTime = filterStats.afterDifficulty - filterStats.afterTime;
          console.log(
            'Zeitfilter (' +
              totalTime[0] +
              '-' +
              totalTime[1] +
              'min): ' +
              filterStats.afterTime +
              ' Rezepte (+' +
              excludedByTime +
              ' ausgeschlossen)'
          );
        }

        console.log('\nFINALE ERGEBNISSE: ' + filteredRecipes.length + ' Rezepte');

        if (filteredRecipes.length > 0) {
          const avgScore = filteredRecipes.reduce((sum: number, r: any) => sum + (r.score || 0), 0) / filteredRecipes.length;
          const maxScore = Math.max(...filteredRecipes.map((r: any) => r.score || 0));
          const minScore = Math.min(...filteredRecipes.map((r: any) => r.score || 0));
          console.log('FINALE SCORE STATISTIK:');
          console.log('   Durchschnitt: ' + avgScore.toFixed(4));
          console.log('   Bester: ' + maxScore.toFixed(4));
          console.log('   Schlechtester: ' + minScore.toFixed(4));

          const avgTextFinal = filteredRecipes.reduce((sum: number, r: any) => sum + (r.text_score || 0), 0) / filteredRecipes.length;
          const avgIngredientsFinal =
            filteredRecipes.reduce((sum: number, r: any) => sum + (r.ingredients_score || 0), 0) / filteredRecipes.length;
          const avgCombinedFinal =
            filteredRecipes.reduce((sum: number, r: any) => sum + (r.combined_score || 0), 0) / filteredRecipes.length;

          console.log('KOMBINIERTE SCORE STATISTIK:');
          console.log('   Text Score Durchschnitt: ' + avgTextFinal.toFixed(4));
          console.log('   Ingredients Score Durchschnitt: ' + avgIngredientsFinal.toFixed(4));
          console.log('   Combined Score Durchschnitt: ' + avgCombinedFinal.toFixed(4));
        }

        const totalExcluded = filterStats.initialCount - filterStats.finalCount;
        console.log('\nINSGESAMT AUSGESCHLOSSEN: ' + totalExcluded + ' von ' + filterStats.initialCount + ' Rezepten');
        console.log(Array(60).join('='));

        // ========== PYTHON SUCHMETHODE INFO ==========
        console.log('\n' + Array(60).join('='));
        console.log('PYTHON CLEAN_SEARCH INFORMATION');
        console.log(Array(60).join('='));
        console.log('Suchmethode aktiviert: clean_search.py');
        console.log('Algorithmus: Kombinierte Text- und Zutaten-Suche');
        console.log('Gewichtung: 70% Text-Ähnlichkeit + 30% Zutaten-Ähnlichkeit');
        console.log('Ziel: Höchste Relevanz durch semantische Text- und Zutaten-Ähnlichkeit');
        console.log(Array(60).join('=') + '\n');

        // ========== ERGEBNISSE BEGRENZEN ==========
        const finalRecipes = filteredRecipes.slice(0, k);

        const dt = Date.now() - t0;
        console.log('Gesamtdauer: ' + dt + 'ms');
        console.log('Antwort an Frontend: ' + finalRecipes.length + ' Rezepte');
        console.log('--> POST /search 200 ' + Math.floor(dt / 1000) + 's');

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
          },
          searchMethod: 'python_clean_search_combined',
          scoreWeighting: {
            text: 0.7,
            ingredients: 0.3
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

    export default app;
