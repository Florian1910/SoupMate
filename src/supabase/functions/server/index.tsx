// ========================================================================
// 📦 IMPORTS
// ========================================================================
import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from 'npm:@supabase/supabase-js@2';

// ========================================================================
// 🟡 DATENBANK-IMPORT (Supabase KV-Store + PostgreSQL)
// ========================================================================
import * as kv from "./kv_store.tsx";

// Initialize Supabase Client for PostgreSQL access
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-b187574e/health", (c) => {
  return c.json({ status: "ok" });
});

// ========================================================================
// 🟡 DATENBANK: FAVORITEN ABRUFEN
// ========================================================================
// HIER werden gespeicherte Favoriten aus der Datenbank geladen
// ========================================================================
app.get("/make-server-b187574e/favorites/:userName", async (c) => {
  try {
    const userName = c.req.param("userName");
    const key = `favorites_${userName}`;
    
    // 🟡 Datenbank-Zugriff (KV-Store)
    const favorites = await kv.get(key);
    
    // OPTIONAL: PostgreSQL verwenden
    /*
    const { data: favorites, error } = await supabase
      .from('favorites')
      .select('*')
      .eq('user_name', userName);
    */
    
    return c.json({ favorites: favorites || [] });
  } catch (error) {
    console.log(`Error fetching favorites: ${error}`);
    return c.json({ error: "Failed to fetch favorites", details: String(error) }, 500);
  }
});

// Add a favorite
app.post("/make-server-b187574e/favorites", async (c) => {
  try {
    const { userName, recipe } = await c.req.json();
    
    if (!userName || !recipe) {
      return c.json({ error: "userName and recipe are required" }, 400);
    }
    
    const key = `favorites_${userName}`;
    const favorites = (await kv.get(key)) || [];
    
    // Check if recipe already exists
    const exists = favorites.some((fav: any) => fav.id === recipe.id);
    if (exists) {
      return c.json({ error: "Recipe already in favorites" }, 400);
    }
    
    favorites.push(recipe);
    await kv.set(key, favorites);
    
    return c.json({ success: true, favorites });
  } catch (error) {
    console.log(`Error adding favorite: ${error}`);
    return c.json({ error: "Failed to add favorite", details: String(error) }, 500);
  }
});

// Remove a favorite
app.delete("/make-server-b187574e/favorites", async (c) => {
  try {
    const { userName, recipeId } = await c.req.json();
    
    if (!userName || !recipeId) {
      return c.json({ error: "userName and recipeId are required" }, 400);
    }
    
    const key = `favorites_${userName}`;
    const favorites = (await kv.get(key)) || [];
    
    const updatedFavorites = favorites.filter((fav: any) => fav.id !== recipeId);
    await kv.set(key, updatedFavorites);
    
    return c.json({ success: true, favorites: updatedFavorites });
  } catch (error) {
    console.log(`Error removing favorite: ${error}`);
    return c.json({ error: "Failed to remove favorite", details: String(error) }, 500);
  }
});

// ========================================================================
// 🟢 SEMANTIC RECIPE SEARCH WITH SUPABASE DATABASE
// ========================================================================
// This endpoint performs semantic search using the test_recipes, 
// test_ingredients, and test_recipe_ingredients tables
// ========================================================================

/**
 * Helper function to generate embeddings for search queries
 * For demo purposes with 3-dimensional vectors, we use simple hashing
 * In production, replace with actual embedding model (OpenAI, Voyage AI, etc.)
 */
function generateMockEmbedding(text: string): number[] {
  // Simple hash-based embedding generation for demo (3 dimensions)
  const normalized = text.toLowerCase().trim();
  const hash1 = Array.from(normalized).reduce((acc, char) => acc + char.charCodeAt(0), 0) % 100 / 100;
  const hash2 = Array.from(normalized).reduce((acc, char) => acc * 31 + char.charCodeAt(0), 0) % 100 / 100;
  const hash3 = Array.from(normalized).reduce((acc, char, i) => acc + char.charCodeAt(0) * (i + 1), 0) % 100 / 100;
  
  return [hash1, hash2, hash3];
}

/**
 * Calculate work time from total time and instructions
 * This is an estimation - adjust as needed
 */
