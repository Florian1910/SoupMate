# 🔧 SoupMate Integration Guide

Diese Anleitung zeigt dir **genau**, wo du deine **API**, **Datenbank** und **Gemini-Verbindung** einbinden musst.

---

## 📍 Übersicht der Integration-Punkte

### 1️⃣ **GEMINI API-SCHLÜSSEL** (WICHTIGSTE ÄNDERUNG)
### 2️⃣ **DATENBANK-ANBINDUNG**
### 3️⃣ **EIGENE REZEPT-API** (Optional)
### 4️⃣ **KONFIGURATION**

---

## 1️⃣ GEMINI API-SCHLÜSSEL EINRICHTEN

### ✅ Der Gemini API-Schlüssel ist bereits integriert!

**Datei:** `/supabase/functions/server/index.tsx` (Zeile 100-103)

```tsx
const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
if (!geminiApiKey) {
  return c.json({ error: "Gemini API key not configured" }, 500);
}
```

### 🔑 So fügst du deinen API-Schlüssel hinzu:

**Option A: In IntelliJ (Empfohlen für lokale Entwicklung)**
1. Erstelle eine `.env` Datei im Root-Verzeichnis
2. Füge hinzu:
   ```
   GEMINI_API_KEY=dein_gemini_api_key_hier
   ```

**Option B: Für Supabase Deployment**
1. Gehe zu Supabase Dashboard → Project Settings → Edge Functions
2. Füge ein Secret hinzu:
   - Name: `GEMINI_API_KEY`
   - Value: Dein Gemini API Key

### 📍 Wo Gemini verwendet wird:
- **Datei:** `/supabase/functions/server/index.tsx`
- **Zeilen:** 100-221 (gesamter `/search` Endpoint)
- **Funktionalität:** Rezeptgenerierung mit KI basierend auf Suchbegriff und Filtern

---

## 2️⃣ DATENBANK-ANBINDUNG

### ✅ Die Supabase KV-Datenbank ist bereits integriert!

**Aktuelle Datenbank-Verwendung:**

#### A) **Favoriten speichern**
**Datei:** `/supabase/functions/server/index.tsx` (Zeilen 28-89)
```tsx
// Favoriten abrufen
app.get("/make-server-b187574e/favorites/:userName", async (c) => {
  const key = `favorites_${userName}`;
  const favorites = await kv.get(key);  // 👈 DATENBANK-ZUGRIFF
  return c.json({ favorites: favorites || [] });
});

// Favorit hinzufügen
app.post("/make-server-b187574e/favorites", async (c) => {
  const key = `favorites_${userName}`;
  await kv.set(key, favorites);  // 👈 DATENBANK-SCHREIBEN
});
```

#### B) **Suchverlauf speichern**
**Datei:** `/supabase/functions/server/index.tsx` (Zeilen 208-215)
```tsx
// Suchanfrage in Datenbank speichern
const searchKey = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
await kv.set(searchKey, {  // 👈 DATENBANK-SCHREIBEN
  query,
  filters,
  results: recipes,
  timestamp: new Date().toISOString()
});
```

### 🔄 DEINE EIGENE DATENBANK VERWENDEN (Optional)

Wenn du eine **PostgreSQL-Datenbank** oder **andere Datenbank** verwenden möchtest:

**Datei:** `/supabase/functions/server/index.tsx`

**SCHRITT 1: Importiere Supabase Client** (Füge ganz oben hinzu)
```tsx
import { createClient } from 'npm:@supabase/supabase-js@2';

// Erstelle Supabase Client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || 'https://brssalvqnbxgaiwmycpf.supabase.co',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'dein_service_role_key'
);
```

**SCHRITT 2: Ersetze KV-Store Aufrufe**

Beispiel für Favoriten:
```tsx
// ALT (KV-Store):
const favorites = await kv.get(key);

// NEU (PostgreSQL):
const { data: favorites, error } = await supabase
  .from('favorites')
  .select('*')
  .eq('user_name', userName);
```

---

## 3️⃣ EIGENE REZEPT-API EINBINDEN (Optional)

Falls du **bereits eine eigene Rezept-Datenbank** oder **externe API** hast:

### 📍 Markierung 1: Backend API Endpoint

**Datei:** `/supabase/functions/server/index.tsx` (Zeile 92-221)

**ERSETZE den gesamten `/search` Endpoint:**

