import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

// Config muss zuerst importiert werden, damit dotenv lädt
import { config } from './config/environment.ts';

// Routes
import healthRoutes from './routes/health.ts';
import recipeRoutes from './routes/recipes.ts';
import searchRoutes from './routes/search.ts';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
    origin: '*',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
}));

// Routes registrieren - OHNE zusätzlichen Prefix
app.route('/health', healthRoutes);
app.route('/recipes', recipeRoutes);
app.route('/search', searchRoutes);

app.get('/favorites/:userId', (c) => {
  return c.json({
    success: true,
    message: 'Favorites endpoint - not implemented yet',
    favorites: []
  });
});

app.post('/favorites', (c) => {
  return c.json({
    success: true,
    message: 'Add favorite endpoint - not implemented yet'
  });
});

// Root route
app.get('/', (c) => c.json({
    ok: true,
    msg: "SoupMate backend running 🥣",
    version: "1.0.0",
    endpoints: [
        '/health',
        '/recipes',
        '/search'
    ]
}));

// 404 Handler
app.notFound((c) => {
    return c.json({ error: 'Endpoint not found' }, 404);
});

// Error Handler
app.onError((err, c) => {
    console.error('Server error:', err);
    return c.json({ error: 'Internal server error' }, 500);
});

console.log('🍲 SoupMate Server starting on port', config.app.port);
Deno.serve({ port: config.app.port }, app.fetch);