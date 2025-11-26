// routes/chat.ts
import { Hono } from "jsr:@hono/hono";
import { cors } from "jsr:@hono/hono/cors";
import { GeminiService } from "../services/gemini.ts";

const app = new Hono();

// CORS – Vite (5173) + optional 3000 erlauben
app.use("*", cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://127.0.0.1:3000"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "apikey"],
    credentials: true,
    maxAge: 86400,
}));

const gemini = new GeminiService();

app.post("/chat", async (c) => {
    try {
        // 1) Content-Type prüfen
        const ct = c.req.header("content-type") || "";
        if (!ct.includes("application/json")) {
            return c.json({ error: "Use Content-Type: application/json", ct }, 415);
        }

        // 2) Rohdaten loggen
        const raw = await c.req.text();
        console.log("RAW BODY:", raw);

        // 3) Sicher parsen
        let data: any = {};
        try {
            data = JSON.parse(raw);
        } catch {
            return c.json({ error: "Invalid JSON", raw }, 400);
        }

        const prompt = (data?.prompt ?? "").toString().trim();
        if (!prompt) {
            return c.json({ error: "Missing 'prompt' in body", raw, parsed: data }, 400);
        }

        const text = await gemini.generateText(prompt);
        return c.json({ text });
    } catch (err) {
        console.error(err);
        return c.json({ error: "Gemini error", details: String(err) }, 500);
    }
});


// optional health
app.get("/chat/health", (c) => c.json({ ok: true }));

export default app;
