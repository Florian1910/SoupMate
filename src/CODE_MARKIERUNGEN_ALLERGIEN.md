# 🎯 CODE-MARKIERUNGEN: Allergien-Filter

## Schnellübersicht: Wo muss ich was ändern?

```
📁 components/Sidebar.tsx (Zeile 96-105)   ← ALLERGIEN-LISTE ÄNDERN
📁 App.tsx (Zeile 24, 65)                  ← Filter-State (prüfen)
📁 supabase/functions/server/index.tsx     ← Backend-Filter-Logik
   ├─ Zeile 172-187: SQL SELECT            ← Allergens hinzufügen
   ├─ Zeile 295-310: Recipe-Objekt         ← Allergens zurückgeben
   └─ Zeile 335-360: Filter-Logik          ← Allergien filtern
📁 database-schema.sql                     ← Schema erweitern (optional)
```

---

## 1️⃣ FRONTEND: Allergien-Liste

### 📁 `components/Sidebar.tsx`

```typescript
// ╔═══════════════════════════════════════════════════════════════╗
// ║  ZEILE 96-105: ALLERGIEN-LISTE - HIER ÄNDERN!               ║
// ╚═══════════════════════════════════════════════════════════════╝

const commonAllergies = [
  "Gluten",        // ← ZEILE 97
  "Laktose",       // ← ZEILE 98
  "Nüsse",         // ← ZEILE 99
  "Soja",          // ← ZEILE 100
  "Eier",          // ← ZEILE 101
  "Fisch",         // ← ZEILE 102
  "Schalentiere",  // ← ZEILE 103
  "Sesam",         // ← ZEILE 104
];                 // ← ZEILE 105

// ───────────────────────────────────────────────────────────────
// 🔧 SO ÄNDERST DU DIE LISTE:
// ───────────────────────────────────────────────────────────────
// 
// ✅ ALLERGEN HINZUFÜGEN:
//    Füge neue Zeile hinzu VOR der schließenden Klammer:
//    "Senf",       // ← NEU
//    "Sellerie",   // ← NEU
//
// ✅ ALLERGEN ENTFERNEN:
//    Lösche oder kommentiere die Zeile aus:
//    // "Soja",    // ← Auskommentiert
//
// ✅ REIHENFOLGE ÄNDERN:
//    Verschiebe Zeilen nach oben/unten
// ───────────────────────────────────────────────────────────────

// ╔═══════════════════════════════════════════════════════════════╗
// ║  ZEILE 291-306: RENDER - WIRD AUTOMATISCH AKTUALISIERT      ║
// ╚═══════════════════════════════════════════════════════════════╝

<div className="px-2 py-2 bg-white/5 rounded-lg space-y-2">
  {commonAllergies.map((allergy) => (  // ← ZEILE 291
    <div key={allergy} className="flex items-center gap-2">
      <Checkbox
        id={allergy}                   // ← ZEILE 294
        checked={selectedAllergies.includes(allergy)}  // ← ZEILE 295
        onCheckedChange={() => handleAllergyToggle(allergy)}
        className="border-white/30 data-[state=checked]:bg-[#ff6b35]"
      />
      <Label htmlFor={allergy} className="text-sm text-white/90 cursor-pointer">
        {allergy}                      // ← ZEILE 303: Zeigt Allergen-Name
      </Label>
    </div>
  ))}                                  // ← ZEILE 306
</div>

// ───────────────────────────────────────────────────────────────
// ℹ️ HINWEIS: 
//    Dieser Code muss NICHT geändert werden!
//    Er liest automatisch aus der commonAllergies-Liste.
// ───────────────────────────────────────────────────────────────
```

### Weitere relevante Zeilen in Sidebar.tsx:

```typescript
// ZEILE 40: State für ausgewählte Allergien
const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);

// ZEILE 24: Interface (sollte bereits korrekt sein)
interface RecipeFilters {
  // ...
  allergies: string[];  // ← Array von Allergen-Namen
}

// ZEILE 50: Filter werden weitergegeben
allergies: selectedAllergies,

// ZEILE 77-83: Handler für Allergie-Toggle
const handleAllergyToggle = (allergy: string) => {
  const newAllergies = selectedAllergies.includes(allergy)
    ? selectedAllergies.filter(a => a !== allergy)
    : [...selectedAllergies, allergy];
  setSelectedAllergies(newAllergies);
  notifyFilterChange({ allergies: newAllergies });
};

// ZEILE 278-288: Reset-Button für Allergien
{selectedAllergies.length > 0 && (
  <button
    onClick={() => {
      setSelectedAllergies([]);
      notifyFilterChange({ allergies: [] });
    }}
    className="text-xs text-white/60 hover:text-[#ff6b35]"
  >
    <X size={16} />
  </button>
)}
```

