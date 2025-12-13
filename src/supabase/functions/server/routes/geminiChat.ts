// routes/geminiChat.ts
import { Hono } from 'hono';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/environment.ts';

export const geminiRoutes = new Hono();

/**
 * Einfacher Test-Endpunkt – freier Prompt → Gemini-Antwort (roh)
 */
geminiRoutes.post('/', async (c) => {
    try {
        const apiKey = Deno.env.get('GEMINI_API_KEY');
        if (!apiKey) return c.json({ ok: false, error: 'GEMINI_API_KEY missing' }, 500);

        const { prompt } = await c.req.json().catch(() => ({}));
        if (!prompt || typeof prompt !== 'string')
            return c.json({ ok: false, error: "Body must include 'prompt' (string)" }, 400);

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        return c.json({ ok: true, prompt, text });
    } catch (err: any) {
        console.error('Gemini error:', err);
        return c.json({ ok: false, error: err.message ?? 'Internal error' }, 500);
    }
});

/**
 * NLP-Vorbereitung – Deutsch → Englisch, Keywords, Filter
 */
geminiRoutes.post('/prepare', async (c) => {
    try {
        const apiKey = Deno.env.get('GEMINI_API_KEY');
        if (!apiKey) return c.json({ ok: false, error: 'GEMINI_API_KEY missing' }, 500);

        const { prompt } = await c.req.json().catch(() => ({}));
        if (!prompt || typeof prompt !== 'string')
            return c.json({ ok: false, error: "Body must include 'prompt' (string)" }, 400);

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const schema = {
            type: 'object',
            properties: {
                english_prompt: { type: 'string' },
                keywords: { type: 'array', items: { type: 'string' } },
                detected_intent: { type: 'string' },
                filters: {
                    type: 'object',
                    properties: {
                        diet: { type: 'array', items: { type: 'string' } },
                        include_ingredients: { type: 'array', items: { type: 'string' } },
                        exclude_ingredients: { type: 'array', items: { type: 'string' } },
                        time_max: { type: 'number' }
                    }
                }
            },
            required: ['english_prompt', 'keywords']
        } as const;

        const sysPrompt =
            'You are a multilingual NLP parser. Input is German. ' +
            '1) Translate to English. 2) Extract cooking-related keywords. 3) Detect intent. 4) Build filters. ' +
            'Return valid JSON according to schema.';

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            systemInstruction: { role: 'system', parts: [{ text: sysPrompt }] },
            generationConfig: {
                temperature: 0.2,
                responseMimeType: 'application/json',
                responseSchema: schema
            }
        });

        const parsed = JSON.parse(result.response.text());
        const f = parsed.filters ?? {};

        // === STOPWORT-FILTER für generische Begriffe ===
        const STOPWORDS = new Set([
            'soup','soups','recipe','recipes','dish','dishes',
            'meal','meals','food','foods','course','courses','cuisine','kitchen'
        ]);
        const normArr = (arr: any) => (Array.isArray(arr) ? arr.map((x) => String(x).toLowerCase().trim()).filter(Boolean) : []);
        const include = normArr(f.include_ingredients).filter((x) => !STOPWORDS.has(x));
        const exclude = normArr(f.exclude_ingredients);
        const allergies = exclude.map((x) => (x === 'celery' ? 'Sellerie' : x));
        const diet = (f.diet && f.diet[0]) || 'alle';
        const timeMax = f.time_max ?? 240;

        const searchPayload = {
            query: parsed.english_prompt,
            type: 'text',
            k: 5,
            filters: {
                dietType: diet,
                difficulty: 0,
                workTime: [0, 120],
                totalTime: [0, timeMax],
                allergies,
                ingredients: include.join(',')
            }
        };

        return c.json({
            ok: true,
            nlp: {
                original_de: prompt,
                english: parsed.english_prompt,
                keywords: parsed.keywords,
                detected_intent: parsed.detected_intent,
                filters_raw: parsed.filters
            },
            searchRequest: {
                endpoint: '/search',
                payload: searchPayload
            }
        });
    } catch (err: any) {
        console.error('Gemini prepare error:', err);
        return c.json({ ok: false, error: err.message ?? 'Internal error' }, 500);
    }
});

// =====================================================================
// Hilfsfunktionen
// =====================================================================

function mapDietToGerman(r: any): string {
    if (r?.vegan) return 'vegan';
    if (r?.vegetarian) return 'vegetarisch';
    const diets = Array.isArray(r?.diets)
        ? r.diets.map((d: string) => d.toLowerCase())
        : r?.diet ? [String(r.diet).toLowerCase()] : [];
    if (diets.includes('vegan')) return 'vegan';
    if (diets.includes('vegetarian')) return 'vegetarisch';
    if (diets.includes('gluten free') || diets.includes('gluten-free')) return 'glutenfrei';
    if (diets.includes('dairy free') || diets.includes('dairy-free')) return 'laktosefrei';
    return '—';
}

