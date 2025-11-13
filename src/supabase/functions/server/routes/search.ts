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

// 🔥 KORREKTE ZUTATEN-FUNKTION - EXPLIZIT FÜR DEINE DATENBANK
async function getIngredientsForRecipes(recipeIds: string[]) {
  try {
    console.log('🔍 STEP 1: Searching for recipe IDs in test_recipe_ingredients:', recipeIds);

    if (!recipeIds || recipeIds.length === 0) {
      console.log('⚠️ No recipe IDs provided');
      return {};
    }

    // 🔥 SCHRITT 1: Suche in test_recipe_ingredients nach den recipe_ids
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

    // 🔥 SCHRITT 2: Extrahiere alle ingredient_ids
    const ingredientIds = recipeIngredients.map(item => item.ingredient_id).filter(Boolean);
    const uniqueIngredientIds = [...new Set(ingredientIds)];

    console.log('🔍 STEP 2: Unique ingredient IDs to search in test_ingredients:', uniqueIngredientIds);

    if (uniqueIngredientIds.length === 0) {
      console.log('⚠️ No valid ingredient IDs found');
      return {};
    }

    // 🔥 SCHRITT 3: Suche in test_ingredients nach den ingredient_ids und hole die Namen
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

    // 🔥 SCHRITT 4: Erstelle Mapping von ingredient_id zu name
    const ingredientNameMap = {};
    ingredients.forEach(ingredient => {
      ingredientNameMap[ingredient.ingredient_id] = ingredient.name;
    });

    console.log('📋 Ingredient ID to Name mapping:', ingredientNameMap);

    // 🔥 SCHRITT 5: Kombiniere die Daten - Gruppiere nach recipe_id
    const ingredientsByRecipe = {};

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

// Routes
app.get('/health', (c) => ok(c, { ok: true, service: 'search', ts: new Date().toISOString() }));

// 🔥 DEBUG ROUTE - Prüfe konkrete Daten
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

// Haupt-Suche Route
app.post('/', async (c) => {
  const t0 = Date.now();

  try {
    console.log('[SEARCH] Starting search request...');

    // Authorization prüfen
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({
        error: 'Authorization header required',
        code: 'MISSING_AUTH_HEADER'
      }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return c.json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      }, 401);
    }

    console.log('[SEARCH] User authenticated:', user.id);

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

    const { query, type = 'text', k = 5, ingredients } = body ?? {};

    if (type === 'text' && !query) {
      return c.json({
        error: 'Query parameter is required for text search',
        code: 'MISSING_QUERY'
      }, 400);
    }

    console.log('[SEARCH] Search parameters:', { type, query, ingredients, k });

    // Datenbankabfrage für Rezepte
    let dbQuery;
    if (type === 'text') {
      console.log('[SEARCH] Performing text search for:', query);
      dbQuery = supabase
        .from('test_recipes')
        .select('*')
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(k);
    } else {
      console.log('[SEARCH] Performing ingredients search for:', ingredients);
      dbQuery = supabase
        .from('test_recipes')
        .select('*')
        .limit(k);
    }

    const { data: recipes, error: dbError } = await dbQuery;

    if (dbError) {
      console.error('[SEARCH] Database error:', dbError);
      return c.json({
        error: 'Database query failed',
        code: 'DATABASE_ERROR',
        message: dbError.message
      }, 500);
    }

    console.log('[SEARCH] Found recipes:', recipes?.length);

    // Zutaten aus Datenbank holen
    if (recipes && recipes.length > 0) {
      const recipeIds = recipes.map(r => r.recipe_id);
      console.log('[SEARCH] Recipe IDs to search ingredients for:', recipeIds);

      const ingredientsByRecipe = await getIngredientsForRecipes(recipeIds);

      // Füge Zutaten zu den Rezepten hinzu
      const recipesWithIngredients = recipes.map(recipe => ({
        ...recipe,
        ingredients: ingredientsByRecipe[recipe.recipe_id] || []
      }));

      const dt = Date.now() - t0;
      console.log('[SEARCH] Search completed successfully', {
        count: recipesWithIngredients?.length ?? 0,
        ms: dt,
        type,
        user: user.id
      });

      return c.json({
        success: true,
        type,
        k,
        query: query || ingredients,
        recipes: recipesWithIngredients ?? [],
        count: recipesWithIngredients?.length ?? 0,
        responseTime: dt
      });
    } else {
      const dt = Date.now() - t0;
      console.log('[SEARCH] No recipes found');
      return c.json({
        success: true,
        type,
        k,
        query: query || ingredients,
        recipes: [],
        count: 0,
        responseTime: dt
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

// Test-Routen
app.get('/test-simple', async (c) => {
  try {
    console.log('[TEST] Testing simple database connection...');
    const { data, error } = await supabase
      .from('test_recipes')
      .select('recipe_id, name')
      .limit(2);

    if (error) throw error;

    return c.json({
      success: true,
      data,
      count: data?.length,
      message: 'Simple database test successful'
    });
  } catch (err) {
    return c.json({
      success: false,
      error: err.message
    }, 500);
  }
});

export default app;