---

## 2️⃣ FRONTEND: App.tsx (State-Management)

### 📁 `App.tsx`

```typescript
// ╔═══════════════════════════════════════════════════════════════╗
// ║  ZEILE 24: INTERFACE - SOLLTE BEREITS KORREKT SEIN          ║
// ╚═══════════════════════════════════════════════════════════════╝

interface RecipeFilters {
  dietType: "alle" | "vegetarisch" | "vegan";
  difficulty: number;
  workTime: [number, number];
  totalTime: [number, number];
  allergies: string[];  // ← ZEILE 24: Muss vorhanden sein!
  ingredients: string;
}

// ╔═══════════════════════════════════════════════════════════════╗
// ║  ZEILE 65: INITIAL STATE - MUSS ALLERGIES HABEN             ║
// ╚═══════════════════════════════════════════════════════════════╝

const [filters, setFilters] = useState<RecipeFilters>({
  dietType: "alle",
  difficulty: 0,
  workTime: [0, 120],
  totalTime: [0, 240],
  allergies: [],        // ← ZEILE 65: Leer am Anfang
  ingredients: "",
});

// ───────────────────────────────────────────────────────────────
// ℹ️ HINWEIS: 
//    Dieser Code muss normalerweise NICHT geändert werden.
//    Falls du Standard-Allergien setzen willst:
//    allergies: ["Gluten", "Laktose"],  // Beispiel
// ───────────────────────────────────────────────────────────────
```

---

## 3️⃣ BACKEND: index.tsx (Hauptlogik)

### 📁 `supabase/functions/server/index.tsx`

```typescript
// ╔═══════════════════════════════════════════════════════════════╗
// ║  ZEILE 172-187: SQL SELECT - ALLERGENS HINZUFÜGEN           ║
// ╚═══════════════════════════════════════════════════════════════╝

let sqlQuery = supabase
  .from('test_recipes')
  .select(`
    recipe_id,
    name,
    description,
    instructions,
    vegan,
    vegetarian,
    difficulty,
    diet,
    image_url,
    prep_time,
    cook_time,
    total_time,
    servings,
    allergens,        // ← ZEILE 187: NEU HINZUFÜGEN!
    text_embedding,
    ingredients_embedding,
    created_at
  `);

// ───────────────────────────────────────────────────────────────
// 🔧 ÄNDERUNG ERFORDERLICH:
//    Füge "allergens," zur SELECT-Liste hinzu (Zeile 187)
//    
//    VORAUSSETZUNG: Datenbank muss allergens-Spalte haben!
//    Siehe Abschnitt 4 "Datenbank"
// ───────────────────────────────────────────────────────────────


// ╔═══════════════════════════════════════════════════════════════╗
// ║  ZEILE 295-310: RECIPE-OBJEKT - ALLERGENS ZURÜCKGEBEN       ║
// ╚═══════════════════════════════════════════════════════════════╝

return {
  id: recipe.recipe_id,
  name: recipe.name,
  description: recipe.description || "Keine Beschreibung verfügbar",
  fullDescription: recipe.description || "Keine Beschreibung verfügbar",
  difficulty: difficulty,
  workTime: workTime,
  totalTime: totalTime,
  servings: servings,
  ingredients: ingredients,
  instructions: instructions,
  isVegan: recipe.vegan || false,
  isVegetarian: recipe.vegetarian || false,
  allergens: recipe.allergens || [], // ← ZEILE 308: NEU HINZUFÜGEN!
  imageUrl: recipe.image_url
};

// ───────────────────────────────────────────────────────────────
// 🔧 ÄNDERUNG ERFORDERLICH:
//    Füge diese Zeile vor imageUrl hinzu:
//    allergens: recipe.allergens || [],
// ───────────────────────────────────────────────────────────────


// ╔═══════════════════════════════════════════════════════════════╗
// ║  ZEILE 335-360: FILTER-LOGIK - ALLERGIEN FILTERN            ║
// ╚═══════════════════════════════════════════════════════════════╝

// AKTUELLER CODE (Zeile ~348):
// TODO: Add allergy filtering logic here

// ───────────────────────────────────────────────────────────────
// 🔧 ERSETZE DEN TODO-KOMMENTAR MIT DIESEM CODE:
// ───────────────────────────────────────────────────────────────

// Allergies filter
if (filters?.allergies && filters.allergies.length > 0) {
  console.log(`🏷️ Filtering by allergies: ${filters.allergies.join(', ')}`);
  
  // Filter out recipes that contain ANY of the selected allergens
  filteredRecipes = filteredRecipes.filter(recipe => {
    // Skip recipes without allergen data
    if (!recipe.allergens || !Array.isArray(recipe.allergens)) {
      return true; // Include recipes without allergen info
    }
    
    // Check if recipe contains any of the user's selected allergens
    const hasConflict = filters.allergies.some(allergy => 
      recipe.allergens.includes(allergy)
    );
    
    // Return true if NO conflict (recipe is safe)
    return !hasConflict;
  });
  
  console.log(`✅ After allergy filter: ${filteredRecipes.length} recipes remaining`);
}

// ───────────────────────────────────────────────────────────────
// 💡 ERKLÄRUNG DER LOGIK:
//    
//    1. Prüfe ob Allergien ausgewählt wurden
//    2. Für jedes Rezept:
//       - Prüfe ob es Allergen-Daten hat
//       - Prüfe ob IRGENDEIN ausgewähltes Allergen im Rezept ist
//       - Falls JA → Rezept ausschließen (hasConflict = true)
//       - Falls NEIN → Rezept behalten (hasConflict = false)
//    3. Gib gefilterte Liste zurück
//
//    BEISPIEL:
//    - User wählt: ["Laktose", "Gluten"]
//    - Rezept A hat: ["Laktose"] → GEFILTERT (Konflikt!)
//    - Rezept B hat: [] → BEHALTEN (kein Konflikt)
//    - Rezept C hat: ["Nüsse"] → BEHALTEN (kein Konflikt)
// ───────────────────────────────────────────────────────────────
```