/**
 * Batch-Übersetzung: Titel, Beschreibung, vollständige Anweisungen → Deutsch
 * Rückgabe: Map nach recipe_id
 */
async function translateRecipesToGermanBatch(
    apiKey: string,
    recipes: Array<{ recipe_id: string; name: string; description: string; instructions: string; }>
): Promise<Record<string, { title_de: string; summary_de: string; instructions_full_de: string }>> {
    if (!recipes.length) return {};

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const payload = recipes.map((r) => ({
        id: r.recipe_id,
        title_en: r.name ?? '',
        summary_en: r.description ?? '',
        instructions_en: r.instructions ?? ''
    }));

    const schema = {
        type: 'object',
        properties: {
            translations: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        title_de: { type: 'string' },
                        summary_de: { type: 'string' },
                        instructions_full_de: { type: 'string' }
                    },
                    required: ['id','title_de','summary_de','instructions_full_de']
                }
            }
        },
        required: ['translations']
    } as const;

    const sys =
        'Translate each recipe (title_en, summary_en, instructions_en) into GERMAN. ' +
        'Return complete, natural German. Do NOT omit or truncate. ' +
        'Preserve structure and imperative style in instructions. ' +
        'Return STRICT JSON per schema, no extra commentary.';

    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: JSON.stringify({ items: payload }) }] }],
        systemInstruction: { role: 'system', parts: [{ text: sys }] },
        generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
            responseSchema: schema
        }
    });

    let json: any;
    try {
        json = JSON.parse(result.response.text());
    } catch {
        // Robustheit: versuche JSON zu extrahieren
        const txt = result.response.text();
        const m = txt.match(/\{[\s\S]*\}$/);
        if (!m) return {};
        try { json = JSON.parse(m[0]); } catch { return {}; }
    }

    const map: Record<string, { title_de: string; summary_de: string; instructions_full_de: string }> = {};
    for (const t of json?.translations ?? []) {
        map[t.id] = {
            title_de: String(t.title_de || '').trim(),
            summary_de: String(t.summary_de || '').trim(),
            instructions_full_de: String(t.instructions_full_de || '').trim()
        };
    }
    return map;
}

/**
 * Fallback: Ein einzelnes Rezept übersetzen (falls Batch fehlschlug)
 */
async function translateOneRecipeToGerman(
    apiKey: string,
    item: { recipe_id: string; name: string; description: string; instructions: string; }
): Promise<{ title_de: string; summary_de: string; instructions_full_de: string } | null> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const schema = {
        type: 'object',
        properties: {
            title_de: { type: 'string' },
            summary_de: { type: 'string' },
            instructions_full_de: { type: 'string' }
        },
        required: ['title_de','summary_de','instructions_full_de']
    } as const;

    const sys =
        'Translate recipe fields to GERMAN. No omissions, keep full instructions in imperative sentences. ' +
        'Return STRICT JSON with title_de, summary_de, instructions_full_de.';

    const result = await model.generateContent({
        contents: [{
            role: 'user',
            parts: [{ text: JSON.stringify({
                    title_en: item.name ?? '',
                    summary_en: item.description ?? '',
                    instructions_en: item.instructions ?? ''
                }) }]
        }],
        systemInstruction: { role: 'system', parts: [{ text: sys }] },
        generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
            responseSchema: schema
        }
    });

    try {
        const j = JSON.parse(result.response.text());
        return {
            title_de: String(j.title_de || '').trim(),
            summary_de: String(j.summary_de || '').trim(),
            instructions_full_de: String(j.instructions_full_de || '').trim()
        };
    } catch {
        return null;
    }
}

/**
 * Renderer: vollständige DE-Antwort (ohne Ellipsen)
 */
