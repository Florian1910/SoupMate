-- =====================================================
-- SoupMate Demo-Daten für Version 2.0
-- =====================================================
-- Diese Datei enthält Beispieldaten mit den neuen Feldern:
-- prep_time, cook_time, total_time, servings, difficulty (int)
-- =====================================================

-- SCHRITT 1: Zutaten einfügen
-- =====================================================
INSERT INTO test_ingredients (name, name_embedding) VALUES
  -- Gemüse
  ('Tomaten', '[0.10, 0.20, 0.30]'::vector),
  ('Karotten', '[0.20, 0.30, 0.40]'::vector),
  ('Zwiebeln', '[0.15, 0.25, 0.35]'::vector),
  ('Knoblauch', '[0.12, 0.22, 0.32]'::vector),
  ('Sellerie', '[0.19, 0.29, 0.39]'::vector),
  ('Paprika', '[0.17, 0.27, 0.37]'::vector),
  ('Kartoffeln', '[0.21, 0.31, 0.41]'::vector),
  ('Kürbis', '[0.22, 0.32, 0.42]'::vector),
  
  -- Gewürze & Kräuter
  ('Basilikum', '[0.11, 0.21, 0.31]'::vector),
  ('Petersilie', '[0.13, 0.23, 0.33]'::vector),
  ('Thymian', '[0.14, 0.24, 0.34]'::vector),
  ('Ingwer', '[0.18, 0.28, 0.38]'::vector),
  ('Koriander', '[0.16, 0.26, 0.36]'::vector),
  ('Curry', '[0.25, 0.35, 0.45]'::vector),
  
  -- Milchprodukte & Alternativen
  ('Sahne', '[0.14, 0.24, 0.34]'::vector),
  ('Kokosmilch', '[0.23, 0.33, 0.43]'::vector),
  ('Parmesan', '[0.24, 0.34, 0.44]'::vector),
  
  -- Brühe & Flüssigkeiten
  ('Gemüsebrühe', '[0.26, 0.36, 0.46]'::vector),
  ('Hühnerbrühe', '[0.27, 0.37, 0.47]'::vector),
  
  -- Sonstiges
  ('Olivenöl', '[0.28, 0.38, 0.48]'::vector),
  ('Salz', '[0.29, 0.39, 0.49]'::vector),
  ('Pfeffer', '[0.30, 0.40, 0.50]'::vector),
  ('Zucker', '[0.31, 0.41, 0.51]'::vector),
  ('Croutons', '[0.32, 0.42, 0.52]'::vector)
ON CONFLICT (name) DO NOTHING;

-- SCHRITT 2: Rezepte einfügen
-- =====================================================

-- Rezept 1: Cremige Tomatensuppe (Vegetarisch, Einfach)
DO $$
DECLARE
  recipe_id_tomato uuid;
BEGIN
  INSERT INTO test_recipes (
    name, description, instructions,
    vegan, vegetarian, difficulty, diet,
    prep_time, cook_time, total_time, servings,
    image_url, text_embedding
  ) VALUES (
    'Cremige Tomatensuppe',
    'Eine klassische, samtige Tomatensuppe mit frischen Kräutern und einem Hauch von Knoblauch. Diese Suppe ist perfekt für kalte Tage.',
    'Zwiebeln schälen und fein würfeln. Knoblauch schälen und hacken. Olivenöl in einem großen Topf erhitzen und Zwiebeln glasig anschwitzen. Knoblauch hinzufügen und 1-2 Minuten anbraten. Tomaten grob würfeln und mit Gemüsebrühe hinzufügen. Eine Prise Zucker einrühren. 15 Minuten köcheln lassen. Basilikum hinzufügen und mit einem Pürierstab fein pürieren. Sahne einrühren und kurz erwärmen. Mit Salz und Pfeffer abschmecken.',
    false, true, 2, 'vegetarian',
    15, 25, 40, 4,
    'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
    '[0.11, 0.21, 0.31]'::vector
  ) RETURNING recipe_id INTO recipe_id_tomato;
  
  -- Zutaten für Tomatensuppe
  INSERT INTO test_recipe_ingredients (recipe_id, ingredient_id, quantity)
  SELECT 
    recipe_id_tomato,
    ingredient_id,
    quantity
  FROM (VALUES
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Tomaten'), '600g'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Sahne'), '200ml'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Basilikum'), '3 Stängel'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Knoblauch'), '2 Zehen'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Zwiebeln'), '1 große'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Gemüsebrühe'), '500ml'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Olivenöl'), '2 EL'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Salz'), 'nach Geschmack'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Pfeffer'), 'nach Geschmack'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Zucker'), '1 Prise')
  ) AS t(ingredient_id, quantity);
