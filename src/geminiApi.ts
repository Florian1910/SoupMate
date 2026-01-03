// src/geminiApi.ts
import { API_CONFIG } from "./config";

/**
* Einfacher Test-Endpunkt – freier Prompt → Gemini-Antwort (roh)
*/
export async function geminiChat(prompt: string): Promise<{ ok: boolean; prompt: string; text: string; error?: string }> {
  const res = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.gemini}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data?.error ?? "Gemini Chat fehlgeschlagen");
  }
  return data;
}

/**
 * NLP-Vorbereitung – Deutsch → Englisch, Keywords, Filter
 */
export async function geminiPrepare(
  prompt: string,
  filters?: any
): Promise<{
  ok: boolean;
  nlp: {
    original_de: string;
    english: string;
    keywords: string[];
    detected_intent: string;
    filters_raw: any;
  };
  searchRequest: {
    endpoint: string;
    payload: any;
  };
  error?: string;
}> {
  const res = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.geminiPrepare}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, filters }), // ✅ filters mitschicken
  });

  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data?.error ?? "Gemini Prepare fehlgeschlagen");
  }
  return data;
}

/**
 * Vollständiger RAG-Flow (Prepare → Search → Übersetzung → Antwort)
 * WICHTIG:
 * - filters.ingredients (User Sidebar) = Pflichtfilter (strikt)
 * - LLM Ingredients = nur Similarity Hint (Backend baut ingredients_llm)
 */
export async function geminiRag(
  prompt: string,
  k: number = 5,
  translate: boolean = true,
  filters?: any
): Promise<{
  ok: boolean;
  steps: {
    nlp: any;
    searchPayload: any;
    searchStats: {
      count: number;
      responseTime?: number;
      filterSummary?: any;
      searchMethod?: string;
    };
  };
  recipes: any[];
  translations: Record<string, { title_de: string; summary_de: string; instructions_full_de: string }>;
  answer_text: string;
  error?: string;
}> {
  const res = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.geminiRag}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, k, translate, filters }), // ✅ filters mitschicken
  });

  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data?.error ?? "Gemini RAG fehlgeschlagen");
  }

  return data;
}