```tsx
// ========================================================================
// 🔴 HIER: EIGENE REZEPT-API EINBINDEN
// ========================================================================
app.post("/make-server-b187574e/search", async (c) => {
  try {
    const { query, filters } = await c.req.json();
    
    // ❌ ALTE METHODE (Gemini AI):
    // const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    // const response = await fetch(`https://generativelanguage.googleapis.com/...`);
    
    // ✅ NEUE METHODE (Deine API):
    // --------------------------------------------------------------------
    // OPTION A: Externe API
    // --------------------------------------------------------------------
    const response = await fetch("https://deine-rezept-api.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("DEINE_API_KEY")}`  // 👈 DEIN API-KEY
      },
      body: JSON.stringify({ query, filters })
    });
    
    const data = await response.json();
    const recipes = data.recipes; // Array von Rezepten
    
    // --------------------------------------------------------------------
    // OPTION B: Eigene Datenbank (PostgreSQL/Supabase)
    // --------------------------------------------------------------------
    /*
    const { data: recipes, error } = await supabase
      .from('recipes')  // 👈 DEINE TABELLE
      .select('*')
      .ilike('name', `%${query}%`)  // Suche nach Name
      .limit(5);
    
    if (error) {
      console.log(`Database error: ${error}`);
      return c.json({ error: "Database query failed" }, 500);
    }
    */
    
    // --------------------------------------------------------------------
    // OPTION C: Gemini AI + Deine Datenbank (Hybrid)
    // --------------------------------------------------------------------
    /*
    // 1. Frage Gemini nach Rezeptvorschlägen
    const geminiRecipes = await callGeminiAPI(query, filters);
    
    // 2. Speichere die Rezepte in deiner Datenbank
    const { data, error } = await supabase
      .from('recipes')
      .insert(geminiRecipes);
    
    // 3. Gib die Rezepte zurück
    return c.json({ recipes: geminiRecipes });
    */
    
    return c.json({ recipes, query, filters });
  } catch (error) {
    console.log(`Error in search endpoint: ${error}`);
    return c.json({ error: "Search failed", details: String(error) }, 500);
  }
});
// ========================================================================
```

### 📍 Markierung 2: Frontend Mock-Modus deaktivieren

**Datei:** `/config.tsx` (Zeile 23-26)

```tsx
// ========================================================================
// 🔴 HIER: MOCK-MODUS DEAKTIVIEREN
// ========================================================================
export const DEV_MODE = {
  // ❌ ENTWICKLUNG (Mock-Daten):
  useMockData: true,
  
  // ✅ PRODUKTION (Echtes Backend):
  // useMockData: false,  // 👈 ÄNDERE zu false für echte API-Calls
  
  mockDelay: 1000
};
```

### 📍 Markierung 3: Backend URL konfigurieren

**Datei:** `/config.tsx` (Zeile 8-20)

```tsx
// ========================================================================
// 🔴 HIER: BACKEND-URL KONFIGURIEREN
// ========================================================================
export const API_CONFIG = {
  // Für Supabase Edge Functions (Standard):
  baseUrl: "https://brssalvqnbxgaiwmycpf.supabase.co/functions/v1",
  
  // Für lokale Entwicklung:
  // baseUrl: "http://localhost:54321/functions/v1",
  
  // Für deine eigene API:
  // baseUrl: "https://deine-api.com",  // 👈 ÄNDERE zu deiner URL
  
  endpoints: {
    search: "/make-server-b187574e/search",  // 👈 Oder "/api/search"
    favorites: "/make-server-b187574e/favorites",
    health: "/make-server-b187574e/health"
  }
};
```

---

## 4️⃣ SUPABASE CREDENTIALS KONFIGURIEREN

### Für IntelliJ / Lokale Entwicklung:

**Datei:** `/utils/supabase/info.tsx`

```tsx
// ========================================================================
// 🔴 HIER: DEINE SUPABASE CREDENTIALS
// ========================================================================
export const projectId = 'brssalvqnbxgaiwmycpf';  // 👈 DEINE PROJECT ID

export const publicAnonKey = 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyc3NhbHZxbmJ4Z2Fpd215Y3BmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNDk1NTMsImV4cCI6MjA3NjcyNTU1M30.zcf_KzS_CN6ThzKKDCj0iz9YqnSBkBwGFDIZipMC_xw';
  // 👈 DEIN ANON KEY