END $$;

-- Rezept 2: Karottensuppe mit Ingwer (Vegan, Einfach)
DO $$
DECLARE
  recipe_id_carrot uuid;
BEGIN
  INSERT INTO test_recipes (
    name, description, instructions,
    vegan, vegetarian, difficulty, diet,
    prep_time, cook_time, total_time, servings,
    image_url, text_embedding
  ) VALUES (
    'Karottensuppe mit Ingwer',
    'Eine wärmende Karottensuppe mit frischem Ingwer und Kokosmilch. Reich an Vitaminen und perfekt für eine gesunde Ernährung.',
    'Karotten schälen und in Stücke schneiden. Zwiebel würfeln. Ingwer schälen und fein reiben. Olivenöl erhitzen und Zwiebeln anschwitzen. Ingwer und Knoblauch hinzufügen. Karotten und Gemüsebrühe dazugeben. 20 Minuten köcheln lassen. Kokosmilch einrühren und pürieren. Mit Salz, Pfeffer und Koriander abschmecken.',
    true, true, 2, 'vegan',
    15, 30, 45, 4,
    'https://images.unsplash.com/photo-1588137378633-dea1336ce1e2?w=800',
    '[0.12, 0.22, 0.32]'::vector
  ) RETURNING recipe_id INTO recipe_id_carrot;
  
  -- Zutaten für Karottensuppe
  INSERT INTO test_recipe_ingredients (recipe_id, ingredient_id, quantity)
  SELECT 
    recipe_id_carrot,
    ingredient_id,
    quantity
  FROM (VALUES
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Karotten'), '700g'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Kokosmilch'), '400ml'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Ingwer'), '3cm frisch'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Zwiebeln'), '1 große'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Knoblauch'), '1 Zehe'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Gemüsebrühe'), '600ml'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Olivenöl'), '2 EL'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Koriander'), 'zum Garnieren'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Salz'), 'nach Geschmack'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Pfeffer'), 'nach Geschmack')
  ) AS t(ingredient_id, quantity);
END $$;

-- Rezept 3: Kürbissuppe (Vegetarisch, Mittelschwer)
DO $$
DECLARE
  recipe_id_pumpkin uuid;
BEGIN
  INSERT INTO test_recipes (
    name, description, instructions,
    vegan, vegetarian, difficulty, diet,
    prep_time, cook_time, total_time, servings,
    image_url, text_embedding
  ) VALUES (
    'Cremige Kürbissuppe',
    'Eine herbstliche Kürbissuppe mit gerösteten Kürbiskernen und einem Hauch Muskatnuss. Perfekt für gemütliche Abende.',
    'Kürbis schälen, entkernen und würfeln. Zwiebeln und Knoblauch würfeln. Kartoffeln schälen und würfeln. Olivenöl erhitzen und Zwiebeln glasig anschwitzen. Kürbis und Kartoffeln hinzufügen und kurz anbraten. Mit Gemüsebrühe ablöschen. 25 Minuten köcheln lassen. Sahne einrühren und pürieren. Mit Salz, Pfeffer und einer Prise Muskatnuss abschmecken. Mit gerösteten Kürbiskernen garnieren.',
    false, true, 3, 'vegetarian',
    20, 30, 50, 6,
    'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=800',
    '[0.13, 0.23, 0.33]'::vector
  ) RETURNING recipe_id INTO recipe_id_pumpkin;
  
  -- Zutaten für Kürbissuppe
  INSERT INTO test_recipe_ingredients (recipe_id, ingredient_id, quantity)
  SELECT 
    recipe_id_pumpkin,
    ingredient_id,
    quantity
  FROM (VALUES
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Kürbis'), '1kg Hokkaido'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Kartoffeln'), '300g'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Sahne'), '150ml'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Zwiebeln'), '1 große'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Knoblauch'), '2 Zehen'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Gemüsebrühe'), '800ml'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Olivenöl'), '2 EL'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Salz'), 'nach Geschmack'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Pfeffer'), 'nach Geschmack')
  ) AS t(ingredient_id, quantity);
END $$;

-- Rezept 4: Minestrone (Vegan, Mittelschwer)
DO $$
DECLARE
  recipe_id_minestrone uuid;
