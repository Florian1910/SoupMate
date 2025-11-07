// config/environment.ts - Komplett neue Version
export const config = {
    supabase: {
        url: Deno.env.get('SUPABASE_URL') || '',
        secretKey: Deno.env.get('SUPABASE_SECRET_KEY') || '',
        serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
        dbUrl: Deno.env.get('SUPABASE_DB_URL') || '',
    },
    spoonacular: {
        apiKey: Deno.env.get('SPOONACULAR_API_KEY') || '',
    },
    database: {
        tableNames: {
            recipes: Deno.env.get('TABLE_NAME') || 'test_recipes',
            ingredients: 'test_ingredients',
            recipeIngredients: 'test_recipe_ingredients',
            nutrition: 'test_recipe_nutrition',
            kvStore: 'kv_store_b187574e',
        }
    },
    app: {
        saveMode: Deno.env.get('SAVE_MODE') || 'db',
        port: 8000
    }
};

// Einfache Validierung
console.log('🔧 Environment Config geladen');
console.log('Supabase URL:', config.supabase.url ? '✅' : '❌');
console.log('Service Role Key:', config.supabase.serviceRoleKey ? '✅' : '❌');
console.log('Spoonacular Key:', config.spoonacular.apiKey ? '✅' : '❌');