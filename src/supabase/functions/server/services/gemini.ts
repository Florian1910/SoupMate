// services/gemini.ts
import { GoogleGenerativeAI } from "npm:@google/generative-ai";

/**
 * GeminiService
 * --------------
 * Verwaltet die Verbindung zur Google Generative Language API (Gemini).
 * Liest den API-Key aus der .env und ruft das Modell gemini-2.5-flash auf.
 */
export class GeminiService {
    private client: GoogleGenerativeAI;
    private modelName = "gemini-2.5-flash"; // Aktuelles stabiles Modell

    constructor() {
        const key = Deno.env.get("GEMINI_API_KEY");
        if (!key) {
            throw new Error("❌ GEMINI_API_KEY fehlt in .env");
        }

        this.client = new GoogleGenerativeAI(key);
    }

    /**
     * Sendet einen Prompt an Gemini und gibt den generierten Text zurück.
     */
    async generateText(prompt: string): Promise<string> {
        try {
            const model = this.client.getGenerativeModel({ model: this.modelName });
            const result = await model.generateContent(prompt);

            // Sicherstellen, dass eine Antwort vorhanden ist
            const text = result?.response?.text?.() ?? "";
            if (!text) {
                throw new Error("Leere Antwort vom Gemini-Modell erhalten.");
            }

            return text;
        } catch (err) {
            console.error("❌ Gemini API Error:", err);
            throw new Error(`Gemini API Request failed: ${String(err)}`);
        }
    }
}