---

## 4️⃣ DATENBANK: Schema erweitern

### 📁 `database-schema.sql`

```sql
-- ═══════════════════════════════════════════════════════════════
--  OPTION A: EINFACHES ARRAY-FELD (EMPFOHLEN FÜR PROTOTYP)
-- ═══════════════════════════════════════════════════════════════

-- Füge Allergen-Spalte zur bestehenden Tabelle hinzu
ALTER TABLE test_recipes 
ADD COLUMN allergens text[];

-- Setze Beispiel-Werte
UPDATE test_recipes 
SET allergens = ARRAY['Laktose', 'Gluten']
WHERE name = 'Cremige Tomatensuppe';

UPDATE test_recipes 
SET allergens = ARRAY[]
WHERE vegan = true;  -- Vegane Rezepte haben meist keine tierischen Allergene

-- ───────────────────────────────────────────────────────────────
-- 💡 VORTEILE:
--    ✅ Schnell & einfach
--    ✅ Keine zusätzlichen Tabellen
--    ✅ Perfekt für Prototypen
--
-- ⚠️ NACHTEILE:
--    ⚠️ Keine Validierung (Tippfehler möglich)
--    ⚠️ Schwerer skalierbar
-- ───────────────────────────────────────────────────────────────


-- ═══════════════════════════════════════════════════════════════
--  OPTION B: SEPARATE ALLERGEN-TABELLE (EMPFOHLEN FÜR PRODUKTION)
-- ═══════════════════════════════════════════════════════════════

-- Schritt 1: Allergen-Master-Tabelle erstellen
CREATE TABLE allergens (
  allergen_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,  -- Optional: Beschreibung des Allergens
  icon text          -- Optional: Icon-Name
);

-- Schritt 2: Verknüpfungs-Tabelle erstellen
CREATE TABLE recipe_allergens (
  recipe_id uuid REFERENCES test_recipes(recipe_id) ON DELETE CASCADE,
  allergen_id uuid REFERENCES allergens(allergen_id) ON DELETE CASCADE,
  PRIMARY KEY (recipe_id, allergen_id)
);

-- Schritt 3: Standard-Allergene einfügen
INSERT INTO allergens (name, description) VALUES
  ('Gluten', 'Enthalten in Weizen, Roggen, Gerste'),
  ('Laktose', 'Milchzucker in Milchprodukten'),
  ('Nüsse', 'Baum- und Erdnüsse'),
  ('Soja', 'Sojaprodukte'),
  ('Eier', 'Hühnereier und Ei-Produkte'),
  ('Fisch', 'Alle Fischarten'),
  ('Schalentiere', 'Krebstiere, Muscheln, Garnelen'),
  ('Sesam', 'Sesamsamen und -öl');

-- Schritt 4: Rezept-Allergen-Verknüpfungen erstellen
INSERT INTO recipe_allergens (recipe_id, allergen_id)
SELECT 
  (SELECT recipe_id FROM test_recipes WHERE name = 'Cremige Tomatensuppe'),
  allergen_id
FROM allergens
WHERE name IN ('Laktose', 'Gluten');

-- ───────────────────────────────────────────────────────────────
-- 💡 VORTEILE:
--    ✅ Validierung durch Fremdschlüssel
--    ✅ Wiederverwendbare Allergen-Liste
--    ✅ Einfache Erweiterung (z.B. Icons, Beschreibungen)
--    ✅ Bessere Performance bei vielen Rezepten
--
-- ⚠️ NACHTEILE:
--    ⚠️ Komplexer zu implementieren
--    ⚠️ Erfordert JOIN-Queries
-- ───────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════
--  QUERY ZUM ABRUFEN (OPTION B)
-- ═══════════════════════════════════════════════════════════════

-- Backend muss angepasst werden für Option B:
-- Zeile ~260-270 in index.tsx

const { data: recipeAllergens, error: allergenError } = await supabase
  .from('recipe_allergens')
  .select(`
    allergens!inner (
      name
    )
  `)
  .eq('recipe_id', recipe.recipe_id);

const allergens = recipeAllergens?.map(ra => ra.allergens.name) || [];
```

