import { Hono } from 'hono';

const app = new Hono();

app.get('/health', (c) => {
    return c.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'SoupMate Backend'
    });
});

export default app;