function estimateWorkTime(totalTime: number, instructionCount: number): number {
  // Estimate work time as 60% of total time, minimum 10 minutes
  return Math.max(10, Math.round(totalTime * 0.6));
}

app.post("/make-server-b187574e/search", async (c) => {
  try {
    const { query, filters } = await c.req.json();
    
    if (!query) {
      return c.json({ error: "Search query is required" }, 400);
    }

    console.log(`🔍 Searching for: "${query}" with filters:`, filters);
    
    // ========================================================================
    // STEP 1: Generate embedding for search query
    // ========================================================================
    // For demo with 3D vectors, we use mock embeddings
    // TODO: Replace with actual embedding API in production
    const queryEmbedding = generateMockEmbedding(query);
    console.log(`📊 Generated query embedding:`, queryEmbedding);
    
    // ========================================================================
    // STEP 2: Build SQL query with filters
    // ========================================================================
    let sqlQuery = supabase
      .from('test_recipes')
      .select(`
        recipe_id,
        name,
        description,
        instructions,
        vegan,
        vegetarian,
        difficulty,
        diet,
        image_url,
        prep_time,
        cook_time,
        total_time,
        servings,
        text_embedding,
        ingredients_embedding,
        created_at
      `);
    
    // Apply diet type filter
    if (filters?.dietType === "vegan") {
      sqlQuery = sqlQuery.eq('vegan', true);
    } else if (filters?.dietType === "vegetarisch") {
      sqlQuery = sqlQuery.eq('vegetarian', true);
    }
    
    // Apply difficulty filter (only if set > 0)
    // Difficulty is now stored as int (1-5) in the database
    if (filters?.difficulty && filters.difficulty > 0) {
      sqlQuery = sqlQuery.lte('difficulty', filters.difficulty);
    }

    // Execute the query
    const { data: recipes, error: dbError } = await sqlQuery;
    
    if (dbError) {
      console.log(`❌ Database error: ${dbError.message}`);
      return c.json({ error: "Database query failed", details: dbError.message }, 500);
    }
    
    if (!recipes || recipes.length === 0) {
      console.log(`⚠️ No recipes found in database`);
      return c.json({ 
        recipes: [],
        message: "Keine Rezepte in der Datenbank gefunden. Bitte füge Rezepte hinzu."
      });
    }

    console.log(`✅ Found ${recipes.length} recipes in database`);
    
    // ========================================================================
    // STEP 3: Calculate semantic similarity and rank results
    // ========================================================================
    // Use combined search: 60% ingredients similarity + 40% text similarity
    const recipesWithScores = recipes.map(recipe => {
      const textEmb = recipe.text_embedding as number[] || [0, 0, 0];
      const ingEmb = recipe.ingredients_embedding as number[] || [0, 0, 0];
      
      // Calculate cosine distance (lower is better)
      const textDistance = Math.sqrt(
        queryEmbedding.reduce((sum, val, i) => sum + Math.pow(val - textEmb[i], 2), 0)
      );
      const ingDistance = Math.sqrt(
        queryEmbedding.reduce((sum, val, i) => sum + Math.pow(val - ingEmb[i], 2), 0)
      );
      
      // Combined score (weighted)
      const score = 0.6 * ingDistance + 0.4 * textDistance;
      
      return {
        ...recipe,
        similarity_score: score
      };
    });
    
    // Sort by similarity (lower score = better match)
    recipesWithScores.sort((a, b) => a.similarity_score - b.similarity_score);
    
    // ========================================================================
    // STEP 4: Fetch ingredients for top recipes
    // ========================================================================
    const topRecipes = recipesWithScores.slice(0, 5);
    
    const recipesWithDetails = await Promise.all(
      topRecipes.map(async (recipe) => {
        // Fetch ingredients for this recipe
        const { data: recipeIngredients, error: ingError } = await supabase
          .from('test_recipe_ingredients')
          .select(`
            quantity,
            test_ingredients!inner (
              name
            )
          `)
          .eq('recipe_id', recipe.recipe_id);
        
        if (ingError) {
          console.log(`⚠️ Error fetching ingredients for recipe ${recipe.recipe_id}: ${ingError.message}`);
        }
        
        // Format ingredients with quantities
        const ingredients = recipeIngredients?.map(ri => 
          `${ri.quantity} ${ri.test_ingredients.name}`
        ) || [];
        
        // Parse instructions (stored as text, split by newlines or periods)
        const instructions = recipe.instructions
          ? recipe.instructions.split(/\n|(?<=\.)\s+/).filter((s: string) => s.trim().length > 0)
          : [];
        
        // Use database fields for times and servings, with fallbacks
        const totalTime = recipe.total_time || (recipe.prep_time || 15) + (recipe.cook_time || 25);
        const workTime = recipe.prep_time || estimateWorkTime(totalTime, instructions.length);
        const servings = recipe.servings || 4;
        
        // Difficulty is now stored as int (1-5) in database
        const difficulty = recipe.difficulty || 3;
        
        return {
          id: recipe.recipe_id,
          name: recipe.name,
          description: recipe.description || "Keine Beschreibung verfügbar",
          fullDescription: recipe.description || "Keine Beschreibung verfügbar",
          difficulty: difficulty,
          workTime: workTime,
          totalTime: totalTime,
          servings: servings,
          ingredients: ingredients,
          instructions: instructions,
          isVegan: recipe.vegan || false,
          isVegetarian: recipe.vegetarian || false,
          allergens: [], // TODO: Add allergens to your schema
          imageUrl: recipe.image_url
        };
      })
    );
    
    // ========================================================================
    // STEP 5: Apply additional filters (time, allergies, ingredients)
    // ========================================================================
    let filteredRecipes = recipesWithDetails;
    
    // Work time filter
    if (filters?.workTime && Array.isArray(filters.workTime)) {
      if (filters.workTime[0] !== 0 || filters.workTime[1] !== 120) {
        filteredRecipes = filteredRecipes.filter(r => 
          r.workTime >= filters.workTime[0] && r.workTime <= filters.workTime[1]
        );
      }
    }
    
    // Total time filter
    if (filters?.totalTime && Array.isArray(filters.totalTime)) {
      if (filters.totalTime[0] !== 0 || filters.totalTime[1] !== 240) {
        filteredRecipes = filteredRecipes.filter(r => 
          r.totalTime >= filters.totalTime[0] && r.totalTime <= filters.totalTime[1]
        );
      }
    }
    
    // Allergies filter
    if (filters?.allergies && Array.isArray(filters.allergies) && filters.allergies.length > 0) {
      filteredRecipes = filteredRecipes.filter(r => 
        !r.allergens.some(allergen => filters.allergies.includes(allergen))
      );
    }
    
    // Available ingredients filter
    if (filters?.ingredients && filters.ingredients.trim()) {
      const userIngredients = filters.ingredients.toLowerCase().split(',').map((i: string) => i.trim());
      filteredRecipes = filteredRecipes.filter(r =>
        r.ingredients.some(ingredient =>
          userIngredients.some(ui => ingredient.toLowerCase().includes(ui))
        )
      );
    }
    
    console.log(`✅ Returning ${filteredRecipes.length} filtered recipes`);
    
    // ========================================================================
    // STEP 6: Save search history
    // ========================================================================
    const searchKey = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await kv.set(searchKey, {
      query,
      filters,
      resultCount: filteredRecipes.length,
      timestamp: new Date().toISOString()
    });
    
    return c.json({ 
      recipes: filteredRecipes,
      query,
      filters,
      totalResults: filteredRecipes.length
    });
    
  } catch (error) {
    console.log(`❌ Error in search endpoint: ${error}`);
    return c.json({ error: "Search failed", details: String(error) }, 500);
  }
});

