// src/config.tsx
/**
 * SoupMate Configuration File
 */

export const API_CONFIG = {
  // 🔴 ÄNDERE DIESE ZEILE:
  baseUrl: "http://localhost:8000", // 👈 Dein lokaler Deno Server

  // API Endpoints - ENTFERNE den /make-server-b187574e Prefix
  endpoints: {
    search: "/search",      // Einfach /search
    favorites: "/favorites", // Einfach /favorites
    health: "/health",       // Einfach /health
    test: "/search/test",    // Einfach /search/test
    gemini: "/gemini",       // Gemini Chat Endpoints
    geminiPrepare: "/gemini/prepare", // NLP Vorbereitung
    geminiRag: "/gemini/rag" // Vollständiger RAG-Flow
  }
};

export const DEV_MODE = {
  useMockData: false,  // ✅ Echte Datenbanksuche aktiviert
  mockDelay: 1000
};

export const DEBUG_CONFIG = {
  enableLogs: true,
  logApiCalls: true,
  logSearchQueries: true
};