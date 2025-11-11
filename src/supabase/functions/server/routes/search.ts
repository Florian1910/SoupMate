// server/routes/search.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { EmbeddingService } from '../services/embedding.ts';
import { supabase } from '../services/database.ts';
import { config } from '../config/environment.ts';

// ───────────────────────────────────────────────────────────
// App
// ───────────────────────────────────────────────────────────
const app = new Hono();

// CORS
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

// ───────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────
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

// ───────────────────────────────────────────────────────────
// Routes
// ───────────────────────────────────────────────────────────

// Healthcheck
app.get('/health', (c) => ok(c, { ok: true, service: 'search', ts: new Date().toISOString() }));

// Debug
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

// 🔥 KORRIGIERT: Semantische Suche - Hauptendpoint
app.post('/', async (c) => {  // 👈 GEÄNDERT von '/search' zu '/'
  const t0 = Date.now();

  try {
    console.log('[SEARCH] Starting search request...');

    // 1. Authorization Header prüfen
    const authHeader = c.req.header('Authorization');
    console.log('[SEARCH] Authorization header:', authHeader ? 'present' : 'missing');

    if (!authHeader) {
      return c.json({
        error: 'Authorization header required',
        code: 'MISSING_AUTH_HEADER'
      }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('[SEARCH] Token length:', token.length);

    // 2. Token verifizieren
    console.log('[SEARCH] Verifying token...');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError) {
      console.error('[SEARCH] Token verification error:', authError);
      return c.json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN',
        details: authError.message
      }, 401);
    }

    if (!user) {
      console.error('[SEARCH] No user found for token');
      return c.json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      }, 401);
    }

    console.log('[SEARCH] User authenticated:', user.id);

    // 3. Request Body parsen
    let body;
    try {
      body = await c.req.json();
      console.log('[SEARCH] Request body:', body);
    } catch (parseError) {
      console.error('[SEARCH] JSON parse error:', parseError);
      return c.json({
        error: 'Invalid JSON in request body',
        code: 'INVALID_JSON'
      }, 400);
    }

    const { query, type = 'text', k = 5, ingredients } = body ?? {};

    // 4. Query validieren
    if (type === 'text' && !query) {
      return c.json({
        error: 'Query parameter is required for text search',
        code: 'MISSING_QUERY'
      }, 400);
    }

    console.log('[SEARCH] Search parameters:', { type, query, ingredients, k });

    // 5. Datenbankabfrage
    let dbQuery;

    if (type === 'text') {
    console.log('[SEARCH] Performing text search for:', query);

    // Erweiterte Suche: Name ODER Beschreibung ODER Zutaten
    dbQuery = supabase
        .from('test_recipes')
        .select('*')
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(k);
    } else {
      console.log('[SEARCH] Performing ingredients search for:', ingredients);
      // Einfache Ingredients-Suche
      dbQuery = supabase
        .from('test_recipes')
        .select('*')
        .limit(k);
    }

    const { data: recipes, error: dbError } = await dbQuery;

    console.log('[SEARCH] Raw recipe data from database:', recipes?.[0]);
    console.log('[SEARCH] Instructions type:', typeof recipes?.[0]?.instructions);
    console.log('[SEARCH] Instructions value:', recipes?.[0]?.instructions);

    if (dbError) {
      console.error('[SEARCH] Database error:', dbError);
      return c.json({
        error: 'Database query failed',
        code: 'DATABASE_ERROR',
        message: dbError.message
      }, 500);
    }

    const dt = Date.now() - t0;
    console.log('[SEARCH] Search completed successfully', {
      count: recipes?.length ?? 0,
      ms: dt,
      type,
      user: user.id
    });

    return c.json({
      success: true,
      type,
      k,
      query: query || ingredients,
      recipes: recipes ?? [],
      count: recipes?.length ?? 0,
      responseTime: dt
    });

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