---

## 5️⃣ DEPLOYMENT: Checkliste

```bash
# ══════════════════════════════════════════════════════════════
#  SCHRITT-FÜR-SCHRITT DEPLOYMENT
# ══════════════════════════════════════════════════════════════

# 1. Frontend-Änderungen (Sidebar.tsx)
#    ✅ Allergien-Liste angepasst? (Zeile 96-105)
#    → Keine weiteren Schritte nötig, Frontend lädt automatisch neu

# 2. Datenbank-Änderungen
#    ✅ Schema erweitert? (ALTER TABLE oder CREATE TABLE)
#    ✅ Beispiel-Daten eingefügt?
#    → Führe SQL in Supabase SQL Editor aus

# 3. Backend-Änderungen (index.tsx)
#    ✅ SELECT-Query erweitert? (Zeile ~187)
#    ✅ Recipe-Objekt erweitert? (Zeile ~308)
#    ✅ Filter-Logik implementiert? (Zeile ~350)
#    → Deploye Edge Function:

supabase functions deploy make-server-b187574e

# 4. Testen
#    ✅ Öffne App im Browser
#    ✅ Wähle Allergie aus
#    ✅ Suche nach Rezept
#    ✅ Überprüfe Ergebnisse in Console (F12)

# ══════════════════════════════════════════════════════════════
```

---

## 6️⃣ TESTING: Validierungs-Queries

```sql
-- ═══════════════════════════════════════════════════════════════
--  ÜBERPRÜFE ALLERGEN-DATEN IN DATENBANK
-- ═══════════════════════════════════════════════════════════════

-- Test 1: Zeige alle Rezepte mit Allergenen (Option A)
SELECT 
  name, 
  allergens,
  CASE 
    WHEN allergens IS NULL THEN '❌ Keine Daten'
    WHEN array_length(allergens, 1) = 0 THEN '✅ Keine Allergene'
    ELSE '⚠️ ' || array_to_string(allergens, ', ')
  END as status
FROM test_recipes
ORDER BY name;


-- Test 2: Zeige alle Rezepte mit Allergenen (Option B)
SELECT 
  r.name,
  COALESCE(array_agg(a.name) FILTER (WHERE a.name IS NOT NULL), ARRAY[]::text[]) as allergens
FROM test_recipes r
LEFT JOIN recipe_allergens ra ON r.recipe_id = ra.recipe_id
LEFT JOIN allergens a ON ra.allergen_id = a.allergen_id
GROUP BY r.recipe_id, r.name
ORDER BY r.name;


-- Test 3: Finde Rezepte OHNE bestimmte Allergene
SELECT name, allergens
FROM test_recipes
WHERE NOT 'Laktose' = ANY(allergens) OR allergens IS NULL
ORDER BY name;


-- Test 4: Statistik
SELECT 
  UNNEST(allergens) as allergen,
  COUNT(*) as recipe_count
FROM test_recipes
WHERE allergens IS NOT NULL
GROUP BY allergen
ORDER BY recipe_count DESC;
```