// ========================================================================
// 🔐 AUTHENTICATION ROUTES
// ========================================================================

// User Registration (server-side with auto email confirmation)
app.post("/make-server-b187574e/auth/signup", async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    if (password.length < 6) {
      return c.json({ error: "Password must be at least 6 characters" }, 400);
    }

    console.log('🔐 Creating user with auto-confirm:', email);

    // Use admin API to create user with automatic email confirmation
    const { data, error } = await supabase.auth.admin.createUser({
      email: email.trim(),
      password: password,
      email_confirm: true, // ✅ Automatically confirm email
      user_metadata: {}
    });

    if (error) {
      console.error('❌ Signup error:', error.message);
      if (error.message.includes('already registered')) {
        return c.json({ error: "User already registered" }, 400);
      }
      return c.json({ error: error.message }, 500);
    }

    if (!data.user) {
      return c.json({ error: "User creation failed" }, 500);
    }

    console.log('✅ User created successfully:', data.user.id);

    // Sign in the user to get a session
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password
    });

    if (signInError || !signInData.session) {
      console.error('❌ Auto sign-in failed:', signInError?.message);
      // User created but couldn't auto-login - they can login manually
      return c.json({
        success: true,
        user: data.user,
        message: "User created. Please login."
      });
    }

    console.log('✅ User signed in successfully');

    return c.json({
      success: true,
      user: data.user,
      session: signInData.session,
      access_token: signInData.session.access_token
    });

  } catch (error) {
    console.error('❌ Signup error:', error);
    return c.json({ error: "Signup failed", details: String(error) }, 500);
  }
});