BEGIN
  INSERT INTO test_recipes (
    name, description, instructions,
    vegan, vegetarian, difficulty, diet,
    prep_time, cook_time, total_time, servings,
    image_url, text_embedding
  ) VALUES (
    'Italienische Minestrone',
    'Eine herzhafte italienische Gemüsesuppe mit frischen Kräutern. Reich an Gemüse und voller Geschmack.',
    'Zwiebeln, Karotten, Sellerie und Paprika würfeln. Knoblauch hacken. Olivenöl erhitzen und Zwiebeln anschwitzen. Karotten, Sellerie und Paprika hinzufügen. Tomaten und Gemüsebrühe dazugeben. 20 Minuten köcheln lassen. Kartoffeln würfeln und hinzufügen. Weitere 15 Minuten köcheln. Mit Basilikum, Thymian, Salz und Pfeffer abschmecken.',
    true, true, 3, 'vegan',
    25, 40, 65, 6,
    'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
    '[0.14, 0.24, 0.34]'::vector
  ) RETURNING recipe_id INTO recipe_id_minestrone;
  
  -- Zutaten für Minestrone
  INSERT INTO test_recipe_ingredients (recipe_id, ingredient_id, quantity)
  SELECT 
    recipe_id_minestrone,
    ingredient_id,
    quantity
  FROM (VALUES
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Tomaten'), '400g'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Karotten'), '200g'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Sellerie'), '2 Stangen'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Paprika'), '1 rote'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Kartoffeln'), '200g'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Zwiebeln'), '1 große'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Knoblauch'), '3 Zehen'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Gemüsebrühe'), '1,5l'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Olivenöl'), '3 EL'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Basilikum'), '1 Bund'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Thymian'), '2 Zweige'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Salz'), 'nach Geschmack'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Pfeffer'), 'nach Geschmack')
  ) AS t(ingredient_id, quantity);
END $$;

-- Rezept 5: Thai-Kokossuppe (Vegan, Anspruchsvoll)
DO $$
DECLARE
  recipe_id_thai uuid;
BEGIN
  INSERT INTO test_recipes (
    name, description, instructions,
    vegan, vegetarian, difficulty, diet,
    prep_time, cook_time, total_time, servings,
    image_url, text_embedding
  ) VALUES (
    'Thai-Kokossuppe mit Curry',
    'Eine aromatische thailändische Suppe mit Kokosmilch, Curry und frischem Ingwer. Exotisch und würzig.',
    'Ingwer und Knoblauch fein hacken. Zwiebeln würfeln. Karotten und Paprika in Streifen schneiden. Olivenöl erhitzen und Zwiebeln anschwitzen. Ingwer, Knoblauch und Curry hinzufügen. Karotten und Paprika dazugeben. Mit Gemüsebrühe ablöschen. 15 Minuten köcheln. Kokosmilch einrühren und erwärmen. Mit Koriander, Salz und Pfeffer abschmecken.',
    true, true, 4, 'vegan',
    30, 25, 55, 4,
    'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800',
    '[0.15, 0.25, 0.35]'::vector
  ) RETURNING recipe_id INTO recipe_id_thai;
  
  -- Zutaten für Thai-Suppe
  INSERT INTO test_recipe_ingredients (recipe_id, ingredient_id, quantity)
  SELECT 
    recipe_id_thai,
    ingredient_id,
    quantity
  FROM (VALUES
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Kokosmilch'), '400ml'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Karotten'), '2 mittelgroße'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Paprika'), '1 rote'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Ingwer'), '5cm frisch'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Knoblauch'), '3 Zehen'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Zwiebeln'), '1 große'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Curry'), '2 EL rote Currypaste'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Gemüsebrühe'), '500ml'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Olivenöl'), '2 EL'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Koriander'), '1 Bund frisch'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Salz'), 'nach Geschmack'),
    ((SELECT ingredient_id FROM test_ingredients WHERE name = 'Pfeffer'), 'nach Geschmack')
  ) AS t(ingredient_id, quantity);
END $$;

-- =====================================================
-- Überprüfung: Wurden alle Embeddings berechnet?
-- =====================================================
SELECT 
  name,
  CASE WHEN ingredients_embedding IS NULL THEN '❌ Fehlt' ELSE '✅ OK' END as embedding_status,
  difficulty,
  prep_time,
  total_time,
  servings
FROM test_recipes
ORDER BY name;

-- =====================================================
-- FERTIG!
-- =====================================================
-- Du hast jetzt 5 Demo-Rezepte mit vollständigen Daten:
-- - Cremige Tomatensuppe (Vegetarisch, Einfach, 40min, 4 Portionen)
-- - Karottensuppe mit Ingwer (Vegan, Einfach, 45min, 4 Portionen)
-- - Cremige Kürbissuppe (Vegetarisch, Mittel, 50min, 6 Portionen)
-- - Italienische Minestrone (Vegan, Mittel, 65min, 6 Portionen)
-- - Thai-Kokossuppe (Vegan, Anspruchsvoll, 55min, 4 Portionen)
-- =====================================================
