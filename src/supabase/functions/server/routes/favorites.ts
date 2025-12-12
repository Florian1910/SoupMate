import { Hono } from "hono";
import { supabase } from "../services/database.ts";

const app = new Hono();

function getBearerToken(auth?: string) {
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/);
  return match?.[1] ?? null;
}

app.post("/", async (c) => {
  // 1️⃣ Token aus Header holen
  const token = getBearerToken(c.req.header("Authorization"));
  if (!token) {
    return c.json({ error: "Missing Authorization token" }, 401);
  }

  // 2️⃣ User aus Token bestimmen
  const { data, error: authError } = await supabase.auth.getUser(token);
  if (authError || !data?.user) {
    return c.json({ error: "Invalid token" }, 401);
  }

  const userId = data.user.id;

  // 3️⃣ recipeId aus Body
  const { recipeId } = await c.req.json<{ recipeId: string }>();
  if (!recipeId) {
    return c.json({ error: "Missing recipeId" }, 400);
  }

  // 4️⃣ Insert
  const { error } = await supabase
    .from("user_favorites")
    .insert([{ user_id: userId, recipe_id: recipeId }]);

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ success: true });
});

export default app;
