# SoupMate Backend Setup Guide

Diese Anleitung hilft dir, dein eigenes Backend für SoupMate in deiner IDE (z.B. IntelliJ) zu konfigurieren.

## 📋 Übersicht

SoupMate benötigt ein Backend mit folgenden Endpoints:
- **POST** `/api/search` - Rezeptsuche mit Gemini AI
- **GET** `/api/favorites/:userName` - Favoriten laden
- **POST** `/api/favorites` - Favorit hinzufügen
- **DELETE** `/api/favorites` - Favorit entfernen
- **GET** `/api/health` - Health Check

## 🔧 Konfiguration

### 1. Frontend-Konfiguration

Öffne die Datei `/config.tsx` und passe die Werte an:

```typescript
export const API_CONFIG = {
  // Ändere diese URL zu deiner Backend-URL
  baseUrl: "http://localhost:3000",  // <- Passe dies an
  
  endpoints: {
    search: "/api/search",
    favorites: "/api/favorites",
    health: "/api/health"
  }
};

// Setze auf false, wenn dein Backend läuft
export const DEV_MODE = {
  useMockData: false, // true = Mock-Daten, false = echtes Backend
  mockDelay: 1000
};
```

**Wichtig:** 
- Für Mock-Modus: `useMockData: true` (Standard, kein Backend nötig)
- Für Produktiv-Modus: `useMockData: false` und passe `baseUrl` an

### 2. Umgebungsvariablen (nur für Backend)

Erstelle eine `.env` Datei in deinem Backend-Projekt:

```env
# Gemini AI API Key (erforderlich für Rezeptsuche)
GEMINI_API_KEY=your_gemini_api_key_here

# Server Port
PORT=3000

# Optional: Supabase Credentials (nur wenn du Supabase verwendest)
SUPABASE_URL=https://brssalvqnbxgaiwmycpf.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_DB_URL=your_db_connection_string
```

**⚠️ Wichtig:** Der Gemini API Key gehört NUR ins Backend, niemals ins Frontend!

## 📝 API Endpoints Spezifikation

### 1. POST /api/search

Sucht nach Rezepten basierend auf dem Query und den Filtern.

**Request Body:**
```json
{
  "query": "Pasta",
  "filters": {
    "dietType": "vegetarisch",    // "vegan" | "vegetarisch" | "alle"
    "difficulty": 2,               // 0-5 (0 = alle)
    "workTime": [0, 120],          // [min, max] in Minuten
    "totalTime": [0, 240],         // [min, max] in Minuten
    "allergies": ["Gluten", "Laktose"],  // Array von Allergenen zum Ausschließen
    "ingredients": "Tomaten, Basilikum", // Verfügbare Zutaten (kommasepariert)
    "servings": 4                  // Anzahl Portionen
  }
}
```

**Response:**
```json
{
  "recipes": [
    {
      "id": "unique-id",
      "name": "Pasta Primavera",
      "description": "Kurze Beschreibung",
      "difficulty": 2,
      "workTime": 15,
      "totalTime": 25,
      "servings": 4,
      "ingredients": ["400g Pasta", "200g Tomaten", "..."],
      "instructions": ["Schritt 1", "Schritt 2", "..."],
      "isVegan": false,
      "isVegetarian": true,
      "allergens": ["Gluten"]
    }
  ],
  "query": "Pasta",
  "filters": { /* ... */ }
}
```

