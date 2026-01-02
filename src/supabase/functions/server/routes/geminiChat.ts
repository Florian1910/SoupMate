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
 * Difficulty aus Nutzer-Prompt ableiten (Heuristik)
 * 0 = kein Filter; 1..5 = gewünschte Schwierigkeit
 */
function inferDifficultyFromPrompt(prompt: string): number {
    const p = (prompt || '').toLowerCase();

    const explicit = p.match(/\b(schwierigkeit|difficulty)\s*[:=]?\s*(1|2|3|4|5)\b/);
    if (explicit) return parseInt(explicit[2], 10);

    if (/\b(einfach|simpel|anfänger|anfängerfreundlich|leicht)\b/.test(p)) return 2;
    if (/\b(mittel|durchschnittlich|normal)\b/.test(p)) return 3;
    if (/\b(anspruchsvoll|aufwendig|kompliziert|schwer|fortgeschritten)\b/.test(p)) return 5;

    if (/\b(easy|beginner|simple|quick and easy)\b/.test(p)) return 2;
    if (/\b(medium|moderate|normal)\b/.test(p)) return 3;
    if (/\b(hard|advanced|complex|challenging|elaborate)\b/.test(p)) return 5;

    return 0;
}

function normalizeIngredient(word: string): string {
    // einfache, kontrollierte Singularisierung (EN)
    if (word.endsWith('ies')) return word.slice(0, -3) + 'y'; // berries -> berry
    if (word.endsWith('oes')) return word.slice(0, -2);      // tomatoes -> tomato
    if (word.endsWith('ses')) return word.slice(0, -2);      // cheeses -> cheese
    if (word.endsWith('s') && word.length > 3) return word.slice(0, -1); // lentils -> lentil
    return word;
}

/**
 * NLP-Vorbereitung – Deutsch → Englisch + EXTRAHIERE NUR ZUTATEN
 * Wichtig: filters.ingredients darf NICHT "vegan soup quick ..." enthalten,
 * sondern NUR "tomato,lentils" etc.
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

        // ✅ Schema: wir brauchen english_prompt + ingredients-only
        const schema = {
            type: 'object',
            properties: {
                english_prompt: { type: 'string' },
                ingredients: { type: 'array', items: { type: 'string' } }, // <-- NUR Zutaten
                exclude_ingredients: { type: 'array', items: { type: 'string' } }, // optional
                diet: { type: 'string' },      // optional (vegan/vegetarian/alle)
                time_max: { type: 'number' }   // optional
            },
            required: ['english_prompt', 'ingredients']
        } as const;

        // ✅ System Prompt: erzwingt "ingredients only"
        const sysPrompt =
            'Input is German. Return STRICT JSON only.\n' +
            '1) Translate the full user prompt into English as english_prompt.\n' +
            '2) Extract ONLY ingredient names into ingredients (English, lowercase).\n' +
            '   - ingredients must contain ONLY foods/ingredients (e.g., tomato, lentils, garlic).\n' +
            '   - DO NOT include generic words (soup, recipe), diets (vegan), time words (quick), cuisines, or adjectives.\n' +
            '3) If the user excludes ingredients (e.g., "ohne X"), put them into exclude_ingredients (English, lowercase).\n' +
            '4) If diet is mentioned, set diet to "vegan" or "vegetarian", else "alle".\n' +
            '5) If user says quick/schnell and no explicit time is given, set time_max=30, else omit or set to 240.\n';

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

        const inferredDifficulty = inferDifficultyFromPrompt(prompt);

        // -----------------------------
        // ✅ Normalisieren + "Ban-Liste"
        // -----------------------------
        const normArr = (arr: any) =>
            Array.isArray(arr)
                ? arr.map((x) => String(x).toLowerCase().trim()).filter(Boolean)
                : [];

        const rawIngredients = normArr(parsed.ingredients);
        const rawExclude = normArr(parsed.exclude_ingredients);

        // Hard-Ban für typische Nicht-Zutaten
        const BAN = new Set([
            'soup', 'soups', 'recipe', 'recipes', 'dish', 'dishes', 'meal', 'meals', 'food', 'foods',
            'vegan', 'vegetarian', 'quick', 'easy', 'healthy', 'low', 'calorie', 'calories',
            'gluten-free', 'dairy-free', 'breakfast', 'lunch', 'dinner'
        ]);

        const cleanIngredients = rawIngredients
            .map(normalizeIngredient)
            .filter((x) => !BAN.has(x));


        // Allergies Mapping (wie ihr’s vorher gemacht habt)
        // Du kannst hier genauso wie im Search.ts euer Mapping pflegen.
        const allergyMap: Record<string, string> = {
            celery: 'Sellerie',
            gluten: 'Gluten',
            lactose: 'Laktose',
            milk: 'Laktose',
            nuts: 'Nüsse',
            nut: 'Nüsse',
            peanut: 'Nüsse',
            soy: 'Soja',
            egg: 'Eier',
            eggs: 'Eier',
            fish: 'Fisch',
            shellfish: 'Schalentiere',
            shrimp: 'Schalentiere',
            prawn: 'Schalentiere',
            crab: 'Schalentiere',
            lobster: 'Schalentiere'
        };

        const allergies: string[] = [];
        for (const ex of rawExclude) {
            const mapped = allergyMap[ex];
            if (mapped) allergies.push(mapped);
        }

        // Diet / Time
        const diet = typeof parsed.diet === 'string' ? String(parsed.diet).toLowerCase().trim() : 'alle';
        const timeMax = Number.isFinite(parsed.time_max) ? Number(parsed.time_max) : 240;

        // =========================================================
        // 🔥 HIER ist die entscheidende Stelle:
        // filters.ingredients = NUR extrahierte Zutaten (EN)
        // Das wird in search.ts als zweites python-Argument übergeben
        // -> clean_search.py -> search_combined(... ingredients_query=...)
        // =========================================================
        const ingredientsStr = cleanIngredients.join(',');

        const searchPayload = {
            query: String(parsed.english_prompt || '').trim(), // Voller Prompt EN (Text-Suche)
            type: 'text',
            k: 5,
            filters: {
                dietType: diet || 'alle',
                difficulty: inferredDifficulty,
                workTime: [0, 120],
                totalTime: [0, timeMax],
                allergies,
                ingredients: ingredientsStr // ✅ NUR Zutaten, NICHT der ganze Prompt!
            }
        };

        return c.json({
            ok: true,
            nlp: {
                original_de: prompt,
                english: searchPayload.query,
                ingredients_extracted: cleanIngredients,
                exclude_extracted: rawExclude,
                inferredDifficulty,
                diet,
                time_max: timeMax
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
                    required: ['id', 'title_de', 'summary_de', 'instructions_full_de']
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
 * Batch-Übersetzung: Zutaten (name + quantity_text) → Deutsch
 * Rückgabe: Map nach recipe_id
 */
