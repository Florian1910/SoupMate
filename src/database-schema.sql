-- =====================================================
-- SoupMate Datenbank-Schema mit semantischer Suche
-- Version: 2.0 (Erweitert)
-- =====================================================
-- Dieses Schema nutzt vereinfachte 3D-Embeddings für Demo-Zwecke.
-- In der Produktion sollten höherdimensionale Embeddings (768 oder 1536)
-- mit IVFFlat-Indexierung verwendet werden.
-- =====================================================

-- 1. TABELLE: test_recipes
-- Speichert alle Rezeptinformationen und ihre Embeddings
CREATE TABLE IF NOT EXISTS test_recipes (
  recipe_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  instructions text,
  vegan boolean DEFAULT false,
  vegetarian boolean DEFAULT false,
  difficulty int, -- Schwierigkeitsgrad (1-5)
  diet varchar(50), -- z.B. 'vegan', 'vegetarian', 'omnivore'
  image_url text,
  prep_time int, -- Arbeitszeit in Minuten
  cook_time int, -- Kochzeit in Minuten
  total_time int, -- Gesamtzeit in Minuten
  servings int, -- Anzahl der Portionen
  text_embedding vector(3), -- Semantisches Embedding des Rezepttexts
  ingredients_embedding vector(3), -- Aggregiertes Embedding aller Zutaten
  created_at timestamptz DEFAULT current_timestamp,
  updated_at timestamptz DEFAULT current_timestamp
);

-- 2. TABELLE: test_ingredients
-- Speichert alle Zutaten mit ihren semantischen Embeddings
CREATE TABLE IF NOT EXISTS test_ingredients (
  ingredient_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  name_embedding vector(3) -- Semantisches Embedding der Zutat
);

-- 3. TABELLE: test_recipe_ingredients
-- N:M-Beziehung zwischen Rezepten und Zutaten mit Mengenangaben
CREATE TABLE IF NOT EXISTS test_recipe_ingredients (
  recipe_id uuid REFERENCES test_recipes(recipe_id) ON DELETE CASCADE,
  ingredient_id uuid REFERENCES test_ingredients(ingredient_id) ON DELETE CASCADE,
  quantity text, -- z.B. "200g", "3 Stück", "1 Prise"
  PRIMARY KEY (recipe_id, ingredient_id)
);

-- 4. TABELLE: user_profiles
-- Speichert Benutzerprofil-Informationen
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text, -- Vollständiger Name des Benutzers
  username text UNIQUE, -- Benutzername (optional)
  avatar_url text, -- Profilbild URL
  created_at timestamptz DEFAULT current_timestamp,
  updated_at timestamptz DEFAULT current_timestamp
);

-- 5. TABELLE: user_preferences
-- Benutzerpräferenzen für personalisierte Empfehlungen
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_vegan boolean DEFAULT false,
  is_vegetarian boolean DEFAULT false,
  diet_type varchar(50), -- z.B. 'LowCarb', 'HighProtein', 'Keto'
  allergies text, -- Komma-getrennte Liste von Allergien
  created_at timestamptz DEFAULT current_timestamp,
  updated_at timestamptz DEFAULT current_timestamp
);

