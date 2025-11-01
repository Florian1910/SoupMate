
import { createClient } from '@supabase/supabase-js';
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import fetch from 'node-fetch';
import { load } from "dotenv";
import * as kv from "./kv_store.tsx";

// Lade die Umgebungsvariablen
load();

// Supabase-Client initialisieren
const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

const app = new Hono();

// Logger aktivieren
app.use('*', logger(console.log));

// CORS aktivieren
app.use(
    "/*",
    cors({
        origin: "*",
        allowHeaders: ["Content-Type", "Authorization"],
        allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        exposeHeaders: ["Content-Length"],
        maxAge: 600,
    }),
);

// Health Check Endpoint
app.get("/make-server-b187574e/health", (c) => {
    return c.json({ status: "ok" });
});

// ========================================================================
// 🟡 REZEPTE VON SPOONACULAR ABRUFEN
// ========================================================================
app.get("/make-server-b187574e/recipes", async (c) => {
    try {
        const query = c.req.query("query"); // Rezeptname, z.B. 'soup'
        const limit = parseInt(c.req.query("limit") || "5"); // Anzahl der Ergebnisse

        if (!query) {
            return c.json({ error: "Query parameter is required" }, 400);
        }

        const spoonacularApiKey = Deno.env.get('SPOONACULAR_API_KEY');
        const apiUrl = `https://api.spoonacular.com/recipes/complexSearch?query=${query}&number=${limit}&addRecipeInformation=true&apiKey=${spoonacularApiKey}`;

        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.results) {
            const recipes = data.results;
            // Hier die Rezepte in die Supabase-Datenbank speichern
            for (const recipe of recipes) {
                const { title, summary, instructions, extendedIngredients } = recipe;

                // Zutaten extrahieren
                const ingredients = extendedIngredients.map((ingredient: any) => ingredient.name);

                // Embedding für den Rezepttext generieren
                const recipeText = `${title} ${summary} ${instructions}`;
                const embedding = await generateEmbedding(recipeText); // Embedding generieren

                // Rezept und Zutaten in die Datenbank einfügen
                const { data: recipeData, error: recipeError } = await supabase
                    .from('test_recipes')
                    .upsert([{
                        name: title,
                        description: summary,
                        instructions: instructions,
                        text_embedding: embedding,
                    }]);

                if (recipeError) {
                    console.log("Error inserting recipe:", recipeError.message);
                } else {
                    const recipeId = recipeData[0].recipe_id;
                    await insertIngredients(recipeId, ingredients);  // Zutaten einfügen
                }
            }

            return c.json({ recipes });
        } else {
            return c.json({ error: "No recipes found" }, 404);
        }
    } catch (error) {
        return c.json({ error: "Error fetching recipes from Spoonacular", details: error.message }, 500);
    }
});

// Funktion zum Generieren von Embeddings für den Rezepttext
async function generateEmbedding(text: string): Promise<number[]> {
    // Deno subprocess verwenden, um Python auszuführen und das FAISS-Skript aufzurufen
    const result = await faissSearch(text);
    return result.ids;  // Gib die IDs von FAISS zurück
}

// Funktion zum Aufrufen des Python-Skripts über Deno subprocess
async function faissSearch(query: string) {
    try {
        // Den Python-Prozess über Deno subprocess starten
        const process = await Deno.run({
            cmd: ["python", "./src/supabase/functions/server/faiss_search.py", JSON.stringify(query)],
            stdout: "piped",  // Die Ausgabe des Prozesses einfangen
            stderr: "piped",  // Fehler des Prozesses einfangen
        });

        // Ausgabe und Fehler des Prozesses erfassen
        const output = await process.output();
        const error = await process.stderrOutput();

        if (error.length > 0) {
            console.error("Fehler bei der FAISS-Suche:", new TextDecoder().decode(error));
            return;
        }

        // Das Ergebnis der FAISS-Suche (IDs und Distanzen)
        const result = JSON.parse(new TextDecoder().decode(output));  // Ausgabe als JSON verarbeiten
        return result;  // Rückgabe der Ergebnisse
    } catch (err) {
        console.error("Fehler beim Ausführen von FAISS:", err);
    }
}

// Funktion zum Einfügen von Zutaten in die Supabase-Datenbank
async function insertIngredients(recipeId: string, ingredients: string[]) {
    for (const ingredient of ingredients) {
        // Zutaten in `test_ingredients`-Tabelle einfügen
        await supabase.from('test_ingredients').upsert([{
            name: ingredient,
        }]);

        // Verbindung zwischen Rezept und Zutaten herstellen (N:M)
        const { data: ingredientData, error: ingredientError } = await supabase
            .from('test_ingredients')
            .select('ingredient_id')
            .eq('name', ingredient)
            .single();

        if (ingredientError) {
            console.log("Error fetching ingredient:", ingredientError.message);
        } else {
            const ingredientId = ingredientData?.ingredient_id;

            await supabase.from('test_recipe_ingredients').upsert([{
                recipe_id: recipeId,
                ingredient_id: ingredientId,
            }]);
        }
    }
}

Deno.serve(app.fetch);
