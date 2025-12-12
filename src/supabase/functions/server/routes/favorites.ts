import { Hono } from "hono";
import { supabase } from "../services/database.ts";

const app = new Hono();

function getBearerToken(auth?: string) {
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/);
  return m?.[1] ?? null;
}

async function getUserId(c: any) {
  const token = getBearerToken(c.req.header("Authorization"));
  if (!token) {
    console.log("No Authorization header / Bearer token");
    return null;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error) {
    console.error("auth.getUser error:", error);
    return null;
  }

  return data?.user?.id ?? null;
}

async function readJson(c: any) {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

/**
 * GET /
 * Returns: { favorites: Recipe[] }
 * 2-step (NO FK relationship needed)
 */
app.get("/", async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  // 1) ids holen
  const { data: favRows, error: favErr } = await supabase
    .from("user_favorites")
    .select("recipe_id")
    .eq("user_id", userId);

  if (favErr) {
    console.error("user_favorites select error:", favErr);
    return c.json({ error: favErr.message }, 500);
  }

  const ids: string[] = (favRows ?? []).map((r: any) => r.recipe_id).filter(Boolean);
  if (ids.length === 0) return c.json({ favorites: [] });

  // 2) Rezepte holen (PK in deiner Tabelle ist recipe_id)
  const { data: recipes, error: recErr } = await supabase
    .from("test_recipes")
    .select("*")
    .in("recipe_id", ids);

  if (recErr) {
    console.error("test_recipes select error:", recErr);
    return c.json({ error: recErr.message }, 500);
  }

  // gleiche Reihenfolge wie ids (wichtig: key = recipe_id)
  const byId = new Map<string, any>((recipes ?? []).map((r: any) => [r.recipe_id, r]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean);

  return c.json({ favorites: ordered });
});

/**
 * POST /
 * Body: { recipe_id: string }
 */
app.post("/", async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const body = await readJson(c);
  const recipe_id = body?.recipe_id;

  if (!recipe_id) return c.json({ error: "Missing recipe_id" }, 400);

  const { error } = await supabase
    .from("user_favorites")
    .upsert({ user_id: userId, recipe_id }, { onConflict: "user_id,recipe_id" });

  if (error) {
    console.error("user_favorites upsert error:", error);
    return c.json({ error: error.message }, 500);
  }

  return c.json({ success: true });
});

/**
 * DELETE /
 * Accepts:
 *  - JSON body: { recipe_id }
 *  - OR query param: ?recipe_id=...
 */
app.delete("/", async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const body = await readJson(c);
  const recipe_id = body?.recipe_id ?? c.req.query("recipe_id");

  if (!recipe_id) return c.json({ error: "Missing recipe_id" }, 400);

  const { error } = await supabase
    .from("user_favorites")
    .delete()
    .eq("user_id", userId)
    .eq("recipe_id", recipe_id);

  if (error) {
    console.error("user_favorites delete error:", error);
    return c.json({ error: error.message }, 500);
  }

  return c.json({ success: true });
});

export default app;
