# 🎯 SoupMate - Code-Markierungen Übersicht

Diese Datei zeigt dir **genau**, wo du **welche** Änderungen vornehmen musst.

---

## 📁 Datei-Übersicht mit Markierungen

```
📦 SoupMate Project
│
├── 🔴 .env                              ⬅️ GEMINI_API_KEY HIER!
├── 🔴 config.tsx                        ⬅️ MOCK-MODUS AUS, API-URL
├── 🔴 utils/supabase/info.tsx           ⬅️ SUPABASE CREDENTIALS
│
├── 🟢 supabase/functions/server/
│   └── 🟢 index.tsx                     ⬅️ BACKEND-LOGIK (Gemini + DB)
│
└── components/
    └── SearchBar.tsx                    ℹ️ (keine Änderung nötig)
```

---

## 🔴 PRIORITÄT 1: Gemini API-Schlüssel

### Datei: `.env` (erstelle aus `env.example`)

**Zeile 14:**
```bash
# ========================================================================
# 🔴 WICHTIGSTE ÄNDERUNG!
# ========================================================================
GEMINI_API_KEY=dein_echter_api_key_hier  # 👈 HIER EINFÜGEN!
```

**Wo bekommst du den Key?**
👉 https://aistudio.google.com/app/apikey

**Für Supabase Deployment:**
```bash
supabase secrets set GEMINI_API_KEY=dein_key
```

---

## 🔴 PRIORITÄT 2: Mock-Modus deaktivieren

### Datei: `/config.tsx`

**Zeile 30:**
```tsx
// ========================================================================
// 🔴 ÄNDERE DIES FÜR PRODUKTION!
// ========================================================================
export const DEV_MODE = {
  useMockData: false,  // 👈 false = echte API verwenden!
  mockDelay: 1000
};
```

**Zeile 14:**
```tsx
// ========================================================================
// 🔴 BACKEND-URL PRÜFEN/ÄNDERN
// ========================================================================
export const API_CONFIG = {
  // Für Supabase (Standard):
  baseUrl: "https://brssalvqnbxgaiwmycpf.supabase.co/functions/v1",
  
  // Für eigene API:
  // baseUrl: "https://deine-api.com",  // 👈 Hier deine URL einfügen
};
```

---

## 🟢 GEMINI API-INTEGRATION (Bereits implementiert!)

### Datei: `/supabase/functions/server/index.tsx`

#### 🟢 Markierung 1: Gemini API-Key laden

**Zeile 100-103:**
```tsx
// ========================================================================
// 🟢 GEMINI API-SCHLÜSSEL (aus Umgebungsvariablen)
// ========================================================================
const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
if (!geminiApiKey) {
  return c.json({ error: "Gemini API key not configured" }, 500);
}
```

#### 🟢 Markierung 2: Gemini API aufrufen

**Zeile 165-197:**
```tsx
// ========================================================================
// 🟢 GEMINI API AUFRUF
// ========================================================================
// HIER wird die Gemini API aufgerufen, um Rezepte zu generieren
//
// Um EIGENE API zu verwenden, ERSETZE diesen Block:
// ========================================================================
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  }
);

// ========================================================================
// EIGENE API? Ersetze mit:
// ========================================================================
/*
const response = await fetch("https://deine-api.com/search", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${Deno.env.get("DEINE_API_KEY")}`
  },
  body: JSON.stringify({ query, filters })
});
*/
```

---

## 🟡 DATENBANK-INTEGRATION

### Datei: `/supabase/functions/server/index.tsx`

#### 🟡 Markierung 1: Datenbank-Import

**Zeile 4-18:**
```tsx
// ========================================================================
// 🟡 DATENBANK-IMPORT (Supabase KV-Store)
// ========================================================================
// AKTUELL: Key-Value Store für einfache Daten
// OPTIONAL: Füge PostgreSQL hinzu mit:
// ========================================================================
import * as kv from "./kv_store.tsx";

