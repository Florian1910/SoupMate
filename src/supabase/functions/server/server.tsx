import { config } from "dotenv";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

config();

const app = new Hono();
app.use("*", logger());
app.use("*", cors());

// einfache Health-Route
app.get("/", (c) => c.json({ ok: true, msg: "SoupMate backend running 🥣" }));

// ----------------------------------------------------
// 1) Query → Embedding (hier Dummy oder eigener Vektor-Generator)
// ----------------------------------------------------
async function embedQuery(text: string): Promise<number[]> {
    // Falls du FAISS-Embeddings in der DB hast und nur suchst:
    // hol dir den Vektor hier, z.B. aus Supabase oder einem Modell in Python.
    // Aktuell einfach Dummy für Test:
    const dummy = Array(3).fill(0.5);
    return dummy;
}

// ----------------------------------------------------
// 2) /search-Route (ruft Python mit FAISS auf)
// ----------------------------------------------------
app.post("/search", async (c) => {
    try {
        const body = await c.req.json().catch(() => ({}));
        const query = body.query as string;
        if (!query) return c.json({ error: "query missing" }, 400);

        const embedding = await embedQuery(query);

        // Python-Pfad anpassen, falls nötig
        const pythonCmd = "C:\\Python314\\python.exe";

        const cmd = new Deno.Command(pythonCmd, {
            args: ["faiss_search.py"],
            stdin: "piped",
            stdout: "piped",
            stderr: "piped",
        });

        const child = cmd.spawn();

        const writer = child.stdin.getWriter();
        await writer.write(new TextEncoder().encode(JSON.stringify({ embedding })));
        await writer.close();

        const { code, stdout, stderr } = await child.output();

        if (code !== 0) {
            const err = new TextDecoder().decode(stderr);
            console.error("Python error:", err);
            return c.json({ error: "python failed", detail: err }, 500);
        }

        const outText = new TextDecoder().decode(stdout || new Uint8Array());
        const result = outText ? JSON.parse(outText) : {};
        return c.json(result);
    } catch (e) {
        console.error("Search route error:", e);
        return c.json({ error: "internal error", detail: String(e) }, 500);
    }
});

Deno.serve(app.fetch);
