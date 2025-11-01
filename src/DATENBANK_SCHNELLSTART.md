# 🚀 Schnellstart: Datenbank-Integration

## ✅ Was wurde integriert?

Die SoupMate-Anwendung nutzt jetzt deine Supabase-Datenbank für **semantische Rezeptsuche** mit Embeddings!

---

## 📋 Checkliste für den Start

### 1️⃣ Datenbank mit Rezepten füllen

**Option A: SQL-Skript verwenden (Empfohlen für schnellen Start)**

1. Öffne dein [Supabase Dashboard](https://supabase.com/dashboard)
2. Wähle dein Projekt `brssalvqnbxgaiwmycpf`
3. Gehe zu **SQL Editor** (linkes Menü)
4. Klicke auf **"New Query"**
5. Kopiere den Inhalt von `/sample-recipes.sql` und füge ihn ein
6. Klicke auf **"Run"**
7. ✅ Du hast jetzt 4 Test-Rezepte in der Datenbank!

**Option B: Manuell über Table Editor**

1. Gehe zu **Table Editor** → **test_recipes**
2. Klicke auf **"Insert"** → **"Insert row"**
3. Fülle die Felder aus:
   - `name`: z.B. "Tomatensuppe"
   - `description`: Kurze Beschreibung
   - `instructions`: Zubereitungsschritte
   - `vegan`: true/false
   - `vegetarian`: true/false
   - `difficulty`: "easy", "medium" oder "hard"
   - `text_embedding`: `[0.1, 0.2, 0.3]`
   - `ingredients_embedding`: `[0.15, 0.25, 0.28]`
4. Wiederhole für `test_ingredients` und `test_recipe_ingredients`

---

### 2️⃣ Überprüfe die Datenbank-Verbindung

**Test via SQL Editor:**

```sql
-- Zeige alle Rezepte
SELECT 
  name, 
  vegan, 
  vegetarian, 
  difficulty,
  text_embedding,
  ingredients_embedding
FROM test_recipes;

-- Zeige alle Zutaten
SELECT name, name_embedding FROM test_ingredients;

-- Zeige Rezepte mit ihren Zutaten
SELECT 
  r.name as rezept,
  ri.quantity,
  i.name as zutat
FROM test_recipes r
JOIN test_recipe_ingredients ri ON r.recipe_id = ri.recipe_id
JOIN test_ingredients i ON ri.ingredient_id = i.ingredient_id
ORDER BY r.name;
```

---

### 3️⃣ Teste die semantische Suche

**Via Browser (Frontend):**

1. Öffne die SoupMate-App in deinem Browser
2. Melde dich an (oder nutze Gast-Modus)
3. Gib eine Suchanfrage ein: "Tomatensuppe" oder "vegane Suppe"
4. Die App sollte jetzt Rezepte aus der Datenbank anzeigen!

**Via API-Test (Terminal):**

```bash
curl -X POST https://brssalvqnbxgaiwmycpf.supabase.co/functions/v1/make-server-b187574e/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Suppe mit Karotten",
    "filters": {
      "dietType": "vegan"
    }
  }'
```

---

### 4️⃣ Überprüfe die Konfiguration

**✅ Diese Dateien wurden bereits konfiguriert:**

- `/config.tsx` → `useMockData: false` (Datenbank aktiv)
- `/supabase/functions/server/index.tsx` → Semantische Suche implementiert
- `/utils/supabase/info.tsx` → Deine Supabase-Credentials

**Keine weitere Konfiguration nötig!**

---

## 🔍 Wie funktioniert die Suche?

```
Benutzer gibt Suche ein: "vegane Karottensuppe"
         ↓
1. Embedding generieren: [0.23, 0.45, 0.67]
         ↓
2. Filter anwenden (vegan = true)
         ↓
3. Ähnlichkeit berechnen:
   - Vergleich mit text_embedding
   - Vergleich mit ingredients_embedding
   - Score = 0.6 × Zutaten + 0.4 × Text
         ↓
4. Top 5 Rezepte zurückgeben
         ↓
5. Zusatzfilter (Zeit, Allergien) anwenden
         ↓
Ergebnisse anzeigen! 🎉
```

---

## 🎯 Quick-Tests

### Test 1: Basis-Suche
**Erwartung:** Zeigt alle passenden Rezepte

```javascript
// In der SoupMate-App
Suche: "Suppe"
Filter: Keine
```

### Test 2: Vegane Filter
**Erwartung:** Zeigt nur vegane Rezepte

```javascript
Suche: "Gemüsesuppe"
Filter: Vegan ✓
```

### Test 3: Schwierigkeits-Filter
**Erwartung:** Zeigt nur einfache Rezepte

```javascript
Suche: "Suppe"
Filter: Schwierigkeit ⭐⭐ (2 Sterne)
```

### Test 4: Zutaten-basiert
**Erwartung:** Zeigt Rezepte mit Tomaten

```javascript
Suche: "Tomatensuppe"
Filter: Keine
```

---

## 🐛 Häufige Probleme & Lösungen

### ❌ Problem: "Keine Rezepte gefunden"

**Ursache:** Datenbank ist leer

**Lösung:**
```sql
-- Überprüfe in Supabase SQL Editor:
SELECT COUNT(*) FROM test_recipes;

-- Wenn 0, dann führe /sample-recipes.sql aus
```

---

### ❌ Problem: "Database query failed"

**Ursache:** Supabase-Credentials fehlen oder sind falsch

**Lösung:**
```bash
# Überprüfe Umgebungsvariablen in Supabase
# Dashboard → Project Settings → API

# Stelle sicher, dass diese gesetzt sind:
SUPABASE_URL=https://brssalvqnbxgaiwmycpf.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<dein-service-role-key>
```

---

### ❌ Problem: "Embeddings funktionieren nicht"

**Ursache:** Vector Extension nicht aktiviert

**Lösung:**
```sql
-- In Supabase SQL Editor ausführen:
CREATE EXTENSION IF NOT EXISTS vector;

-- Überprüfen:
SELECT * FROM pg_extension WHERE extname = 'vector';
```

---

### ❌ Problem: Suche dauert sehr lange

**Ursache:** Keine Indizes auf den Embedding-Spalten

**Lösung (für Produktion mit hochdimensionalen Vektoren):**
```sql
-- Erstelle Indizes (nur für 768-1536D Embeddings sinnvoll)
CREATE INDEX ON test_recipes 
  USING ivfflat (text_embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX ON test_recipes 
  USING ivfflat (ingredients_embedding vector_cosine_ops)
  WITH (lists = 100);
```

---

## 📊 Datenbank-Status überprüfen

**Führe dies in Supabase SQL Editor aus:**

```sql
-- Gesamtübersicht
SELECT 
  'Rezepte' as tabelle, COUNT(*) as anzahl FROM test_recipes
UNION ALL
SELECT 
  'Zutaten' as tabelle, COUNT(*) as anzahl FROM test_ingredients
UNION ALL
SELECT 
  'Verknüpfungen' as tabelle, COUNT(*) as anzahl FROM test_recipe_ingredients;

-- Rezept-Details
SELECT 
  r.name,
  r.vegan,
  r.vegetarian,
  r.difficulty,
  COUNT(ri.ingredient_id) as zutaten_anzahl
FROM test_recipes r
LEFT JOIN test_recipe_ingredients ri ON r.recipe_id = ri.recipe_id
GROUP BY r.recipe_id, r.name, r.vegan, r.vegetarian, r.difficulty;
```

**Erwartetes Ergebnis nach `/sample-recipes.sql`:**
- ✅ 4 Rezepte
- ✅ 15 Zutaten
- ✅ ~25 Verknüpfungen

---

## 🚀 Nächste Schritte

### Sofort möglich:
1. ✅ Teste die App im Browser
2. ✅ Füge eigene Rezepte hinzu
3. ✅ Experimentiere mit Filtern

### Für Produktion (später):
1. 🔄 Upgrade auf hochdimensionale Embeddings (siehe `/DATABASE_INTEGRATION.md`)
2. 🔄 Echte Embedding-API integrieren (OpenAI, Voyage AI, Gemini)
3. 🔄 Schema erweitern (work_time, total_time, allergens)
4. 🔄 Indizes erstellen für bessere Performance

---

## 💡 Tipps

### Embedding-Qualität verbessern

Die aktuellen Mock-Embeddings (3D) sind nur für Demo. Für bessere Suchergebnisse:

```typescript
// In /supabase/functions/server/index.tsx ersetzen:

// AKTUELL (Mock):
const queryEmbedding = generateMockEmbedding(query);

// PRODUKTIV (OpenAI):
const queryEmbedding = await generateOpenAIEmbedding(query);
```

### Mehr Rezepte hinzufügen

Du kannst die Beispiel-Rezepte aus dem Mock-System (`/components/SearchBar.tsx`, Zeile 107-272) als Vorlage nutzen und in SQL umwandeln.

### Filter kombinieren

Teste verschiedene Filter-Kombinationen:
- Vegan + Schwierigkeit 2
- Arbeitszeit 10-20 Min + verfügbare Zutaten
- Keine Allergene + Vegetarisch

---

## 📞 Hilfe & Support

Bei Problemen:
1. Überprüfe Console-Logs im Browser (F12 → Console)
2. Überprüfe Supabase Logs (Dashboard → Logs → Edge Functions)
3. Führe SQL-Tests aus (siehe oben)
4. Siehe `/DATABASE_INTEGRATION.md` für detaillierte Infos

---

## ✨ Das war's!

Deine Datenbank ist jetzt voll integriert. Viel Spaß beim Suchen nach leckeren Suppen! 🍲

**Wichtig:** Die aktuelle Version nutzt 3D Mock-Embeddings für Demo-Zwecke. Für Produktion solltest du auf echte Embeddings (768-1536D) upgraden - siehe `/DATABASE_INTEGRATION.md` für Details.
