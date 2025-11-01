/**
 * SoupMate Configuration File
 * 
 * Konfiguriere hier deine Backend-URLs für die eigene IDE/Deployment
 */

// ========================================================================
// 🔴 HIER: BACKEND-URL KONFIGURIEREN
// ========================================================================
export const API_CONFIG = {
  // ========================================================================
  // Option 1: Supabase Edge Functions (EMPFOHLEN für Deployment)
  // ========================================================================
  baseUrl: "https://brssalvqnbxgaiwmycpf.supabase.co/functions/v1",
  
  // ========================================================================
  // Option 2: Lokale Entwicklung mit Supabase CLI
  // ========================================================================
  // baseUrl: "http://localhost:54321/functions/v1",
  
  // ========================================================================
  // Option 3: Deine eigene Backend-API
  // ========================================================================
  // baseUrl: "https://deine-api.com",  // 👈 ERSETZE mit deiner URL
  // baseUrl: "http://localhost:3000",  // 👈 Für lokales Backend
  
  // API Endpoints
  endpoints: {
    search: "/make-server-b187574e/search",      // Für Supabase
    favorites: "/make-server-b187574e/favorites", // Für Supabase
    health: "/make-server-b187574e/health"        // Für Supabase
    
    // Für eigene API:
    // search: "/api/search",
    // favorites: "/api/favorites",
    // health: "/api/health"
  }
};

// ========================================================================
// 🔴 HIER: MOCK-MODUS EIN/AUS SCHALTEN
// ========================================================================
// Development Mode - Steuert, ob Mock-Daten oder echtes Backend verwendet wird
export const DEV_MODE = {
  // ========================================================================
  // true  = Mock-Daten (6 Test-Rezepte, kein Backend erforderlich)
  //         👉 EMPFOHLEN für erste Tests und UI-Entwicklung
  // 
  // false = Echtes Backend (Supabase Datenbank mit semantischer Suche)
  //         👉 Jetzt aktiviert für Produktion!
  // ========================================================================
  useMockData: false,  // ✅ Aktiviert für echte Datenbanksuche!
  
  // Simulierte API-Verzögerung in Millisekunden (nur für Mock-Modus)
  mockDelay: 1000
};
