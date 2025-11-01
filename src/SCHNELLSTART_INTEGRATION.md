# ⚡ SoupMate Schnellstart Integration

## 🎯 3 Schritte zur fertigen App

### ✅ Schritt 1: Gemini API-Schlüssel einrichten (5 Minuten)

1. **Hole deinen API-Key:**
   - Gehe zu: https://aistudio.google.com/app/apikey
   - Klicke auf "Create API Key"
   - Kopiere den Key

2. **Füge den Key ein:**
   - Kopiere `env.example` zu `.env`
   - Öffne `.env`
   - Ersetze `your_gemini_api_key_here` mit deinem echten Key

   ```bash
   # In .env:
   GEMINI_API_KEY=AIzaSyD...dein_echter_key_hier
   ```

### ✅ Schritt 2: Mock-Modus deaktivieren (1 Minute)

Öffne `/config.tsx` und ändere:

```tsx
// VORHER:
useMockData: true,

// NACHHER:
useMockData: false,  // 👈 Jetzt wird echte API verwendet!
```

### ✅ Schritt 3: Supabase Edge Function deployen (5 Minuten)

```bash
# 1. Supabase CLI installieren
npm install -g supabase

# 2. Login
supabase login

# 3. Mit deinem Projekt verbinden
supabase link --project-ref brssalvqnbxgaiwmycpf

# 4. Gemini API-Key als Secret setzen
supabase secrets set GEMINI_API_KEY=dein_key_hier

# 5. Backend deployen
supabase functions deploy server
```

### ✅ Fertig! 🎉

Teste die App:
1. Öffne die App in deinem Browser
2. Gib einen Suchbegriff ein (z.B. "Tomatensuppe")
3. Die App sollte jetzt **echte KI-generierte Rezepte** anzeigen!

---

## 📍 Wo ist was?

| Was ändern? | Datei | Zeile(n) |
|-------------|-------|----------|
| 🔴 **Gemini API-Key** | `.env` | Zeile 14 |
| 🔴 **Mock-Modus aus** | `/config.tsx` | Zeile 30 |
| 🟢 **Gemini API-Call** | `/supabase/functions/server/index.tsx` | Zeile 165-197 |
| 🟡 **Datenbank** | `/supabase/functions/server/index.tsx` | Zeile 4, 32, 60 |
| 🟡 **Supabase Credentials** | `/utils/supabase/info.tsx` | Zeile 13-16 |

---

## 🔧 Code-Markierungen im Detail

### 1. **GEMINI API-SCHLÜSSEL**

**Datei:** `/supabase/functions/server/index.tsx`

```tsx
// Zeile 100-103
// 🟢 GEMINI API-SCHLÜSSEL (aus Umgebungsvariablen)
const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
if (!geminiApiKey) {
  return c.json({ error: "Gemini API key not configured" }, 500);
}
```

**Hier wird der API-Key geladen.** Stelle sicher, dass er in `.env` gesetzt ist!

---

### 2. **GEMINI API-AUFRUF**

**Datei:** `/supabase/functions/server/index.tsx`

```tsx
// Zeile 165-197
// 🟢 GEMINI API AUFRUF
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
          text: prompt  // Suchbegriff + Filter
        }]
      }]
    })
  }
);
```

**HIER wird Gemini aufgerufen.** Wenn du eine **eigene API** verwenden möchtest, ersetze diesen Block!

**Beispiel für eigene API:**
```tsx
const response = await fetch("https://deine-api.com/search", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${Deno.env.get("DEINE_API_KEY")}`
  },
  body: JSON.stringify({ query, filters })
});
```

---

### 3. **DATENBANK-ANBINDUNG**

**Datei:** `/supabase/functions/server/index.tsx`

```tsx
// Zeile 4
// 🟡 DATENBANK-IMPORT
import * as kv from "./kv_store.tsx";  // Key-Value Store
```

**Verwendung im Code:**
```tsx
// Favoriten laden (Zeile 39)
const favorites = await kv.get(key);

