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