**Gemini AI Integration:**
```javascript
// Beispiel für Gemini API Aufruf
const prompt = buildPromptFromFilters(query, filters);

const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }]
    })
  }
);

const data = await response.json();
const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
const recipes = JSON.parse(aiResponse.replace(/```json\n?/g, "").replace(/```\n?/g, ""));
```

### 2. GET /api/favorites/:userName

Lädt alle Favoriten eines Benutzers.

**Response:**
```json
{
  "favorites": [
    {
      "id": "recipe-1",
      "name": "Tomatensuppe",
      "difficulty": 2,
      "diet": "vegetarisch"
    }
  ]
}
```

### 3. POST /api/favorites

Fügt ein Rezept zu den Favoriten hinzu.

**Request Body:**
```json
{
  "userName": "Max",
  "recipe": {
    "id": "recipe-1",
    "name": "Tomatensuppe",
    "difficulty": 2,
    "diet": "vegetarisch"
  }
}
```

**Response:**
```json
{
  "success": true,
  "favorites": [ /* aktualisierte Liste */ ]
}
```

### 4. DELETE /api/favorites

Entfernt ein Rezept aus den Favoriten.

**Request Body:**
```json
{
  "userName": "Max",
  "recipeId": "recipe-1"
}
```

**Response:**
```json
{
  "success": true,
  "favorites": [ /* aktualisierte Liste */ ]
}
```

## 🗄️ Datenbank Schema

### Tabelle: favorites (Beispiel)

```sql
CREATE TABLE favorites (
  id SERIAL PRIMARY KEY,
  user_name VARCHAR(255) NOT NULL,
  recipe_id VARCHAR(255) NOT NULL,
  recipe_name VARCHAR(255) NOT NULL,
  recipe_difficulty INTEGER NOT NULL,
  recipe_diet VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_name, recipe_id)
);
```

### Tabelle: search_history (Optional)

```sql
CREATE TABLE search_history (
  id SERIAL PRIMARY KEY,
  query TEXT NOT NULL,
  filters JSONB,
  results JSONB,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🚀 Backend Implementierung (Beispiele)

### Node.js + Express Beispiel

```javascript
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Search Endpoint
app.post('/api/search', async (req, res) => {
  const { query, filters } = req.body;
  
  try {
    // Baue Prompt für Gemini
    const prompt = buildPrompt(query, filters);
    
    // Rufe Gemini API auf
    const recipes = await callGeminiAPI(prompt);
    
    // Speichere optional in Datenbank
    // await saveSearchHistory(query, filters, recipes);
    
    res.json({ recipes, query, filters });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed', details: error.message });
  }
});

// Favorites Endpoints
app.get('/api/favorites/:userName', async (req, res) => {
  const { userName } = req.params;
  const favorites = await getFavoritesFromDB(userName);
  res.json({ favorites });
});

app.post('/api/favorites', async (req, res) => {
  const { userName, recipe } = req.body;
  const favorites = await addFavoriteToDB(userName, recipe);
  res.json({ success: true, favorites });
});

app.delete('/api/favorites', async (req, res) => {
  const { userName, recipeId } = req.body;
  const favorites = await removeFavoriteFromDB(userName, recipeId);
  res.json({ success: true, favorites });
});

app.listen(3000, () => {
  console.log('SoupMate Backend running on port 3000');
});
```

### Java Spring Boot Beispiel

```java
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class RecipeController {
    
    @Autowired
    private GeminiService geminiService;
    
    @Autowired
    private FavoriteRepository favoriteRepository;
    
    @PostMapping("/search")
    public ResponseEntity<SearchResponse> search(@RequestBody SearchRequest request) {
        try {
            String prompt = buildPrompt(request.getQuery(), request.getFilters());
            List<Recipe> recipes = geminiService.generateRecipes(prompt);
            
            return ResponseEntity.ok(new SearchResponse(
                recipes, 
                request.getQuery(), 
                request.getFilters()
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(null);
        }
    }
    
    @GetMapping("/favorites/{userName}")
    public ResponseEntity<FavoritesResponse> getFavorites(@PathVariable String userName) {
        List<Recipe> favorites = favoriteRepository.findByUserName(userName);
        return ResponseEntity.ok(new FavoritesResponse(favorites));
    }
    
    @PostMapping("/favorites")
    public ResponseEntity<FavoritesResponse> addFavorite(@RequestBody AddFavoriteRequest request) {
        favoriteRepository.save(new Favorite(request.getUserName(), request.getRecipe()));
        List<Recipe> favorites = favoriteRepository.findByUserName(request.getUserName());
        return ResponseEntity.ok(new FavoritesResponse(favorites));
    }
    
    @DeleteMapping("/favorites")
    public ResponseEntity<FavoritesResponse> removeFavorite(@RequestBody RemoveFavoriteRequest request) {
        favoriteRepository.deleteByUserNameAndRecipeId(
            request.getUserName(), 
            request.getRecipeId()
        );
        List<Recipe> favorites = favoriteRepository.findByUserName(request.getUserName());
        return ResponseEntity.ok(new FavoritesResponse(favorites));
    }
}
```

## 📦 Referenz: Mitgeliefertes Supabase Backend

Im Ordner `/supabase/functions/server/` findest du eine vollständige Referenz-Implementierung mit:

- `index.tsx` - Hono Web Server mit allen Endpoints
- `kv_store.tsx` - Key-Value Store für Datenbank-Operationen

Diese Dateien kannst du als Vorlage für dein eigenes Backend verwenden.

## 🔑 Gemini API Key erhalten

1. Gehe zu [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Erstelle einen neuen API Key
3. Füge den Key in deine `.env` Datei ein

## ✅ Testing

### Mock-Modus (kein Backend erforderlich)

1. Setze in `/config.tsx`: `useMockData: true`
2. Die App verwendet lokale Mock-Daten
3. Favoriten werden in localStorage gespeichert
4. Perfekt zum Testen der UI

### Produktiv-Modus (mit eigenem Backend)

1. Starte dein Backend (z.B. `npm start` oder in IntelliJ)
2. Setze in `/config.tsx`: `useMockData: false`
3. Stelle sicher, dass `baseUrl` korrekt ist
4. Teste alle Endpoints mit Postman oder curl

## 🐛 Debugging Tipps

1. **CORS Fehler**: Stelle sicher, dass dein Backend CORS aktiviert hat
2. **404 Errors**: Prüfe die Endpoint-URLs in `/config.tsx`
3. **Gemini API**: Prüfe API Key und Quota
4. **Console Logs**: Öffne Browser DevTools → Console für Fehlermeldungen

## 📞 Support

Bei Fragen zur Backend-Integration:
- Prüfe die Referenz-Implementierung in `/supabase/functions/server/`
- Teste zuerst im Mock-Modus
- Verwende Browser DevTools zum Debuggen

Viel Erfolg mit deinem SoupMate Backend! 🍜
