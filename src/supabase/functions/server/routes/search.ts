// server/routes/search.ts - VOLLSTÄNDIG KORRIGIERT
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

// Allergie-Schlüsselwörter Mapping (ENGLISH - significantly expanded)
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

// Funktion zur Zutaten-Filterung mit Bindewörter-Ersetzung
function filterByIngredients(recipes: any[], ingredientsFilter: string): any[] {
  if (!ingredientsFilter || ingredientsFilter.trim() === '') {
    console.log('[INGREDIENTS] No ingredients filter');
    return recipes;
  }

  // BINDEWÖRTER DURCH KOMMAS ERSETZEN
  const normalizedInput = ingredientsFilter
    .toLowerCase()
    // Ersetze verschiedene Bindewörter durch Kommas
    .replace(/\b(and|und|&|with|mit|plus|also|as well as|lastly|last|\+)\b/gi, ',')
    // Entferne überflüssige Leerzeichen um Kommas
    .replace(/\s*,\s*/g, ',')
    // Entferne überflüssige Kommas
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
    // Sicherstellen, dass ingredients definiert ist
    const ingredientsArray = recipe.ingredients || [];

    // Sammle alle Zutaten des Rezepts in einem String (lowercase für case-insensitive Suche)
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

    // Prüfe ob alle Suchbegriffe in den Zutaten vorkommen (AND-Suche)
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

// Verbesserte Funktion zur Allergie-Filterung
function filterByAllergies(recipes: any[], allergies: string[]): any[] {
  if (!allergies || allergies.length === 0) {
    console.log('[ALLERGY] No allergies to filter');
    return recipes;
  }

  console.log(`[ALLERGY] Filtering ${recipes.length} recipes for allergies: ${allergies.join(', ')}`);

  const filtered = recipes.filter(recipe => {
    // Sicherstellen, dass ingredients definiert ist
    const ingredientsArray = recipe.ingredients || [];

    // Sammle alle Zutaten des Rezepts in einem String (lowercase für case-insensitive Suche)
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

    // Überprüft auf jede Allergie ob positiv oder negativ ist für dieses Gericht
    const hasAllergen = allergies.some(allergy => {
      const keywords = allergyKeywords[allergy];
      if (!keywords) {
        console.log(`[ALLERGY] Warning: No keywords defined for allergy: ${allergy}`);
        return false;
      }

      // Prüfe ob eines der Schlüsselwörter in den Zutaten vorkommt
      const matchingKeyword = keywords.find(keyword => {
        // Erstelle ein Regex Pattern für bessere Treffer
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

function normalizeError(err: any) {//erstellt Fehlermeldung
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

    // SCHRITT 1: Holt alle Zutaten, die die jeweilige RecipeID aufweisen können
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

    // SCHRITT 2: Extrahiere alle ingredient_ids und entferne doppelte Einträge
    const ingredientIds = recipeIngredients.map(item => item.ingredient_id).filter(Boolean);
    const uniqueIngredientIds = [...new Set(ingredientIds)];

    console.log('🔍 STEP 2: Unique ingredient IDs to search in test_ingredients:', uniqueIngredientIds);

    if (uniqueIngredientIds.length === 0) {
      console.log('⚠️ No valid ingredient IDs found');
      return {};
    }

    // SCHRITT 3: Suche in test_ingredients nach den ingredient_ids und hole die Namen
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

    // SCHRITT 4: Erstelle Mapping von ingredient_id zu name
    const ingredientNameMap: Record<string, string> = {};
    ingredients.forEach(ingredient => {
      ingredientNameMap[ingredient.ingredient_id] = ingredient.name;
    });

    console.log('📋 Ingredient ID to Name mapping:', ingredientNameMap);

    // SCHRITT 5: Kombiniere die Daten - Gruppiere nach recipe_id für vollständige Zutatenliste
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

app.post('/debug-search', async (c) => {
  try {
    const body = await c.req.json();
    const { query } = body;

    console.log('[DEBUG] Raw database query for:', query);

    // 1. Einfache Abfrage ohne Filter
    const { data: rawRecipes, error } = await supabase
      .from('test_recipes')
      .select('recipe_id, name')
      .ilike('name', `%${query}%`);

    if (error) throw error;

    console.log('[DEBUG] Raw results:', {
      count: rawRecipes?.length,
      recipes: rawRecipes?.map(r => ({ id: r.recipe_id, name: r.name }))
    });

    // 2. Prüfe auf Duplikate in den Rohdaten
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

// Routes
app.get('/health', (c) => ok(c, { ok: true, service: 'search', ts: new Date().toISOString() }));

// DEBUG ROUTE - Prüfe konkrete Daten
app.get('/debug-db', async (c) => {
  try {
    console.log('🔍 DEBUG: Checking actual data in tables...');

    // 1. Hole ein paar Rezepte
    const { data: recipes, error: recipesError } = await supabase
      .from('test_recipes')
      .select('recipe_id, name')
      .limit(3);

    console.log('📊 Sample recipes:', recipes);

    if (recipesError) {
      console.error('❌ Error fetching recipes:', recipesError);
    }

    // 2. Prüfe test_recipe_ingredients für diese Rezepte
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

    // 3. Prüfe test_ingredients
    const { data: allIngredients, error: ingredientsError } = await supabase
      .from('test_ingredients')
      .select('ingredient_id, name')
      .limit(10);

    console.log('📊 Sample ingredients:', allIngredients);

    if (ingredientsError) {
      console.error('❌ Error fetching ingredients:', ingredientsError);
    }

    // 4. Teste die komplette Zutaten-Abfrage
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

// Haupt-Suche Route - MIT ZUTATEN-FILTER
app.post('/', async (c) => {
  const t0 = Date.now();

  try {
    console.log('[SEARCH] Starting search request...');

    // Request Body parsen
    let body;
    try {
      body = await c.req.json();
      console.log('[SEARCH] Request body:', body);
    } catch (parseError) {
      return c.json({
        error: 'Invalid JSON in request body',
        code: 'INVALID_JSON'
      }, 400);
    }

    const { query, type = 'text', k = 5, filters = {} } = body ?? {};

    const {
      dietType = 'alle',
      difficulty = 0,
      workTime = [0, 120],
      totalTime = [0, 240],
      allergies = [],
      ingredients: ingredientsFilter = ''  // <- Zutaten-Filter
    } = filters;

    console.log('[SEARCH] Extracted filters:', {
      dietType,
      difficulty,
      workTime,
      totalTime,
      allergies,
      ingredientsFilter
    });

    // DATENBANKABFRAGE MIT FILTERN AUFBAUEN
    let dbQuery = supabase
      .from('test_recipes')
      .select('*');

    // Ernährungstyp Filter
    if (dietType !== 'alle') {
      if (dietType === 'vegan') {
        dbQuery = dbQuery.eq('vegan', true);
        console.log('[SEARCH] Applied vegan filter');
      } else if (dietType === 'vegetarisch') {
        dbQuery = dbQuery.eq('vegetarian', true);
        console.log('[SEARCH] Applied vegetarian filter');
      }
    }

    // Schwierigkeitsgrad Filter
    if (difficulty > 0) {
      dbQuery = dbQuery.eq('difficulty', difficulty);
      console.log('[SEARCH] Applied difficulty filter:', difficulty);
    }

    // Arbeitszeit Filter
    if (workTime && workTime.length === 2) {
      if (workTime[0] > 0 || workTime[1] < 120) {
        dbQuery = dbQuery.gte('work_time', workTime[0]).lte('work_time', workTime[1]);
        console.log('[SEARCH] Applied work time filter:', workTime);
      }
    }

    // Gesamtzeit Filter
    if (totalTime && totalTime.length === 2) {
      if (totalTime[0] > 0 || totalTime[1] < 240) {
        dbQuery = dbQuery.gte('total_time', totalTime[0]).lte('total_time', totalTime[1]);
        console.log('[SEARCH] Applied total time filter:', totalTime);
      }
    }

    // Text-Suche (Hauptsuchbegriff)
    if (type === 'text' && query) {
      dbQuery = dbQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
    }

    // Limit setzen
    dbQuery = dbQuery.limit(k);

    console.log('[SEARCH] Executing database query with filters');
    const { data: recipes, error: dbError } = await dbQuery;

    if (dbError) {
      console.error('[SEARCH] Database error:', dbError);
      return c.json({
        error: 'Database query failed',
        code: 'DATABASE_ERROR',
        message: dbError.message
      }, 500);
    }

    console.log('[SEARCH] Found recipes after filtering:', recipes?.length);

    // EINFACHER NAMENS-BASIERTER DUPLIKAT-FILTER
    let filteredRecipes = recipes || [];

    const seenNames = new Set();
    const uniqueRecipes = filteredRecipes.filter(recipe => {
      if (seenNames.has(recipe.name)) {
        console.log(`❌ DUPLICATE REMOVED: ${recipe.recipe_id} - ${recipe.name}`);
        return false;
      }
      seenNames.add(recipe.name);
      return true;
    });

    console.log('[SEARCH] After removing name duplicates:', {
      before: filteredRecipes.length,
      after: uniqueRecipes.length,
      removed: filteredRecipes.length - uniqueRecipes.length
    });

    // SERVER-SEITIGE ERFOLGSMELDUNG
    console.log(`🎯 ${uniqueRecipes.length} eindeutige Rezepte für "${query}" gefunden`);

    // Dann mit uniqueRecipes weiterarbeiten...
    filteredRecipes = uniqueRecipes;

    // Zutaten aus Datenbank holen - MUSS VOR DER ALLERGIE-FILTERUNG PASSIEREN!
    if (filteredRecipes.length > 0) {
      const recipeIds = filteredRecipes.map(r => r.recipe_id);
      console.log('[SEARCH] Recipe IDs to search ingredients for:', recipeIds);

      const ingredientsByRecipe = await getIngredientsForRecipes(recipeIds);

      // Füge Zutaten zu den Rezepten hinzu
      const recipesWithIngredients = filteredRecipes.map(recipe => ({
        ...recipe,
        ingredients: ingredientsByRecipe[recipe.recipe_id] || []
      }));

      // Jetzt haben wir Rezepte mit Zutaten, können Filter anwenden
      let finalRecipes = recipesWithIngredients;

      // ZUTATEN FILTER (serverseitig anwenden) - NACH DEM ZUTATEN-LADEN
      if (ingredientsFilter && ingredientsFilter.trim() !== '' && finalRecipes.length > 0) {
        const beforeCount = finalRecipes.length;
        finalRecipes = filterByIngredients(finalRecipes, ingredientsFilter);
        console.log(`[SEARCH] After ingredients filter: ${beforeCount} -> ${finalRecipes.length}`);
      }

      // ALLERGIEN FILTER (serverseitig anwenden) - NACH DEM ZUTATEN-LADEN
      if (allergies && allergies.length > 0 && finalRecipes.length > 0) {
        const beforeCount = finalRecipes.length;
        finalRecipes = filterByAllergies(finalRecipes, allergies);
        console.log(`[SEARCH] After allergy filter: ${beforeCount} -> ${finalRecipes.length}`);
      }

      const dt = Date.now() - t0;
      console.log('[SEARCH] Search completed successfully', {
        count: finalRecipes.length,
        ms: dt,
        type
      });

      return c.json({
        success: true,
        type,
        k,
        query: query,
        recipes: finalRecipes,
        count: finalRecipes.length,
        responseTime: dt,
        appliedFilters: filters
      });
    } else {
      const dt = Date.now() - t0;
      console.log('[SEARCH] No recipes found after filtering');
      return c.json({
        success: true,
        type,
        k,
        query: query,
        recipes: [],
        count: 0,
        responseTime: dt,
        appliedFilters: filters
      });
    }

  } catch (err) {
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

    // Hole ein paar Rezepte mit allen Spalten
    const { data: recipes, error } = await supabase
      .from('test_recipes')
      .select('*')
      .limit(5);

    if (error) {
      console.error('❌ Error fetching recipes:', error);
      return c.json({ error: error.message }, 500);
    }

    console.log('📊 Full recipe structure:', recipes);

    // Prüfe speziell die Diät-Flags
    const dietInfo = recipes?.map(recipe => ({
      recipe_id: recipe.recipe_id,
      name: recipe.name,
      // Diese Spalten sollten existieren für die Filter
      vegan: recipe.vegan,
      vegetarian: recipe.vegetarian,
      // Falls unter anderen Namen
      is_vegan: recipe.is_vegan,
      is_vegetarian: recipe.is_vegetarian,
      diet_type: recipe.diet_type,
      // Alle Spalten anzeigen
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