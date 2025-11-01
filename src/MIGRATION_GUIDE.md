# 🔄 Migrations-Anleitung: v1.0 → v2.0

## Übersicht

Diese Anleitung hilft dir, von der alten Datenbankstruktur (varchar difficulty) zur neuen Struktur (int difficulty + Zeitfelder) zu migrieren.

---

## 🆕 Was ist neu in v2.0?

### Neue Felder in `test_recipes`:
- `prep_time` (int) - Arbeitszeit in Minuten
- `cook_time` (int) - Kochzeit in Minuten  
- `total_time` (int) - Gesamtzeit in Minuten
- `servings` (int) - Anzahl der Portionen
- `diet` (varchar) - Ernährungstyp

### Geänderte Felder:
- `difficulty` (varchar → int 1-5)

### Neue Tabellen:
- `user_preferences` - Benutzerpräferenzen
- `user_favorites` - Favoriten

---

## 🚀 Migrations-Schritte

### Option A: Neu aufsetzen (Empfohlen für Demo)

Wenn du nur Demo-Daten hast, ist es am einfachsten, die Tabellen neu zu erstellen:

```sql
-- 1. Alte Tabellen löschen
DROP TABLE IF EXISTS test_recipe_ingredients CASCADE;
DROP TABLE IF EXISTS test_ingredients CASCADE;
DROP TABLE IF EXISTS test_recipes CASCADE;

-- 2. Neues Schema ausführen
-- Führe database-schema.sql aus

-- 3. Demo-Daten einfügen
-- Führe sample-data-v2.sql aus
```

### Option B: Bestehende Daten migrieren

Falls du wichtige Daten behalten möchtest:

#### Schritt 1: Neue Spalten hinzufügen

```sql
-- Füge neue Spalten zur test_recipes-Tabelle hinzu
ALTER TABLE test_recipes
  ADD COLUMN IF NOT EXISTS prep_time int,
  ADD COLUMN IF NOT EXISTS cook_time int,
  ADD COLUMN IF NOT EXISTS total_time int,
  ADD COLUMN IF NOT EXISTS servings int DEFAULT 4,
  ADD COLUMN IF NOT EXISTS diet varchar(50);
```

#### Schritt 2: Difficulty-Spalte umwandeln

```sql
-- Temporäre Spalte erstellen
ALTER TABLE test_recipes ADD COLUMN difficulty_new int;

-- Daten konvertieren
UPDATE test_recipes 
SET difficulty_new = CASE 
  WHEN difficulty = 'easy' THEN 2
  WHEN difficulty = 'medium' THEN 3
  WHEN difficulty = 'hard' THEN 4
  ELSE 3
END
WHERE difficulty IS NOT NULL;

-- Alte Spalte löschen und neue umbenennen
ALTER TABLE test_recipes DROP COLUMN difficulty;
ALTER TABLE test_recipes RENAME COLUMN difficulty_new TO difficulty;
```

#### Schritt 3: Zeitfelder befüllen (Schätzwerte)

```sql
-- Setze Schätzwerte für fehlende Zeitfelder
UPDATE test_recipes
SET 
  prep_time = COALESCE(prep_time, 15),
  cook_time = COALESCE(cook_time, 25),
  total_time = COALESCE(total_time, prep_time + cook_time)
WHERE total_time IS NULL OR prep_time IS NULL OR cook_time IS NULL;
```

#### Schritt 4: Diet-Feld befüllen

```sql
-- Setze diet basierend auf vegan/vegetarian
UPDATE test_recipes
SET diet = CASE
  WHEN vegan = true THEN 'vegan'
  WHEN vegetarian = true THEN 'vegetarian'
  ELSE 'omnivore'
END
WHERE diet IS NULL;
```

#### Schritt 5: Neue Tabellen erstellen

```sql
-- user_preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_vegan boolean DEFAULT false,
  is_vegetarian boolean DEFAULT false,
  diet_type varchar(50),
  allergies text,
  created_at timestamptz DEFAULT current_timestamp,
  updated_at timestamptz DEFAULT current_timestamp
);

-- user_favorites
CREATE TABLE IF NOT EXISTS user_favorites (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id uuid REFERENCES test_recipes(recipe_id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT current_timestamp,
  PRIMARY KEY (user_id, recipe_id)
);
```

#### Schritt 6: Trigger & Funktionen erstellen

```sql
-- Führe die Trigger-Definitionen aus database-schema.sql aus
-- (Funktionen refresh_test_recipe_ingredients_embedding und Trigger)
```

---

## ✅ Migrations-Überprüfung

Nach der Migration solltest du folgende Checks durchführen:

### 1. Struktur überprüfen

```sql
-- Zeige alle Spalten der test_recipes-Tabelle
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'test_recipes'
ORDER BY ordinal_position;

-- Erwartete Spalten:
-- recipe_id (uuid)
-- name (text)
-- description (text)
-- instructions (text)
-- vegan (boolean)
-- vegetarian (boolean)
-- difficulty (integer) ← WICHTIG: integer, nicht varchar!
-- diet (varchar)
-- image_url (text)
-- prep_time (integer)
-- cook_time (integer)
-- total_time (integer)
-- servings (integer)
-- text_embedding (vector)
-- ingredients_embedding (vector)
-- created_at (timestamptz)
-- updated_at (timestamptz)
```