function renderGermanAnswerFull(
    promptDe: string,
    recipes: any[],
    deMap: Record<string, { title_de: string; summary_de: string; instructions_full_de: string }>
) {
    if (!recipes || recipes.length === 0) {
        return `Ich habe leider keine passenden Rezepte zu deiner Anfrage gefunden: „${promptDe}“.
Möchtest du die Filter lockern (z. B. mehr Gesamtzeit oder weniger Einschränkungen)?`;
    }

    const blocks = recipes.map((r: any, i: number) => {
        const id = r.recipe_id;
        const tr = deMap[id];
        const title = tr?.title_de || r.name || 'Ohne Titel';
        const time = r.total_time ? `${r.total_time} min` : 'k. A.';
        const diet = mapDietToGerman(r);
        const score = (typeof r.score === 'number') ? r.score.toFixed(3) : '—';
        const desc = tr?.summary_de || (r.description || '');
        const instr = tr?.instructions_full_de || (r.instructions || '');
        const img = r.image_url ? `\n🖼️ ${r.image_url}` : '';

        return `**${i + 1}. ${title}**
⏱️ ${time}    🥗 ${diet}    ⭐ ${score}
${desc}

👩‍🍳 **Zubereitung:**
${instr}${img}`;
    });

    return `Hier sind passende Vorschläge zu: „${promptDe}“\n\n${blocks.join('\n\n')}\n\n` +
        `Sag mir gern, ob ich die Suche verfeinern soll (z. B. andere Zutaten, kürzere Zeit oder bestimmte Küche).`;
}

/**
 * Vollständiger RAG-Flow (Prepare → Search → Übersetzung → Antwort)
 */
geminiRoutes.post('/rag', async (c) => {
    try {
        const { prompt, k = 5, translate = true } = await c.req.json().catch(() => ({}));
        if (!prompt || typeof prompt !== 'string')
            return c.json({ ok: false, error: "Body must include 'prompt' (string)" }, 400);

        const baseUrl = `http://localhost:${config.app.port}`;

        // 1) NLP vorbereiten
        const prepRes = await fetch(`${baseUrl}/gemini/prepare`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });
        if (!prepRes.ok) return c.json({ ok: false, step: 'prepare', error: await prepRes.text() }, 502);
        const prepJson: any = await prepRes.json();
        const searchPayload = prepJson?.searchRequest?.payload;
        if (!prepJson?.ok || !searchPayload)
            return c.json({ ok: false, step: 'prepare', error: 'Malformed prepare response' }, 502);
        searchPayload.k = k;

        // 2) Suche ausführen
        const searchRes = await fetch(`${baseUrl}/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(searchPayload)
        });
        if (!searchRes.ok) return c.json({ ok: false, step: 'search', error: await searchRes.text() }, 502);
        const searchJson: any = await searchRes.json();
        let recipes = searchJson?.recipes ?? [];

        // 🔁 Fallback: Wenn zu wenig Treffer, 2. Suche ohne Zutatenfilter
        if (recipes.length < Math.min(k, 3) && searchPayload.filters?.ingredients) {
            const payload2 = { ...searchPayload, filters: { ...searchPayload.filters, ingredients: '' } };
            const res2 = await fetch(`${baseUrl}/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload2)
            });
            if (res2.ok) {
                const j2 = await res2.json();
                if ((j2?.recipes?.length ?? 0) > recipes.length) recipes = j2.recipes;
            }
        }

        // 3) Übersetzen (Titel, Beschreibung, komplette Anweisungen)
        let translationsMap: Record<string, { title_de: string; summary_de: string; instructions_full_de: string }> = {};
        if (translate && recipes.length > 0) {
            const apiKey = Deno.env.get('GEMINI_API_KEY') || '';
            if (apiKey) {
                const minimal = recipes
                    .filter((r: any) => r.recipe_id)
                    .slice(0, k)
                    .map((r: any) => ({
                        recipe_id: r.recipe_id,
                        name: r.name || '',
                        description: r.description || '',
                        instructions: r.instructions || ''
                    }));

                // Batch
                translationsMap = await translateRecipesToGermanBatch(apiKey, minimal);

                // Fallback pro Rezept, falls einzelne fehlen
                for (const it of minimal) {
                    if (!translationsMap[it.recipe_id]) {
                        const one = await translateOneRecipeToGerman(apiKey, it);
                        if (one) translationsMap[it.recipe_id] = one;
                    }
                }
            }
        }

        // 4) Chat-Antwort rendern – vollständig auf Deutsch
        const answer = renderGermanAnswerFull(
            prepJson?.nlp?.original_de ?? prompt,
            recipes,
            translationsMap
        );

        return c.json({
            ok: true,
            steps: {
                nlp: prepJson.nlp,
                searchPayload,
                searchStats: {
                    count: searchJson?.count ?? recipes.length,
                    responseTime: searchJson?.responseTime,
                    filterSummary: searchJson?.filterSummary,
                    searchMethod: searchJson?.searchMethod
                }
            },
            recipes,
            translations: translationsMap,
            answer_text: answer
        });
    } catch (err: any) {
        console.error('/gemini/rag error:', err);
        return c.json({ ok: false, error: err.message ?? 'Internal error' }, 500);
    }
});
