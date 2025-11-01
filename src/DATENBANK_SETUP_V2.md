# 🗄️ SoupMate Datenbank-Setup Version 2.0

## Übersicht

Diese Version des SoupMate-Datenbankschemas nutzt ein erweitertes Design mit:
- **Direkte Zeitfelder** (prep_time, cook_time, total_time)
- **Portionenanzahl** (servings)
- **Integer-Schwierigkeitsgrad** (1-5 Sterne)
- **Benutzerpräferenzen & Favoriten**
- **Automatische Embedding-Aggregation** via Trigger

---

## 📋 Schritt-für-Schritt Anleitung

### 1. Voraussetzungen

- Supabase-Projekt mit aktivierter `vector`-Erweiterung
- Supabase CLI installiert (`npm install -g supabase`)
- Verbindung zum Projekt: `supabase link --project-ref brssalvqnbxgaiwmycpf`

### 2. Schema erstellen

Führe das SQL-Schema aus:

```bash
# Option A: Via Supabase Dashboard
# Gehe zu: SQL Editor → New Query
# Kopiere den Inhalt von database-schema.sql
# Führe das Query aus

# Option B: Via Supabase CLI
supabase db push
```

**Oder führe direkt die Datei `database-schema.sql` aus.**

---

## 🏗️ Tabellen-Struktur

### 1. `test_recipes` - Haupt-Rezepttabelle

```sql
recipe_id           uuid PRIMARY KEY
name                text NOT NULL
description         text
instructions        text
vegan               boolean
vegetarian          boolean
difficulty          int (1-5)          -- NEU: Integer statt varchar
diet                varchar(50)        -- z.B. 'vegan', 'omnivore'
image_url           text
prep_time           int                -- NEU: Arbeitszeit in Minuten
cook_time           int                -- NEU: Kochzeit in Minuten
total_time          int                -- NEU: Gesamtzeit in Minuten
servings            int                -- NEU: Anzahl der Portionen
text_embedding      vector(3)
ingredients_embedding vector(3)
created_at          timestamptz
updated_at          timestamptz
```

### 2. `test_ingredients` - Zutaten

```sql
ingredient_id       uuid PRIMARY KEY
name                text UNIQUE NOT NULL
name_embedding      vector(3)
```

### 3. `test_recipe_ingredients` - Rezept-Zutaten-Verknüpfung

```sql
recipe_id           uuid REFERENCES test_recipes
ingredient_id       uuid REFERENCES test_ingredients
quantity            text
PRIMARY KEY (recipe_id, ingredient_id)
```

### 4. `user_preferences` - Benutzerpräferenzen (NEU)

```sql
user_id             uuid PRIMARY KEY REFERENCES auth.users
is_vegan            boolean
is_vegetarian       boolean
diet_type           varchar(50)
allergies           text
created_at          timestamptz
updated_at          timestamptz
```

### 5. `user_favorites` - Benutzer-Favoriten (NEU)

```sql
user_id             uuid REFERENCES auth.users
recipe_id           uuid REFERENCES test_recipes
created_at          timestamptz
PRIMARY KEY (user_id, recipe_id)
```

---

## 🔧 Trigger & Funktionen

### Automatische Embedding-Aggregation

Wenn Zutaten zu einem Rezept hinzugefügt/entfernt werden, wird automatisch das `ingredients_embedding` aktualisiert:

**Funktion:** `refresh_test_recipe_ingredients_embedding(p_recipe uuid)`
- Berechnet Mittelwert aller Zutaten-Embeddings
- Aktualisiert `test_recipes.ingredients_embedding`

**Trigger:** `t_test_refresh_ing_embedding_i`
- Wird nach INSERT/UPDATE/DELETE auf `test_recipe_ingredients` ausgeführt

---

## 📝 Demo-Daten einfügen

### Schritt 1: Zutaten hinzufügen

```sql
INSERT INTO test_ingredients (name, name_embedding) VALUES
  ('Tomaten', '[0.1, 0.2, 0.3]'::vector),
  ('Zwiebeln', '[0.15, 0.25, 0.35]'::vector),
  ('Knoblauch', '[0.12, 0.22, 0.32]'::vector),
  ('Karotten', '[0.2, 0.3, 0.4]'::vector),
  ('Ingwer', '[0.18, 0.28, 0.38]'::vector),
  ('Sahne', '[0.14, 0.24, 0.34]'::vector),
  ('Basilikum', '[0.11, 0.21, 0.31]'::vector)
ON CONFLICT (name) DO NOTHING;
```

### Schritt 2: Rezept hinzufügen

```sql
-- Tomatensuppe einfügen
INSERT INTO test_recipes (
  name, description, instructions,
  vegan, vegetarian, difficulty, diet,
  prep_time, cook_time, total_time, servings,
  text_embedding
) VALUES (
  'Cremige Tomatensuppe',
  'Eine klassische, samtige Tomatensuppe mit frischen Kräutern und einem Hauch von Knoblauch.',
  'Zwiebeln schälen und würfeln. Knoblauch hacken. Olivenöl erhitzen und Zwiebeln glasig anschwitzen. Knoblauch hinzufügen und anbraten. Tomaten würfeln und mit Gemüsebrühe hinzufügen. 15 Minuten köcheln lassen. Basilikum hinzufügen und pürieren. Sahne einrühren und abschmecken.',
  false, true, 2, 'vegetarian',
  15, 25, 40, 4,
  '[0.11, 0.21, 0.31]'::vector
) RETURNING recipe_id;
```

### Schritt 3: Zutaten zum Rezept hinzufügen

