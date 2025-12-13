import { Hono } from 'hono'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const geminiRoutes = new Hono()

geminiRoutes.post('/', async (c) => {
    try {
        const apiKey = Deno.env.get('GEMINI_API_KEY')
        if (!apiKey) {
            return c.json({ ok: false, error: 'GEMINI_API_KEY missing' }, 500)
        }

        const { prompt } = await c.req.json().catch(() => ({}))
        if (!prompt || typeof prompt !== 'string') {
            return c.json({ ok: false, error: "Body must include 'prompt' (string)" }, 400)
        }

        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
        const result = await model.generateContent(prompt)
        const text = result.response.text()

        return c.json({ ok: true, prompt, text })
    } catch (err: any) {
        console.error('Gemini error:', err)
        return c.json({ ok: false, error: err.message ?? 'Internal error' }, 500)
    }
})

/**
 * Neuer Endpoint: /gemini/prepare
 * - übersetzt DE → EN
 * - extrahiert Keywords (EN)
 * - optionale strukturierte Filter für spätere DB-Suche
 */
geminiRoutes.post('/prepare', async (c) => {
    try {
        const apiKey = Deno.env.get('GEMINI_API_KEY')
        if (!apiKey) return c.json({ ok: false, error: 'GEMINI_API_KEY missing' }, 500)

        const { prompt } = await c.req.json().catch(() => ({}))
        if (!prompt || typeof prompt !== 'string') {
            return c.json({ ok: false, error: "Body must include 'prompt' (string)" }, 400)
        }

        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

        const responseSchema = {
            type: "object",
            properties: {
                english_prompt: { type: "string" },
                keywords: { type: "array", items: { type: "string" } },
                detected_intent: { type: "string", enum: ["find_recipe","question","other"] },
                filters: {
                    type: "object",
                    properties: {
                        include_ingredients: { type: "array", items: { type: "string" } },
                        exclude_ingredients: { type: "array", items: { type: "string" } },
                        diet: { type: "array", items: { type: "string" } },
                        cuisine: { type: "array", items: { type: "string" } },
                        time_max: { type: "integer" },
                        calories_max: { type: "integer" }
                    }
                }
            },
            required: ["english_prompt", "keywords"]
        } as const

        const sys =
            "You are a bilingual culinary assistant. Input is German. " +
            "1) Translate the prompt into natural English suitable for searching an English recipe database. Do not invent facts. " +
            "2) Extract 5–15 concise English keywords (lowercase, deduplicated). Focus on ingredients, methods, diets, cuisines. " +
            "3) Parse inclusions and exclusions: phrases like 'ohne/kein(e) X' or 'without/no X' MUST go to filters.exclude_ingredients as normalized English names. " +
            "4) You MAY set filters.time_max=30 when the user says 'schnell/quick' (unless another time is given). " +
            "Return STRICT JSON only."

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            systemInstruction: { role: "system", parts: [{ text: sys }] },
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 512,
                responseMimeType: "application/json",
                responseSchema
            }
        })

        // --- JSON sicher parsen
        let raw
        try {
            raw = JSON.parse(result.response.text())
        } catch {
            return c.json({ ok: false, error: "Gemini returned invalid JSON" }, 502)
        }

        // --- Normalisieren
        const normArr = (a: any[]) =>
            Array.from(new Set((a || []).map((s: string) => String(s).toLowerCase().trim()).filter(Boolean)))

        const english = String(raw.english_prompt || "").trim()
        const keywords = normArr(raw.keywords)
        const f = raw.filters ?? {}
        const include = normArr(f.include_ingredients)
        const exclude = normArr(f.exclude_ingredients)
        const diet = normArr(f.diet)
        const timeMax: number | null = Number.isFinite(f.time_max) ? Number(f.time_max) : null

        // --- Mapping auf dein /search-Filterformat
        // Allergie-Mapping (erweiterbar)
        const allergyMap: Record<string, string> = {
            "celery": "Sellerie",
            "gluten": "Gluten",
            "lactose": "Laktose",
            "milk": "Laktose",
            "nut": "Nüsse",
            "nuts": "Nüsse",
            "peanut": "Nüsse",
            "soy": "Soja",
            "egg": "Eier",
            "eggs": "Eier",
            "fish": "Fisch",
            "shellfish": "Schalentiere",
            "shrimp": "Schalentiere",
            "prawn": "Schalentiere",
            "crab": "Schalentiere",
            "lobster": "Schalentiere"
        }

        const allergies: string[] = []
        for (const ex of exclude) {
            const k = ex.toLowerCase()
            if (allergyMap[k]) allergies.push(allergyMap[k])
            // du kannst zusätzlich exakte Excludes auch als Zutaten-Filter nutzen,
            // aber eure Route hat bereits einen starken Allergen-Filter.
        }

        // ingredients-String (komma-separiert) – primär aus include_ingredients
        const ingredientsStr = include.join(',')

        // dietType bestimmen
        let dietType: "alle" | "vegan" | "vegetarisch" = "alle"
        if (diet.includes("vegan")) dietType = "vegan"
        else if (diet.includes("vegetarian") || diet.includes("vegetarisch")) dietType = "vegetarisch"

        const searchPayload = {
            query: english,                // EN für DB
            type: "text",
            k: 5,
            filters: {
                dietType,
                difficulty: 0,
                workTime: [0, 120],
                totalTime: timeMax ? [0, timeMax] : [0, 240],
                allergies,
                ingredients: ingredientsStr
            }
        }

        return c.json({
            ok: true,
            nlp: {
                original_de: prompt,
                english,
                keywords,
                detected_intent: raw.detected_intent ?? null,
                filters_raw: {
                    include_ingredients: include,
                    exclude_ingredients: exclude,
                    diet,
                    time_max: timeMax
                }
            },
            searchRequest: {
                endpoint: "/search",
                payload: searchPayload
            }
        })
    } catch (err: any) {
        console.error('Gemini /prepare error:', err)
        return c.json({ ok: false, error: err.message ?? 'Internal error' }, 500)
    }
})
