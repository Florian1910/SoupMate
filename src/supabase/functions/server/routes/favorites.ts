// server/routes/favorites.ts - KORRIGIERT
import { Hono } from "jsr:@hono/hono";
import { cors } from 'hono/cors';
import { supabase } from '../services/database.ts';

const app = new Hono();

app.use('*', cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true,
  maxAge: 600,
}));

// Vereinfachtes Favoriten Laden - KORRIGIERT
app.get('/:user_id', async (c) => {
  try {
    console.log('🎯 GET /favorites called for user:', c.req.param('user_id'));

    // Auth prüfen
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({ error: 'Authorization header required' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.log('❌ Auth error:', authError);
      return c.json({ error: 'Invalid token' }, 401);
    }

    const user_id = c.req.param('user_id');

    // Nur eigene Favoriten laden
    if (user.id !== user_id) {
      return c.json({ error: 'Not authorized' }, 403);
    }

    console.log('🔍 Loading favorites for user:', user_id);

    // 🔥 VERSUCHE VERSCHIEDENE TABELLENNAMEN
    let tableName = 'user_favorites';
    let data, error;

    // Erster Versuch: user_favorites
    ({ data, error } = await supabase
      .from(tableName)
      .select('recipe_id, created_at')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false }));

    // Falls Tabelle nicht existiert, versuche andere Namen
    if (error && error.message.includes('does not exist')) {
      console.log('⚠️ Table user_favorites not found, trying alternatives...');

      tableName = 'favorites';
      ({ data, error } = await supabase
        .from(tableName)
        .select('recipe_id, created_at')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false }));
    }

    if (error) {
      console.error('❌ Database error:', error);
      return c.json({
        error: 'Database error: ' + error.message,
        details: error
      }, 500);
    }

    console.log('✅ Found favorites:', data);

    // Vereinfachte Transformation
    const favorites = (data || []).map(fav => ({
      id: fav.recipe_id,
      name: `Rezept ${fav.recipe_id?.substring(0, 8) || 'unknown'}...`,
      difficulty: 3,
      diet: "alle" as const
    }));

    return c.json({
      success: true,
      favorites,
      count: favorites.length
    });

  } catch (error) {
    console.error('💥 Unexpected error:', error);
    return c.json({
      error: 'Internal server error: ' + error.message
    }, 500);
  }
});

// Vereinfachter Favoriten-Endpoint - KORRIGIERT
app.post('/', async (c) => {
  try {
    console.log('🎯 POST /favorites called');

    // Authorization prüfen
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({ error: 'Authorization header required' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return c.json({ error: 'Invalid token: ' + authError?.message }, 401);
    }

    console.log('✅ User authenticated:', user.id);

    // Body parsen
    let body;
    try {
      body = await c.req.json();
      console.log('📦 Request body:', body);
    } catch (parseError) {
      return c.json({ error: 'Invalid JSON: ' + parseError.message }, 400);
    }

    const { recipe_id } = body;

    if (!recipe_id) {
      return c.json({ error: 'recipe_id is required' }, 400);
    }

    console.log('💾 Adding favorite for user:', user.id, 'recipe:', recipe_id);

    // 🔥 VERSUCHE VERSCHIEDENE TABELLEN
    let tableName = 'user_favorites';
    let data, error;

    // Erster Versuch
    ({ data, error } = await supabase
      .from(tableName)
      .insert([{
        user_id: user.id,
        recipe_id: recipe_id,
        created_at: new Date().toISOString()
      }])
      .select()
      .single());

    // Fallback falls Tabelle nicht existiert
    if (error && error.message.includes('does not exist')) {
      console.log('⚠️ Table user_favorites not found, trying favorites...');

      tableName = 'favorites';
      ({ data, error } = await supabase
        .from(tableName)
        .insert([{
          user_id: user.id,
          recipe_id: recipe_id,
          created_at: new Date().toISOString()
        }])
        .select()
        .single());
    }

    if (error) {
      console.log('❌ Database error:', error);
      return c.json({
        error: 'Database error: ' + error.message,
        details: error
      }, 500);
    }

    console.log('✅ Favorite added successfully:', data);

    return c.json({
      success: true,
      favorite: data,
      message: 'Favorite added successfully'
    });

  } catch (error) {
    console.error('💥 Unexpected error:', error);
    return c.json({
      error: 'Internal server error: ' + error.message
    }, 500);
  }
});

// DELETE Endpoint hinzufügen
app.delete('/', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({ error: 'Authorization header required' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const body = await c.req.json();
    const { recipe_id } = body;

    if (!recipe_id) {
      return c.json({ error: 'recipe_id is required' }, 400);
    }

    // Versuche verschiedene Tabellen
    let tableName = 'user_favorites';
    let { error } = await supabase
      .from(tableName)
      .delete()
      .eq('user_id', user.id)
      .eq('recipe_id', recipe_id);

    if (error && error.message.includes('does not exist')) {
      tableName = 'favorites';
      ({ error } = await supabase
        .from(tableName)
        .delete()
        .eq('user_id', user.id)
        .eq('recipe_id', recipe_id));
    }

    if (error) throw error;

    return c.json({
      success: true,
      message: 'Favorite removed successfully'
    });

  } catch (error) {
    console.error('Error removing favorite:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default app;