// Favoriten speichern (Zeile 60)
await kv.set(key, favorites);

// Suchverlauf speichern (Zeile 228)
await kv.set(searchKey, { query, filters, results, timestamp });
```

**Eigene Datenbank verwenden (PostgreSQL):**
```tsx
// Füge am Anfang hinzu:
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
);

// Dann ersetze kv.get() mit:
const { data: favorites } = await supabase
  .from('favorites')
  .select('*')
  .eq('user_name', userName);
```

---

### 4. **KONFIGURATION**

**Datei:** `/config.tsx`

```tsx
// Zeile 14-22
// 🔴 BACKEND-URL
export const API_CONFIG = {
  // Für Supabase (Standard):
  baseUrl: "https://brssalvqnbxgaiwmycpf.supabase.co/functions/v1",
  
  // Für eigene API:
  // baseUrl: "https://deine-api.com",
};

// Zeile 30
// 🔴 MOCK-MODUS
useMockData: false,  // false = echte API verwenden!
```

---

### 5. **SUPABASE CREDENTIALS**

**Datei:** `/utils/supabase/info.tsx`

```tsx
// Zeile 13-16
// 🔴 DEINE SUPABASE CREDENTIALS
export const projectId = "brssalvqnbxgaiwmycpf"  // Deine Project ID

export const publicAnonKey = 
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."  // Dein Anon Key
```

---

## 🔄 Datenfluss (Wie alles zusammenhängt)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. BENUTZER SUCHT                                           │
│    "Tomatensuppe"                                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. FRONTEND (/components/SearchBar.tsx)                    │
│    - Sammelt Suchbegriff + Filter                          │
│    - Sendet POST-Request an Backend                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. BACKEND (/supabase/functions/server/index.tsx)          │
│    - Empfängt Request                                       │
│    - Lädt GEMINI_API_KEY aus .env 🔴                       │
│    - Baut Prompt mit Filtern                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. GEMINI API 🤖                                            │
│    - Erhält Prompt                                          │
│    - Generiert 3-5 Rezepte                                 │
│    - Gibt JSON zurück                                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. BACKEND                                                  │
│    - Parsed JSON                                            │
│    - Speichert in Datenbank 🟡                             │
│    - Sendet Rezepte an Frontend                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. FRONTEND (/components/RecipeResults.tsx)                │
│    - Zeigt Rezept-Karten an                                │
│    - Benutzer kann Karte aufklappen                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🆘 Fehlersuche

### Problem: "Gemini API key not configured"
**Lösung:**
- Prüfe, ob `.env` Datei existiert (nicht `env.example`!)
- Prüfe, ob `GEMINI_API_KEY` in `.env` gesetzt ist
- Für Supabase: `supabase secrets set GEMINI_API_KEY=dein_key`

### Problem: Nur Mock-Daten werden angezeigt
**Lösung:**
- Öffne `/config.tsx`
- Setze `useMockData: false`

### Problem: "Failed to fetch"
**Lösung:**
- Prüfe `baseUrl` in `/config.tsx`
- Prüfe, ob Backend deployed ist: `supabase functions deploy server`
- Prüfe Console für Fehler

### Problem: Keine Rezepte werden zurückgegeben
**Lösung:**
- Öffne Browser Console (F12)
- Schaue nach Fehler-Logs
- Prüfe Supabase Logs: Supabase Dashboard → Edge Functions → Logs

---

## 📖 Weitere Hilfe

- **Detaillierte Integration:** `/INTEGRATION_GUIDE.md`
- **Backend Setup:** `/BACKEND_SETUP.md`
- **Deployment:** `/deployment-guide.md`
- **Gemini API Docs:** https://ai.google.dev/gemini-api/docs

---

## ✨ Das war's!

Du hast jetzt:
- ✅ Gemini AI integriert
- ✅ Supabase Datenbank verbunden
- ✅ Backend deployed
- ✅ Alle Code-Stellen markiert bekommen

**Viel Erfolg mit SoupMate! 🍲🧡**
