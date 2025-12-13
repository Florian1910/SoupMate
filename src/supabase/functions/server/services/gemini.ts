// Deno/Supabase Edge Function style Fetch-Handler
// POST /gemini  { "prompt": "..." }

import { GoogleGenerativeAI } from "@google/generative-ai";

function getModel() {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
        throw new Response(JSON.stringify({ error: "GEMINI_API_KEY missing" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}

function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    };
}

export default async function handler(req: Request): Promise<Response> {
    // CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders() });
    }

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Use POST" }), {
            status: 405,
            headers: { "Content-Type": "application/json", ...corsHeaders() },
        });
    }

    try {
        const { prompt } = await req.json().catch(() => ({}));
        if (!prompt || typeof prompt !== "string") {
            return new Response(JSON.stringify({ error: "Body must include 'prompt' (string)" }), {
                status: 400,
                headers: { "Content-Type": "application/json", ...corsHeaders() },
            });
        }

        const model = getModel();
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        return new Response(JSON.stringify({ ok: true, prompt, text }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders() },
        });
    } catch (err: any) {
        console.error("Gemini route error:", err);
        const message = err?.message ?? "Internal error";
        return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders() },
        });
    }
}
