import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Einfacher Client für Google Gemini API
 * - nutzt Singleton für Wiederverwendung
 * - bietet Methoden für Text-Prompts (generateText)
 * - vorbereitet auf zukünftige Erweiterungen (Streaming, Vision etc.)
 */
export class GeminiClient {
    private static _instance: GeminiClient;
    private model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>;

    private constructor(apiKey: string) {
        const genAI = new GoogleGenerativeAI(apiKey);
        this.model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    }

    /**
     * Initialisiert oder gibt die bestehende Instanz zurück.
     */
    public static getInstance(): GeminiClient {
        if (!this._instance) {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
            if (!apiKey) throw new Error("VITE_GEMINI_API_KEY fehlt in .env");
            this._instance = new GeminiClient(apiKey);
        }
        return this._instance;
    }

    /**
     * Generiert eine einfache Textantwort.
     * @param prompt Eingabetext
     */
    public async generateText(prompt: string): Promise<string> {
        try {
            const res = await this.model.generateContent(prompt);
            return res.response.text();
        } catch (err: any) {
            console.error("Gemini API Fehler:", err);
            throw new Error(err.message || "Fehler bei der Anfrage an Gemini");
        }
    }
}