```

---

## 🎯 SCHNELLSTART-CHECKLISTE

### ✅ Für reine Gemini-Integration (Empfohlen):
- [ ] 1. Füge `GEMINI_API_KEY` in `.env` ein
- [ ] 2. Setze `useMockData: false` in `/config.tsx`
- [ ] 3. Teste die Suche

### ✅ Für eigene API-Integration:
- [ ] 1. Ersetze `/search` Endpoint in `/supabase/functions/server/index.tsx`
- [ ] 2. Ändere `baseUrl` in `/config.tsx`
- [ ] 3. Setze `useMockData: false` in `/config.tsx`
- [ ] 4. Füge deinen API-Key in `.env` ein

### ✅ Für Supabase + eigene Datenbank:
- [ ] 1. Erstelle Tabelle `recipes` in Supabase
- [ ] 2. Importiere Supabase Client in `/supabase/functions/server/index.tsx`
- [ ] 3. Ersetze `kv.get()` Aufrufe mit `supabase.from('recipes').select()`

---

## 📚 WICHTIGE DATEIEN-ÜBERSICHT

| Datei | Zweck | Was ändern? |
|-------|-------|-------------|
| `/supabase/functions/server/index.tsx` | **Backend API** | Gemini-Integration, Datenbank-Zugriff |
| `/config.tsx` | **Konfiguration** | API-URL, Mock-Modus |
| `/utils/supabase/info.tsx` | **Supabase Credentials** | Project ID, API Keys |
| `/components/SearchBar.tsx` | **Frontend** | (Normalerweise keine Änderung nötig) |
| `.env` | **Umgebungsvariablen** | API-Keys (GEMINI_API_KEY) |

---

## 🔍 DETAILLIERTE CODE-ABSCHNITTE

### 🟢 Gemini API Call (bereits implementiert)

**Datei:** `/supabase/functions/server/index.tsx` (Zeilen 165-181)

```tsx
// ========================================================================
// 🟢 GEMINI API WIRD HIER AUFGERUFEN
// ========================================================================
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt  // 👈 Prompt mit Suchbegriff + Filtern
        }]
      }]
    })
  }
);
```

### 🟡 Datenbank-Zugriff (bereits implementiert)

**Datei:** `/supabase/functions/server/index.tsx` (Zeile 4)

```tsx
// ========================================================================
// 🟡 DATENBANK-IMPORT
// ========================================================================
import * as kv from "./kv_store.tsx";  // 👈 KV-Store für Supabase

// Verwendung:
// await kv.get(key)      // Daten abrufen
// await kv.set(key, val) // Daten speichern
// await kv.del(key)      // Daten löschen
```

### 🔴 Rezept-Datenformat (WICHTIG für eigene API!)

Deine API muss Rezepte in diesem Format zurückgeben:

```tsx
// ========================================================================
// 🔴 REZEPT-DATENFORMAT (MUSS EINGEHALTEN WERDEN!)
// ========================================================================
{
  "recipes": [
    {
      "id": "eindeutige-id",
      "name": "Rezeptname",
      "description": "Kurze Beschreibung (2-3 Sätze)",
      "fullDescription": "Ausführliche Beschreibung (optional)",
      "difficulty": 1-5,  // Schwierigkeit in Sternen
      "workTime": 15,     // Arbeitszeit in Minuten (Zahl)
      "totalTime": 30,    // Gesamtzeit in Minuten (Zahl)
      "servings": 4,      // Anzahl Portionen (Zahl)
      "ingredients": [
        "400g Tomaten",
        "200ml Sahne",
        // ...
      ],
      "instructions": [
        "Schritt 1: ...",
        "Schritt 2: ...",
        // ...
      ],
      "isVegan": false,
      "isVegetarian": true,
      "allergens": ["Laktose", "Gluten"]  // Optional
    }
    // ... weitere Rezepte (maximal 5)
  ]
}
```

---

## 🚀 DEPLOYMENT-SCHRITTE

### Für Supabase Edge Functions:

1. **Installiere Supabase CLI:**
   ```bash
   npm install -g supabase
   ```

2. **Login:**
   ```bash
   supabase login
   ```

3. **Link zu deinem Projekt:**
   ```bash
   supabase link --project-ref brssalvqnbxgaiwmycpf
   ```

4. **Setze Secrets:**
   ```bash
   supabase secrets set GEMINI_API_KEY=dein_api_key_hier
   ```

5. **Deploy:**
   ```bash
   supabase functions deploy server
   ```

### Für IntelliJ (Lokale Entwicklung):

1. **Erstelle `.env` Datei:**
   ```
   GEMINI_API_KEY=dein_api_key_hier
   SUPABASE_URL=https://brssalvqnbxgaiwmycpf.supabase.co
   SUPABASE_ANON_KEY=dein_anon_key_hier
   SUPABASE_SERVICE_ROLE_KEY=dein_service_role_key_hier
   ```

2. **Starte Supabase lokal:**
   ```bash
   supabase start
   ```

3. **Teste Edge Function lokal:**
   ```bash
   supabase functions serve server
   ```

---

## ❓ FAQ

**Q: Brauche ich zwingend Gemini?**
A: Nein! Du kannst auch deine eigene Rezept-API verwenden. Siehe Markierung 1.

**Q: Kann ich eine andere Datenbank als Supabase verwenden?**
A: Ja! Siehe Markierung im Abschnitt "DEINE EIGENE DATENBANK VERWENDEN".

**Q: Wo finde ich meinen Gemini API Key?**
A: https://aistudio.google.com/app/apikey

**Q: Wie teste ich, ob alles funktioniert?**
A: Setze `useMockData: false` in `/config.tsx` und führe eine Suche durch.

---

## 📞 SUPPORT

Bei Fragen zum Code:
- Prüfe `/BACKEND_SETUP.md`
- Prüfe `/deployment-guide.md`
- Schaue in `/QUICKSTART.md`

**Viel Erfolg mit deiner SoupMate-Integration! 🍲🧡**
