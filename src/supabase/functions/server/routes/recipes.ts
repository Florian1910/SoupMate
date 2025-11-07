import { Hono } from 'hono';
import { SpoonacularService } from '../services/spoonacular.ts';
import { EmbeddingService } from '../services/embedding.ts';
import { supabase } from '../services/database.ts'; // Jetzt sollte der Import funktionieren
import { config } from '../config/environment.ts';

const app = new Hono();
const spoonacularService = new SpoonacularService();
const embeddingService = new EmbeddingService();

// Rezepte von Spoonacular abrufen und in DB speichern
app.get('/recipes', async (c) => {
    try {
        const query = c.req.query('query');
        const limit = parseInt(c.req.query('limit') || '5');

        if (!query) {
            return c.json({ error: 'Query parameter is required' }, 400);
        }

        const data = await spoonacularService.searchRecipes(query, limit);

        if (data.results) {
            const recipes = data.results;

            for (const recipe of recipes) {
                const { title, summary, instructions, extendedIngredients } = recipe;

                // Embedding für den Rezepttext generieren
                const recipeText = `${title} ${summary} ${instructions}`;
                const embedding = await embeddingService.generateEmbedding(recipeText);

                // Rezept in die Datenbank einfügen
                const { data: recipeData, error: recipeError } = await supabase
                    .from(config.database.tableNames.recipes)
                    .upsert([{
                        name: title,
                        description: summary,
                        instructions: instructions,
                        text_embedding: embedding,
                    }])
                    .select();

                if (recipeError) {
                    console.error('Error inserting recipe:', recipeError.message);
                } else if (recipeData && recipeData.length > 0) {
                    const recipeId = recipeData[0].recipe_id;
                    await insertIngredients(recipeId, extendedIngredients);
                }
            }

            return c.json({
                success: true,
                message: `${recipes.length} recipes processed`,
                recipes
            });
        } else {
            return c.json({ error: 'No recipes found' }, 404);
        }
    } catch (error) {
        console.error('Error in /recipes endpoint:', error);
        return c.json({
            error: 'Error fetching recipes from Spoonacular',
            details: error.message
        }, 500);
    }
});

// Hilfsfunktion zum Einfügen von Zutaten
async function insertIngredients(recipeId: string, ingredients: any[]) {
    for (const ingredient of ingredients) {
        const ingredientName = ingredient.name;

        if (!ingredientName) continue;

        // Zutat einfügen oder vorhandene abrufen
        const { data: ingredientData, error: ingredientError } = await supabase
            .from(config.database.tableNames.ingredients)
            .upsert([{ name: ingredientName }])
            .select()
            .single();

        if (ingredientError) {
            console.error('Error inserting ingredient:', ingredientError.message);
            continue;
        }

        if (ingredientData) {
            // Verknüpfung erstellen
            await supabase
                .from(config.database.tableNames.recipeIngredients)
                .upsert([{
                    recipe_id: recipeId,
                    ingredient_id: ingredientData.ingredient_id,
                }]);
        }
    }
}

export default app;