### 2. Daten überprüfen

```sql
-- Überprüfe, ob alle Rezepte vollständige Daten haben
SELECT 
  name,
  difficulty,
  prep_time,
  cook_time,
  total_time,
  servings,
  CASE 
    WHEN difficulty IS NULL THEN '❌ difficulty fehlt'
    WHEN prep_time IS NULL THEN '❌ prep_time fehlt'
    WHEN total_time IS NULL THEN '❌ total_time fehlt'
    WHEN servings IS NULL THEN '❌ servings fehlt'
    ELSE '✅ Vollständig'
  END as status
FROM test_recipes;
```

### 3. Trigger überprüfen

```sql
-- Überprüfe, ob der Trigger existiert
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 't_test_refresh_ing_embedding_i';

-- Erwartete Ausgabe:
-- trigger_name: t_test_refresh_ing_embedding_i
-- event_manipulation: INSERT, UPDATE, DELETE
-- event_object_table: test_recipe_ingredients
```

### 4. Embeddings überprüfen

```sql
-- Prüfe, ob alle Rezepte Embeddings haben
SELECT 
  name,
  CASE WHEN text_embedding IS NULL THEN '❌' ELSE '✅' END as text_emb,
  CASE WHEN ingredients_embedding IS NULL THEN '❌' ELSE '✅' END as ing_emb
FROM test_recipes
ORDER BY name;
```

---

## 🔧 Backend aktualisieren

Nach der Datenmigration musst du auch das Backend aktualisieren:

### 1. Code-Änderungen sind bereits implementiert

Die Datei `/supabase/functions/server/index.tsx` wurde bereits aktualisiert:
- ✅ Verwendet neue Zeitfelder (prep_time, cook_time, total_time)
- ✅ Verwendet difficulty als int
- ✅ Verwendet servings aus DB

### 2. Edge Function neu deployen

```bash
# Mit Supabase CLI
supabase functions deploy make-server-b187574e
```

---

## ⚠️ Häufige Probleme

### Problem: "column difficulty does not exist"
**Ursache:** Migration von varchar zu int nicht abgeschlossen  
**Lösung:** Führe Schritt 2 der Migration erneut aus

### Problem: "ingredients_embedding ist immer NULL"
**Ursache:** Trigger wurde nicht erstellt oder funktioniert nicht  
**Lösung:** 
```sql
-- Trigger manuell ausführen für alle Rezepte
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT recipe_id FROM test_recipes LOOP
    PERFORM refresh_test_recipe_ingredients_embedding(rec.recipe_id);
  END LOOP;
END $$;
```

### Problem: "prep_time/total_time sind NULL"
**Ursache:** Alte Rezepte haben keine Zeitangaben  
**Lösung:** Führe Schritt 3 der Migration aus

### Problem: Backend gibt 500-Fehler
**Ursache:** Backend-Code verwendet alte Struktur  
**Lösung:** 
1. Stelle sicher, dass `/supabase/functions/server/index.tsx` aktualisiert ist
2. Deploye die Edge Function neu
3. Überprüfe Browser-Console auf detaillierte Fehler

---

## 📊 Rollback (Falls nötig)

Falls die Migration fehlschlägt, kannst du zum alten Schema zurückkehren:

```sql
-- 1. Backup der neuen Daten erstellen (falls benötigt)
CREATE TABLE test_recipes_backup AS SELECT * FROM test_recipes;

-- 2. Spalte zurück zu varchar konvertieren
ALTER TABLE test_recipes ADD COLUMN difficulty_old varchar(50);

UPDATE test_recipes 
SET difficulty_old = CASE 
  WHEN difficulty <= 2 THEN 'easy'
  WHEN difficulty = 3 THEN 'medium'
  WHEN difficulty >= 4 THEN 'hard'
  ELSE 'medium'
END;

ALTER TABLE test_recipes DROP COLUMN difficulty;
ALTER TABLE test_recipes RENAME COLUMN difficulty_old TO difficulty;

-- 3. Neue Spalten entfernen (Optional)
ALTER TABLE test_recipes 
  DROP COLUMN IF EXISTS prep_time,
  DROP COLUMN IF EXISTS cook_time,
  DROP COLUMN IF EXISTS total_time,
  DROP COLUMN IF EXISTS servings,
  DROP COLUMN IF EXISTS diet;
```

---

## 📚 Nächste Schritte

Nach erfolgreicher Migration:

1. ✅ Teste die Suche mit verschiedenen Filtern
2. ✅ Überprüfe, ob alle Rezepte korrekt angezeigt werden
3. ✅ Füge bei Bedarf weitere Demo-Daten hinzu
4. ✅ Implementiere Favoriten-Funktionalität (optional)
5. ✅ Implementiere User Preferences (optional)

---

## 🆘 Support

Bei Problemen:
1. Überprüfe die Browser-Console auf Fehler
2. Überprüfe Supabase-Logs im Dashboard
3. Führe die Validierungs-Queries aus diesem Guide aus
4. Prüfe, ob alle Umgebungsvariablen korrekt gesetzt sind

---

**Stand:** November 2025  
**Version:** 2.0  
**Status:** ✅ Einsatzbereit