// ========================================================================
// PostgreSQL verwenden? Füge hinzu:
// ========================================================================
/*
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
);
*/
```

#### 🟡 Markierung 2: Favoriten aus Datenbank laden

**Zeile 28-47:**
```tsx
// ========================================================================
// 🟡 DATENBANK: FAVORITEN ABRUFEN
// ========================================================================
app.get("/make-server-b187574e/favorites/:userName", async (c) => {
  const key = `favorites_${userName}`;
  
  // 🟡 Datenbank-Zugriff (KV-Store)
  const favorites = await kv.get(key);
  
  // ========================================================================
  // OPTIONAL: PostgreSQL verwenden
  // ========================================================================
  /*
  const { data: favorites, error } = await supabase
    .from('favorites')
    .select('*')
    .eq('user_name', userName);
  */
  
  return c.json({ favorites: favorites || [] });
});
```

#### 🟡 Markierung 3: Suchverlauf in Datenbank speichern

**Zeile 208-230:**
```tsx
// ========================================================================
// 🟡 DATENBANK: SUCHVERLAUF SPEICHERN
// ========================================================================
const searchKey = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// 🟡 KV-Store verwenden (aktuell)
await kv.set(searchKey, {
  query,
  filters,
  results: recipes,
  timestamp: new Date().toISOString()
});

// ========================================================================
// OPTIONAL: PostgreSQL verwenden
// ========================================================================
/*
const { error } = await supabase
  .from('search_history')
  .insert({
    query,
    filters,
    results: recipes,
    timestamp: new Date().toISOString()
  });
*/
```

---

## 🟡 SUPABASE CREDENTIALS

### Datei: `/utils/supabase/info.tsx`

**Zeile 13-16:**
```tsx
// ========================================================================
// 🔴 HIER: DEINE SUPABASE CREDENTIALS EINFÜGEN
// ========================================================================

// 👇 DEINE Project ID
export const projectId = "brssalvqnbxgaiwmycpf"