---

## 7️⃣ DEBUGGING: Häufige Probleme

```typescript
// ═══════════════════════════════════════════════════════════════
//  PROBLEM 1: "allergens is undefined" in Backend
// ═══════════════════════════════════════════════════════════════

// URSACHE: 
//    - Feld nicht in SELECT-Query (Zeile ~187)
//    - Oder Spalte existiert nicht in DB

// LÖSUNG:
//    1. Prüfe SELECT in index.tsx Zeile ~187
//    2. Prüfe DB mit: SELECT * FROM test_recipes LIMIT 1;
//    3. Falls Spalte fehlt: ALTER TABLE test_recipes ADD COLUMN allergens text[];


// ═══════════════════════════════════════════════════════════════
//  PROBLEM 2: Filter funktioniert nicht
// ═══════════════════════════════════════════════════════════════

// URSACHE:
//    - Backend-Code nicht deployed
//    - Filter-Logik nicht implementiert

// LÖSUNG:
//    1. Prüfe Browser-Console auf Errors
//    2. Prüfe Supabase Function Logs
//    3. Deploye neu: supabase functions deploy make-server-b187574e


// ═══════════════════════════════════════════════════════════════
//  PROBLEM 3: Alle Rezepte werden gefiltert
// ═══════════════════════════════════════════════════════════════

// URSACHE:
//    - Alle Rezepte haben Allergene eingetragen
//    - Oder allergens ist NULL

// LÖSUNG:
//    UPDATE test_recipes SET allergens = ARRAY[] WHERE allergens IS NULL;


// ═══════════════════════════════════════════════════════════════
//  PROBLEM 4: Checkbox-State wird nicht gespeichert
// ═══════════════════════════════════════════════════════════════

// URSACHE:
//    - handleAllergyToggle nicht korrekt (Zeile ~77)
//    - notifyFilterChange nicht aufgerufen

// LÖSUNG:
//    - Überprüfe Code in Sidebar.tsx Zeile 77-83
//    - Console.log in handleAllergyToggle einfügen zum Debuggen
```

---

## 📋 ZUSAMMENFASSUNG: 3-Schritte-Anleitung

### ✅ Schritt 1: Frontend (5 Minuten)
```typescript
// Datei: components/Sidebar.tsx, Zeile 96
const commonAllergies = [
  "Gluten", "Laktose", "Nüsse", "Soja",
  "Eier", "Fisch", "Schalentiere", "Sesam",
  "Senf", "Sellerie" // ← Neue Allergien hier hinzufügen
];
```

### ✅ Schritt 2: Datenbank (5 Minuten)
```sql
-- Supabase SQL Editor
ALTER TABLE test_recipes ADD COLUMN allergens text[];

UPDATE test_recipes SET allergens = ARRAY['Laktose'] 
WHERE name = 'Cremige Tomatensuppe';
```

### ✅ Schritt 3: Backend (10 Minuten)
```typescript
// 1. Zeile ~187: SELECT erweitern
allergens,

// 2. Zeile ~308: Recipe-Objekt erweitern
allergens: recipe.allergens || [],

// 3. Zeile ~350: Filter-Logik implementieren
if (filters?.allergies && filters.allergies.length > 0) {
  filteredRecipes = filteredRecipes.filter(recipe => {
    const hasConflict = filters.allergies.some(allergy => 
      recipe.allergens?.includes(allergy)
    );
    return !hasConflict;
  });
}

// 4. Deployen
// Terminal: supabase functions deploy make-server-b187574e
```

---

**Erstellt:** November 2025  
**Version:** 2.0  
**Status:** ✅ Vollständige Code-Markierung mit Zeilennummern
