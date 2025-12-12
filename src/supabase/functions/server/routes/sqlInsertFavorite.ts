// src/supabase/functions/server/scripts/sqlInsertFavorite.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const [userId, recipeId] = Deno.args;

if (!userId || !recipeId) {
  console.error("Usage: deno run -A sqlInsertFavorite.ts <userId> <recipeId>");
  Deno.exit(1);
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); // bewusst server-side

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * HIER ist dein „SQL Statement“ in minimalster Form
 */
const { data, error } = await supabase
  .from("user_favorites")
  .insert([
    {
      user_id: userId,
      recipe_id: recipeId,
    },
  ])
  .select()
  .single();

if (error) {
  console.error("❌ Insert failed:", error.message);
  Deno.exit(1);
}

console.log("✅ Insert worked:", data);
