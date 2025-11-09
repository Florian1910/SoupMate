// services/database.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

// wir akzeptieren mehrere mögliche Keys:
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_SECRET_KEY = Deno.env.get("SUPABASE_SECRET_KEY"); // falls ihr das so nennt

// Priorität: Service Role > Secret > Anon
const SUPABASE_KEY =
SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_SECRET_KEY ?? SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing SUPABASE_URL or any SUPABASE_*_KEY in .env");
}

// benannter Export, so wie in routes/recipes.ts importiert wird
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