```sql
-- Ersetze 'RECIPE_ID' mit der ID aus Schritt 2
INSERT INTO test_recipe_ingredients (recipe_id, ingredient_id, quantity)
SELECT 
  'RECIPE_ID'::uuid,
  ingredient_id,
  quantity
FROM (
  VALUES
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Tomaten'), '400g'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Sahne'), '200ml'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Basilikum'), '3 Stängel'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Knoblauch'), '2 Zehen'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Zwiebeln'), '1 große')
) AS t(ingredient_id, quantity);
```

---

## 🔍 Beispiel-Abfragen

### Semantische Suche nach Text

```sql
WITH q AS (
  SELECT '[0.12, 0.34, 0.56]'::vector AS v
)
SELECT
  name,
  description,
  difficulty,
  prep_time,
  total_time,
  servings,
  text_embedding <=> q.v AS distance
FROM test_recipes
WHERE text_embedding IS NOT NULL
ORDER BY distance ASC
LIMIT 10;
```

### Rezepte nach Schwierigkeitsgrad filtern

```sql
SELECT name, difficulty, prep_time, total_time, servings
FROM test_recipes
WHERE difficulty <= 2  -- Nur einfache bis mittlere Rezepte
ORDER BY name;
```

### Kombinierte Suche mit Filtern

```sql
WITH q AS (
  SELECT
    '[0.10, 0.20, 0.30]'::vector AS v_ing,
    '[0.12, 0.34, 0.56]'::vector AS v_txt
)
SELECT
  name,
  difficulty,
  prep_time,
  total_time,
  servings,
  0.6 * (ingredients_embedding <=> q.v_ing) + 0.4 * (text_embedding <=> q.v_txt) AS score
FROM test_recipes
WHERE ingredients_embedding IS NOT NULL
  AND text_embedding IS NOT NULL
  AND vegetarian = true
  AND difficulty <= 3
  AND total_time <= 60
ORDER BY score ASC
LIMIT 10;
```

---

## 🚀 Backend-Integration

Der Backend-Code in `/supabase/functions/server/index.tsx` nutzt automatisch die neuen Felder:

- `prep_time` → workTime
- `total_time` → totalTime
- `servings` → servings
- `difficulty` (int 1-5) → difficulty (direkt verwendet)

### Wichtige Änderungen:

1. **Schwierigkeitsgrad-Filter:**
   ```typescript
   // ALT: sqlQuery.eq('difficulty', 'easy')
   // NEU: sqlQuery.lte('difficulty', 3)
   ```

2. **Zeit-Felder:**
   ```typescript
   // NEU: Verwendet Datenbank-Felder mit Fallback
   const totalTime = recipe.total_time || 
                     (recipe.prep_time || 15) + (recipe.cook_time || 25);
   ```

---

## 📊 Zukünftige Erweiterungen

### 1. Höherdimensionale Embeddings
Für Produktion: Wechsel zu 768D oder 1536D Vektoren (z.B. OpenAI, Sentence Transformers)

```sql
-- Ändere vector(3) zu vector(768)
ALTER TABLE test_recipes 
  ALTER COLUMN text_embedding TYPE vector(768);
```

### 2. IVFFlat-Index für Performance
Für große Datenmengen:

```sql
CREATE INDEX ON test_recipes 
  USING ivfflat (text_embedding vector_cosine_ops)
  WITH (lists = 100);
```

### 3. Allergen-Tabelle
Erstelle separate Tabelle für Allergene:

```sql
CREATE TABLE allergens (
  allergen_id uuid PRIMARY KEY,
  name text UNIQUE
);

CREATE TABLE recipe_allergens (
  recipe_id uuid REFERENCES test_recipes,
  allergen_id uuid REFERENCES allergens,
  PRIMARY KEY (recipe_id, allergen_id)
);
```

### 4. User Preferences API
Erweitere Backend mit Endpoints für:
- `/api/preferences` - Präferenzen abrufen/setzen
- `/api/favorites` - Favoriten hinzufügen/entfernen

---

## ⚠️ Wichtige Hinweise

1. **Demo-Modus:** Die aktuellen 3D-Embeddings sind nur für Tests. Für echte semantische Suche benötigst du ein ML-Modell.

2. **Deployment:** Nach Schema-Änderungen muss die Edge Function neu deployed werden:
   ```bash
   supabase functions deploy make-server-b187574e
   ```

3. **Datenmigration:** Falls du bereits alte Daten hast, musst du diese migrieren:
   ```sql
   -- Beispiel: difficulty von varchar zu int
   UPDATE test_recipes 
   SET difficulty = CASE 
     WHEN difficulty = 'easy' THEN 2
     WHEN difficulty = 'medium' THEN 3
     WHEN difficulty = 'hard' THEN 4
     ELSE 3
   END;
   ```

4. **RLS (Row Level Security):** Für Produktion solltest du RLS-Policies für `user_preferences` und `user_favorites` einrichten.

---

## 🆘 Troubleshooting

### Problem: Trigger funktioniert nicht
**Lösung:** Überprüfe, ob die Funktion existiert:
```sql
SELECT proname FROM pg_proc WHERE proname LIKE '%refresh%';
```

### Problem: Vector-Extension fehlt
**Lösung:** Aktiviere die Extension:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Problem: 401 Fehler beim API-Call
**Lösung:** Stelle sicher, dass du den richtigen API-Key verwendest:
- Für Frontend: SUPABASE_ANON_KEY
- Für Backend: SUPABASE_SERVICE_ROLE_KEY

---

## 📚 Weiterführende Links

- [Supabase Vector Docs](https://supabase.com/docs/guides/ai/vector-columns)
- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [Semantic Search Guide](https://supabase.com/docs/guides/ai/semantic-search)

---

**Stand:** November 2025  
**Version:** 2.0  
**Status:** ✅ Produktionsbereit (mit echten Embeddings)