-- 6. TABELLE: user_favorites
-- Speichert Benutzer-Favoriten
CREATE TABLE IF NOT EXISTS user_favorites (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id uuid REFERENCES test_recipes(recipe_id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT current_timestamp,
  PRIMARY KEY (user_id, recipe_id)
);

-- =====================================================
-- TRIGGER & FUNKTIONEN
-- =====================================================

-- 7. FUNKTION: refresh_test_recipe_ingredients_embedding
-- Berechnet das durchschnittliche Embedding aller Zutaten für ein Rezept
CREATE OR REPLACE FUNCTION refresh_test_recipe_ingredients_embedding(p_recipe uuid)
RETURNS void AS $$
DECLARE
  agg vector;
BEGIN
  -- Berechne Mittelwert aller Zutaten-Embeddings
  SELECT avg(i.name_embedding)
  INTO agg
  FROM test_recipe_ingredients ri
  JOIN test_ingredients i ON i.ingredient_id = ri.ingredient_id
  WHERE ri.recipe_id = p_recipe
    AND i.name_embedding IS NOT NULL;
  
  -- Aktualisiere das Rezept mit dem aggregierten Embedding
  UPDATE test_recipes
  SET ingredients_embedding = agg,
      updated_at = current_timestamp
  WHERE recipe_id = p_recipe;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 8. TRIGGER-FUNKTION: trg_test_refresh_ing_embedding
-- Wird aufgerufen, wenn test_recipe_ingredients geändert wird
CREATE OR REPLACE FUNCTION trg_test_refresh_ing_embedding()
RETURNS trigger AS $$
BEGIN
  -- Aktualisiere das ingredients_embedding für das betroffene Rezept
  PERFORM refresh_test_recipe_ingredients_embedding(
    COALESCE(NEW.recipe_id, OLD.recipe_id)
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 8. TRIGGER: t_test_refresh_ing_embedding_i
-- Automatische Aktualisierung des ingredients_embedding
DROP TRIGGER IF EXISTS t_test_refresh_ing_embedding_i ON test_recipe_ingredients;

CREATE TRIGGER t_test_refresh_ing_embedding_i
AFTER INSERT OR UPDATE OR DELETE ON test_recipe_ingredients
FOR EACH ROW
EXECUTE FUNCTION trg_test_refresh_ing_embedding();

-- =====================================================
-- BEISPIEL-ABFRAGEN
-- =====================================================

-- 9.1 Zutatenbasierte semantische Suche
-- Findet Rezepte basierend auf ähnlichen Zutaten
/*
WITH q AS (
  SELECT '[0.10, 0.20, 0.30]'::vector AS v -- Embedding der gesuchten Zutaten
)
SELECT
  name,
  ingredients_embedding <=> q.v AS distance
FROM test_recipes
WHERE ingredients_embedding IS NOT NULL
ORDER BY distance ASC
LIMIT 10;
*/

-- 9.2 Textbasierte semantische Suche
-- Findet Rezepte basierend auf ähnlichem Textinhalt
/*
WITH q AS (
  SELECT '[0.12, 0.34, 0.56]'::vector AS v -- Embedding der Suchanfrage
)
SELECT
  name,
  text_embedding <=> q.v AS distance
FROM test_recipes
WHERE text_embedding IS NOT NULL
ORDER BY distance ASC
LIMIT 10;
*/

-- 9.3 Kombinierte Suche (Text + Zutaten mit Gewichtung)
-- Berücksichtigt sowohl Text als auch Zutaten
/*
WITH q AS (
  SELECT
    '[0.10, 0.20, 0.30]'::vector AS v_ing, -- Embedding der Zutaten
    '[0.12, 0.34, 0.56]'::vector AS v_txt  -- Embedding des Textes
)
SELECT
  name,
  0.6 * (ingredients_embedding <=> q.v_ing) + 0.4 * (text_embedding <=> q.v_txt) AS score
FROM test_recipes
WHERE ingredients_embedding IS NOT NULL
  AND text_embedding IS NOT NULL
ORDER BY score ASC
LIMIT 10;
*/

-- =====================================================
-- DEMO-DATEN (Optional zum Testen)
-- =====================================================

-- Beispiel-Zutaten einfügen
/*
INSERT INTO test_ingredients (name, name_embedding) VALUES
  ('Tomaten', '[0.1, 0.2, 0.3]'::vector),
  ('Zwiebeln', '[0.15, 0.25, 0.35]'::vector),
  ('Knoblauch', '[0.12, 0.22, 0.32]'::vector),
  ('Karotten', '[0.2, 0.3, 0.4]'::vector),
  ('Ingwer', '[0.18, 0.28, 0.38]'::vector)
ON CONFLICT (name) DO NOTHING;
*/

-- Beispiel-Rezept einfügen
/*
INSERT INTO test_recipes (
  name, description, instructions,
  vegan, vegetarian, difficulty, diet,
  prep_time, cook_time, total_time, servings,
  text_embedding
) VALUES (
  'Tomatensuppe',
  'Eine klassische cremige Tomatensuppe',
  'Zwiebeln anbraten. Tomaten hinzufügen. Köcheln lassen. Pürieren.',
  false, true, 2, 'vegetarian',
  15, 25, 40, 4,
  '[0.11, 0.21, 0.31]'::vector
);
*/

-- =====================================================
-- HINWEISE
-- =====================================================
-- 1. Diese Schema-Version nutzt 3D-Embeddings für Demo-Zwecke
-- 2. In Produktion sollten 768D oder 1536D Embeddings verwendet werden
-- 3. Für große Datenmengen sollte ein IVFFlat-Index erstellt werden:
--    CREATE INDEX ON test_recipes USING ivfflat (text_embedding vector_cosine_ops);
-- 4. Die Embeddings sollten über ein ML-Modell (z.B. OpenAI, Sentence Transformers) generiert werden