// Create/Update user profile
app.post("/make-server-b187574e/auth/profile", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { userId, fullName, username, avatarUrl } = await c.req.json();

    if (userId !== user.id) {
      return c.json({ error: "User ID mismatch" }, 403);
    }

    if (!fullName) {
      return c.json({ error: "Full name is required" }, 400);
    }

    // Insert or update user profile
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: userId,
        full_name: fullName,
        username: username || null,
        avatar_url: avatarUrl || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      console.log(`❌ Profile creation error: ${error.message}`);
      return c.json({ error: error.message }, 500);
    }

    console.log(`✅ Profile created/updated for user: ${userId}`);

    return c.json({
      success: true,
      profile: data
    });
  } catch (error) {
    console.log(`❌ Profile error: ${error}`);
    return c.json({ error: "Profile creation failed", details: String(error) }, 500);
  }
});

// Get user profile
app.get("/make-server-b187574e/auth/profile/:userId", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const userId = c.req.param("userId");

    if (userId !== user.id) {
      return c.json({ error: "Access denied" }, 403);
    }

    // Get user profile
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No profile found
        return c.json({ profile: null });
      }
      console.log(`❌ Profile fetch error: ${error.message}`);
      return c.json({ error: error.message }, 500);
    }

    return c.json({ profile: data });
  } catch (error) {
    console.log(`❌ Profile fetch error: ${error}`);
    return c.json({ error: "Profile fetch failed", details: String(error) }, 500);
  }
});

// Save user preferences
app.post("/make-server-b187574e/auth/preferences", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { userId, isVegan, isVegetarian, allergies, dietType } = await c.req.json();

    if (userId !== user.id) {
      return c.json({ error: "User ID mismatch" }, 403);
    }

    // Insert or update preferences
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        is_vegan: isVegan || false,
        is_vegetarian: isVegetarian || false,
        allergies: allergies || null,
        diet_type: dietType || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      console.log(`❌ Preferences save error: ${error.message}`);
      return c.json({ error: error.message }, 500);
    }

    console.log(`✅ Preferences saved for user: ${userId}`);

    return c.json({
      success: true,
      preferences: data
    });
  } catch (error) {
    console.log(`❌ Preferences save error: ${error}`);
    return c.json({ error: "Preferences save failed", details: String(error) }, 500);
  }
});

// Update favorites to use user_id instead of userName
app.get("/make-server-b187574e/favorites/:userId", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const userId = c.req.param("userId");

    if (userId !== user.id) {
      return c.json({ error: "Access denied" }, 403);
    }

    // Get user favorites from database
    const { data, error } = await supabase
      .from('user_favorites')
      .select(`
        recipe_id,
        created_at,
        test_recipes (
          recipe_id,
          name,
          description,
          difficulty,
          diet,
          image_url,
          prep_time,
          total_time
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.log(`❌ Favorites fetch error: ${error.message}`);
      return c.json({ error: error.message }, 500);
    }

    // Transform data to match Recipe interface
    const favorites = (data || []).map((fav: any) => ({
      id: fav.test_recipes.recipe_id,
      name: fav.test_recipes.name,
      difficulty: fav.test_recipes.difficulty || 0,
      diet: fav.test_recipes.diet || 'alle'
    }));

    return c.json({ favorites });
  } catch (error) {
    console.log(`❌ Favorites fetch error: ${error}`);
    return c.json({ error: "Favorites fetch failed", details: String(error) }, 500);
  }
});

Deno.serve(app.fetch);