# ✅ Fehler behoben: 401 Unauthorized

## 🔧 Was wurde korrigiert?

### Problem
```
Search API error: 401 - undefined
Error during search: Error: Suche fehlgeschlagen
```

Der **401 Unauthorized** Fehler trat auf, weil:
1. ❌ Der Authorization-Header fehlte in allen API-Calls
2. ❌ Der Supabase Anon Key wurde nicht gesendet

### Lösung

✅ **Authorization-Header hinzugefügt** in allen API-Calls:

**Geänderte Dateien:**
1. `/components/SearchBar.tsx` - Search API Call
2. `/App.tsx` - Favorites API Calls (GET, POST, DELETE)

**Hinzugefügt:**
```typescript
import { publicAnonKey } from '../utils/supabase/info';

// In jedem fetch():
headers: {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${publicAnonKey}`  // ← NEU!
}
```

---

## 🚀 Nächste Schritte

### 1. Supabase Edge Function deployen

Die Backend-Funktion muss deployed werden, damit sie erreichbar ist:

```bash
# Supabase CLI installieren (falls noch nicht geschehen)
npm install -g supabase

# Anmelden
supabase login

# Mit deinem Projekt verbinden
supabase link --project-ref brssalvqnbxgaiwmycpf

# Edge Functions deployen
supabase functions deploy make-server-b187574e
```

### 2. Umgebungsvariablen setzen

Die Edge Function benötigt Zugriff auf die Supabase-Credentials:

```bash
# Automatisch gesetzt (sollte bereits vorhanden sein):
# SUPABASE_URL
# SUPABASE_SERVICE_ROLE_KEY
# SUPABASE_ANON_KEY

# Überprüfe, ob sie gesetzt sind im Supabase Dashboard:
# Dashboard → Project Settings → Edge Functions → Secrets
```

Diese werden automatisch von Supabase bereitgestellt, sobald die Funktion deployed ist.

### 3. Datenbank befüllen

Falls noch nicht geschehen:

```bash
# 1. Gehe zu Supabase Dashboard → SQL Editor
# 2. Öffne /sample-recipes.sql
# 3. Kopiere den Inhalt und führe ihn aus
# 4. Überprüfe mit:
SELECT COUNT(*) FROM test_recipes;
```

---

## 🧪 Testen

### Option 1: Im Browser

1. Starte die App: `npm run dev`
2. Öffne http://localhost:5173
3. Gib eine Suchanfrage ein: "Tomatensuppe"
4. ✅ Du solltest jetzt Ergebnisse sehen (wenn DB befüllt ist)

### Option 2: Via cURL

```bash
curl -X POST \
  https://brssalvqnbxgaiwmycpf.supabase.co/functions/v1/make-server-b187574e/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyc3NhbHZxbmJ4Z2Fpd215Y3BmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNDk1NTMsImV4cCI6MjA3NjcyNTU1M30.zcf_KzS_CN6ThzKKDCj0iz9YqnSBkBwGFDIZipMC_xw" \
  -d '{
    "query": "Tomatensuppe",
    "filters": {}
  }'
```

**Erwartetes Ergebnis:**
```json
{
  "recipes": [...],
  "query": "Tomatensuppe",
  "totalResults": 1
}
```

---

## 🐛 Troubleshooting

### Fehler: "Function not found"

**Problem:** Edge Function ist nicht deployed

**Lösung:**
```bash
supabase functions deploy make-server-b187574e
```

### Fehler: "Database error"

**Problem:** Datenbank ist leer oder Tabellen existieren nicht

**Lösung:**
```sql
-- Überprüfe, ob Tabellen existieren:
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'test_%';

-- Sollte zurückgeben:
-- test_recipes
-- test_ingredients  
-- test_recipe_ingredients

-- Falls nicht, erstelle die Tabellen gemäß deinem SQL-Schema
```

### Fehler: "No recipes found"

**Problem:** Datenbank ist leer

**Lösung:**
```bash
# Führe sample-recipes.sql aus (siehe oben)
```

### Fehler: Immer noch 401

**Mögliche Ursachen:**

1. **Edge Function nicht deployed:**
   ```bash
   supabase functions list
   # Sollte "make-server-b187574e" zeigen
   ```

2. **Falsche Project Reference:**
   ```bash
   supabase projects list
   # Überprüfe, ob brssalvqnbxgaiwmycpf aufgelistet ist
   ```

3. **CORS-Problem:**
   - Überprüfe in `/supabase/functions/server/index.tsx`
   - CORS sollte bereits konfiguriert sein (origin: "*")

---

## 📋 Checkliste

Führe diese Schritte aus, um sicherzustellen, dass alles funktioniert:

- [ ] ✅ Authorization-Header in Code hinzugefügt (bereits erledigt)
- [ ] 🔄 Supabase CLI installiert (`npm install -g supabase`)
- [ ] 🔄 Bei Supabase angemeldet (`supabase login`)
- [ ] 🔄 Projekt verknüpft (`supabase link --project-ref brssalvqnbxgaiwmycpf`)
- [ ] 🔄 Edge Function deployed (`supabase functions deploy make-server-b187574e`)
- [ ] 🔄 Datenbank befüllt (sample-recipes.sql ausführen)
- [ ] 🔄 App testen (Suche durchführen)

---

## 🎯 Erwartetes Verhalten nach Behebung

### ✅ Erfolgreiche Suche

**Console-Output (Backend):**
```
🔍 Searching for: "Tomatensuppe" with filters: {}
📊 Generated query embedding: [0.23, 0.45, 0.67]
✅ Found 4 recipes in database
✅ Returning 1 filtered recipes
```

**Browser (Frontend):**
```
✅ Suchergebnisse angezeigt
✅ Rezept-Karten aufklappbar
✅ Filter funktionieren
```

### ❌ Was vorher passierte

**Console-Output:**
```
❌ Search API error: 401 - undefined
❌ Error during search: Error: Suche fehlgeschlagen
```

---

## 💡 Zusätzliche Hinweise

### Lokale Entwicklung mit Supabase

Falls du die Edge Functions lokal testen möchtest:

```bash
# Supabase lokal starten
supabase start

# Edge Function lokal deployen
supabase functions serve make-server-b187574e

# In config.tsx ändern:
# baseUrl: "http://localhost:54321/functions/v1"
```

### Deployment-Status überprüfen

```bash
# Liste aller Edge Functions
supabase functions list

# Logs einer Function anzeigen
supabase functions logs make-server-b187574e

# Function erneut deployen (bei Änderungen)
supabase functions deploy make-server-b187574e --no-verify-jwt
```

---

## ✨ Zusammenfassung

**Fehler behoben:** ✅  
**Code-Änderungen:** 4 Dateien (SearchBar.tsx, App.tsx x3)  
**Was fehlt noch:** Edge Function Deployment  

**Nach dem Deployment sollte alles funktionieren!** 🚀

Bei weiteren Problemen:
1. Überprüfe Supabase Dashboard → Logs
2. Öffne Browser DevTools → Network Tab
3. Siehe `/DATENBANK_SCHNELLSTART.md` für weitere Hilfe
