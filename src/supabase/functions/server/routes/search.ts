import { Hono } from 'hono';
import { EmbeddingService } from '../services/embedding.ts';
import { supabase } from '../services/database.ts'; // Korrigierter Import
import { config } from '../config/environment.ts';

const app = new Hono();
const embeddingService = new EmbeddingService();

// Semantische Suche mit FAISS
app.post('/search', async (c) => {
    try {
        const body = await c.req.json();
        const { query, type = 'text', k = 10 } = body;

        if (!query) {
            return c.json({ error: 'Query parameter is required' }, 400);
        }

        let results;

        if (type === 'text') {
            results = await embeddingService.semanticSearch(query, k);
        } else if (type === 'ingredients') {
            const ingredients = Array.isArray(query) ? query : [query];
            results = await embeddingService.searchByIngredients(ingredients, k);
        } else {
            return c.json({ error: 'Invalid search type. Use "text" or "ingredients"' }, 400);
        }

        return c.json({
            success: true,
            query,
            type,
            results
        });

    } catch (error) {
        console.error('Error in /search endpoint:', error);
        return c.json({
            error: 'Search failed',
            details: error.message
        }, 500);
    }
});

// Rezept-Details abrufen
app.get('/recipes/:id', async (c) => {
    try {
        const recipeId = c.req.param('id');

        if (!recipeId) {
            return c.json({ error: 'Recipe ID is required' }, 400);
        }

        const details = await embeddingService.getRecipeDetails(recipeId);

        return c.json({
            success: true,
            recipe: details
        });

    } catch (error) {
        console.error('Error fetching recipe details:', error);
        return c.json({
            error: 'Failed to fetch recipe details',
            details: error.message
        }, 500);
    }
});

// Rezepte importieren
app.post('/recipes/import', async (c) => {
    try {
        const body = await c.req.json();
        const { query = "", number = 20 } = body;

        await embeddingService.importRecipes(query, number);

        return c.json({
            success: true,
            message: `Successfully imported ${number} recipes`,
            query
        });

    } catch (error) {
        console.error('Error importing recipes:', error);
        return c.json({
            error: 'Recipe import failed',
            details: error.message
        }, 500);
    }
});

export default app;