// 👇 DEIN Anon Public Key
export const publicAnonKey = 
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyc3NhbHZxbmJ4Z2Fpd215Y3BmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNDk1NTMsImV4cCI6MjA3NjcyNTU1M30.zcf_KzS_CN6ThzKKDCj0iz9YqnSBkBwGFDIZipMC_xw"
```

---

## 📋 Rezept-Datenformat (WICHTIG!)

### Deine API muss Rezepte in diesem Format zurückgeben:

```json
{
  "recipes": [
    {
      "id": "eindeutige-id",
      "name": "Rezeptname",
      "description": "Kurze Beschreibung (2-3 Sätze)",
      "fullDescription": "Ausführliche Beschreibung (optional)",
      "difficulty": 1,
      "workTime": 15,
      "totalTime": 30,
      "servings": 4,
      "ingredients": [
        "400g Tomaten",
        "200ml Sahne"
      ],
      "instructions": [
        "Schritt 1: Zwiebeln schneiden",
        "Schritt 2: In Topf anbraten"
      ],
      "isVegan": false,
      "isVegetarian": true,
      "allergens": ["Laktose", "Gluten"]
    }
  ]
}
```

**Wo wird das Format verwendet?**
- **Backend parst es:** `/supabase/functions/server/index.tsx` (Zeile 198-206)
- **Frontend zeigt es an:** `/components/RecipeResults.tsx`

---

## 🔄 Integration-Szenarien

### ✅ Szenario 1: Nur Gemini verwenden (Empfohlen)

**Was ändern?**
1. `.env`: Füge `GEMINI_API_KEY` hinzu
2. `/config.tsx`: Setze `useMockData: false`

**Keine weiteren Änderungen nötig!** ✨

---

### ✅ Szenario 2: Eigene Rezept-API verwenden

**Datei:** `/supabase/functions/server/index.tsx`

**Ersetze Zeile 165-197 mit:**
```tsx
const response = await fetch("https://deine-api.com/search", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${Deno.env.get("DEINE_API_KEY")}`
  },
  body: JSON.stringify({ 
    query,      // Suchbegriff
    filters     // Filter (diet, difficulty, time, etc.)
  })
});

const data = await response.json();
const recipes = data.recipes;  // Muss im oben gezeigten Format sein!
```

**Zusätzlich:**
1. `.env`: Füge `DEINE_API_KEY=...` hinzu
2. `/config.tsx`: Ändere `baseUrl` zu deiner API-URL

---

### ✅ Szenario 3: PostgreSQL statt KV-Store

**Datei:** `/supabase/functions/server/index.tsx`

**Schritt 1:** Import hinzufügen (Zeile 4)
```tsx
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
);
```

**Schritt 2:** Ersetze alle `kv.get()` / `kv.set()` Aufrufe

**Favoriten laden (Zeile 39):**
```tsx
// ALT:
const favorites = await kv.get(key);

// NEU:
const { data: favorites } = await supabase
  .from('favorites')
  .select('*')
  .eq('user_name', userName);
```

**Favorit speichern (Zeile 60):**
```tsx
// ALT:
await kv.set(key, favorites);

// NEU:
await supabase
  .from('favorites')
  .insert({ user_name: userName, recipe });
```

---

### ✅ Szenario 4: Gemini + Eigene Datenbank (Hybrid)

**Workflow:**
1. Gemini generiert Rezepte (wie aktuell)
2. Speichere Rezepte in deiner Datenbank
3. Beim nächsten Mal: Lade aus Datenbank, falls vorhanden

**Code-Beispiel:**
```tsx
// 1. Gemini generiert Rezepte
const geminiResponse = await fetch(...);
const recipes = JSON.parse(geminiResponse);

// 2. Speichere in Datenbank
for (const recipe of recipes) {
  await supabase
    .from('recipes')
    .upsert({
      id: recipe.id,
      name: recipe.name,
      // ... weitere Felder
    });
}

// 3. Beim nächsten Mal: Suche zuerst in Datenbank
const { data: existingRecipes } = await supabase
  .from('recipes')
  .select('*')
  .ilike('name', `%${query}%`);

if (existingRecipes && existingRecipes.length > 0) {
  return c.json({ recipes: existingRecipes });
} else {
  // Rufe Gemini auf...
}
```

---

## 📊 Cheat Sheet: Alle Markierungen auf einen Blick

| Nr. | Emoji | Was? | Datei | Zeile | Aktion |
|-----|-------|------|-------|-------|--------|
| 1 | 🔴 | Gemini API-Key | `.env` | 14 | **Einfügen** |
| 2 | 🔴 | Mock-Modus | `/config.tsx` | 30 | **false setzen** |
| 3 | 🔴 | Backend-URL | `/config.tsx` | 14 | **Prüfen** |
| 4 | 🔴 | Supabase Credentials | `/utils/supabase/info.tsx` | 13-16 | **Prüfen** |
| 5 | 🟢 | Gemini API-Key laden | `/supabase/functions/server/index.tsx` | 100-103 | ℹ️ Bereits OK |
| 6 | 🟢 | Gemini API-Call | `/supabase/functions/server/index.tsx` | 165-197 | ℹ️ Bereits OK / Optional ersetzen |
| 7 | 🟡 | DB-Import | `/supabase/functions/server/index.tsx` | 4-18 | ℹ️ Bereits OK / Optional erweitern |
| 8 | 🟡 | Favoriten laden | `/supabase/functions/server/index.tsx` | 28-47 | ℹ️ Bereits OK / Optional ersetzen |
| 9 | 🟡 | Suchverlauf speichern | `/supabase/functions/server/index.tsx` | 208-230 | ℹ️ Bereits OK / Optional ersetzen |

**Legende:**
- 🔴 = **Muss geändert werden**
- 🟢 = Gemini-Integration (bereits implementiert)
- 🟡 = Datenbank-Integration (bereits implementiert)
- ℹ️ = Optional / Bereits funktionsfähig

---

## 🚀 Deployment-Checkliste

### Für IntelliJ (Lokale Entwicklung):

- [ ] 1. Kopiere `env.example` zu `.env`
- [ ] 2. Fülle `GEMINI_API_KEY` in `.env` aus
- [ ] 3. Setze `useMockData: false` in `/config.tsx`
- [ ] 4. Prüfe `baseUrl` in `/config.tsx`
- [ ] 5. Installiere Supabase CLI: `npm install -g supabase`
- [ ] 6. Starte Supabase lokal: `supabase start`
- [ ] 7. Teste die App

### Für Supabase (Cloud Deployment):

- [ ] 1. Installiere Supabase CLI: `npm install -g supabase`
- [ ] 2. Login: `supabase login`
- [ ] 3. Link Projekt: `supabase link --project-ref brssalvqnbxgaiwmycpf`
- [ ] 4. Setze Secret: `supabase secrets set GEMINI_API_KEY=dein_key`
- [ ] 5. Deploy: `supabase functions deploy server`
- [ ] 6. Setze `useMockData: false` in `/config.tsx`
- [ ] 7. Prüfe `baseUrl` in `/config.tsx`
- [ ] 8. Teste die App

---

## 📞 Weitere Hilfe

- **Schnellstart:** `/SCHNELLSTART_INTEGRATION.md`
- **Detaillierte Anleitung:** `/INTEGRATION_GUIDE.md`
- **Backend Setup:** `/BACKEND_SETUP.md`
- **Deployment:** `/deployment-guide.md`

---

**Alle Code-Stellen sind jetzt markiert! 🎉**

Du findest in jedem relevanten File Kommentare mit:
- 🔴 = Hier musst du etwas ändern
- 🟢 = Gemini API Integration
- 🟡 = Datenbank Integration

**Viel Erfolg mit der Integration! 🍲🧡**