async function translateIngredientsToGermanBatch(
    apiKey: string,
    recipes: Array<{ recipe_id: string; ingredients: Array<{ name?: string; quantity_text?: string }> }>
): Promise<Record<string, Array<{ name_de: string; quantity_text_de: string }>>> {
    if (!recipes.length) return {};

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const payload = recipes.map((r) => ({
        id: r.recipe_id,
        ingredients: (r.ingredients ?? []).map((ing) => ({
            name_en: String(ing?.name ?? "").trim(),
            quantity_text_en: String(ing?.quantity_text ?? "").trim(),
        })),
    }));

    const schema = {
        type: "object",
        properties: {
            translations: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        ingredients: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    name_de: { type: "string" },
                                    quantity_text_de: { type: "string" },
                                },
                                required: ["name_de", "quantity_text_de"],
                            },
                        },
                    },
                    required: ["id", "ingredients"],
                },
            },
        },
        required: ["translations"],
    } as const;

    const sys =
        "Translate ingredients to GERMAN. " +
        "Input provides name_en and quantity_text_en per ingredient. " +
        "Return ingredients with name_de and quantity_text_de. " +
        "Keep units and numbers correct. " +
        "Return STRICT JSON per schema. No extra text.";

    const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: JSON.stringify({ items: payload }) }] }],
        systemInstruction: { role: "system", parts: [{ text: sys }] },
        generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
            responseMimeType: "application/json",
            responseSchema: schema,
        },
    });

    let json: any;
    try {
        json = JSON.parse(result.response.text());
    } catch {
        const txt = result.response.text();
        const m = txt.match(/\{[\s\S]*\}$/);
        if (!m) return {};
        try {
            json = JSON.parse(m[0]);
        } catch {
            return {};
        }
    }

    const out: Record<string, Array<{ name_de: string; quantity_text_de: string }>> = {};
    for (const t of json?.translations ?? []) {
        out[String(t.id)] = (t.ingredients ?? []).map((x: any) => ({
            name_de: String(x.name_de || "").trim(),
            quantity_text_de: String(x.quantity_text_de || "").trim(),
        }));
    }
    return out;
}


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
        required: ['title_de', 'summary_de', 'instructions_full_de']
    } as const;

    const sys =
        'Translate recipe fields to GERMAN. No omissions, keep full instructions in imperative sentences. ' +
        'Return STRICT JSON with title_de, summary_de, instructions_full_de.';

    const result = await model.generateContent({
        contents: [{
            role: 'user',
            parts: [{
                text: JSON.stringify({
                    title_en: item.name ?? '',
                    summary_en: item.description ?? '',
                    instructions_en: item.instructions ?? ''
                })
            }]
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

        // 2) Suche ausführen (geht auf search.ts -> clean_search.py -> search_combined)
        const searchRes = await fetch(`${baseUrl}/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(searchPayload)
        });
        if (!searchRes.ok) return c.json({ ok: false, step: 'search', error: await searchRes.text() }, 502);

        const searchJson: any = await searchRes.json();
        let recipes = searchJson?.recipes ?? [];

        // Optionaler Fallback (nur wenn KEIN Pflicht-Zutatenfilter aktiv ist)
        const hasRequiredIngredients =
            !!(searchPayload.filters?.ingredients && String(searchPayload.filters.ingredients).trim() !== '');

        if (recipes.length < Math.min(k, 3)) {
            if (hasRequiredIngredients) {
                console.log(`🛑 Kein Fallback, Pflicht-Zutaten aktiv: "${searchPayload.filters.ingredients}"`);
            } else {
                console.log('⚠️ Wenig Ergebnisse, starte Fallback ohne Zutatenfilter...');
                const fallbackPayload = { ...searchPayload, filters: { ...searchPayload.filters, ingredients: '' } };

                const fallbackRes = await fetch(`${baseUrl}/search`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(fallbackPayload)
                });

                const fallbackJson = await fallbackRes.json();
                recipes = fallbackJson?.recipes ?? recipes;
            }
        }

        // 3) Übersetzen (Titel, Beschreibung, komplette Anweisungen) + Zutaten
        let translationsMap: Record<string, { title_de: string; summary_de: string; instructions_full_de: string }> = {};
        let ingredientsTranslations: Record<string, Array<{ name_de: string; quantity_text_de: string }>> = {};

        if (translate && recipes.length > 0) {
            const apiKey = Deno.env.get("GEMINI_API_KEY") || "";
            if (apiKey) {
                // Minimal fürs Rezept-Text-Batch
                const minimalText = recipes
                    .filter((r: any) => r.recipe_id)
                    .slice(0, k)
                    .map((r: any) => ({
                        recipe_id: r.recipe_id,
                        name: r.name || "",
                        description: r.description || "",
                        instructions: r.instructions || "",
                    }));

                translationsMap = await translateRecipesToGermanBatch(apiKey, minimalText);

                // Fallback pro Rezept (wie gehabt)
                for (const it of minimalText) {
                    if (!translationsMap[it.recipe_id]) {
                        const one = await translateOneRecipeToGerman(apiKey, it);
                        if (one) translationsMap[it.recipe_id] = one;
                    }
                }

                // Zutaten-Übersetzung (Batch)
                const minimalIngredients = recipes
                    .filter((r: any) => r.recipe_id && Array.isArray(r.ingredients))
                    .slice(0, k)
                    .map((r: any) => ({
                        recipe_id: r.recipe_id,
                        ingredients: (r.ingredients ?? []).map((ing: any) => ({
                            name: ing?.name ?? "",
                            quantity_text: ing?.quantity_text ?? "",
                        })),
                    }));

                ingredientsTranslations = await translateIngredientsToGermanBatch(apiKey, minimalIngredients);

                // ✅ Override: recipes[].ingredients auf Deutsch setzen (Front-end bekommt direkt DE)
                recipes = recipes.map((r: any) => {
                    const tr = ingredientsTranslations[r.recipe_id];
                    if (!tr || !Array.isArray(r.ingredients)) return r;

                    // gleicher Index → gleiche Zutat (DB liefert stabil in eurer Reihenfolge)
                    const newIngredients = r.ingredients.map((ing: any, idx: number) => {
                        const t = tr[idx];
                        if (!t) return ing;
                        return {
                            ...ing,
                            name: t.name_de || ing.name,
                            quantity_text: t.quantity_text_de || ing.quantity_text,
                        };
                    });

                    return { ...r, ingredients: newIngredients };
                });
            }
        }


        // 4) Rendern
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
