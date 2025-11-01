# 🏷️ Allergien-Filter: Code-Stellen zum Anpassen

Diese Anleitung zeigt dir **alle relevanten Code-Stellen**, um den Allergien-Filter anzupassen.

---

## 📍 Übersicht: Wo wird was geändert?

| Datei | Was wird geändert | Zweck |
|-------|-------------------|-------|
| `components/Sidebar.tsx` | ✅ Allergien-Liste | Frontend: Anzeige der Checkboxen |
| `App.tsx` | ✅ Filter-State | Frontend: State-Management |
| `supabase/functions/server/index.tsx` | ✅ Filter-Logik | Backend: Filterung der Rezepte |
| `database-schema.sql` | 🔮 Allergen-Tabelle | Datenbank: Struktur (optional) |

---

## 1️⃣ FRONTEND: Allergien-Liste ändern

### 📁 Datei: `components/Sidebar.tsx`

**Zeilen: ~150-160** (suche nach `commonAllergies`)

```typescript
// ========================================================================
// 🏷️ ALLERGIEN-LISTE - HIER ALLERGIEN HINZUFÜGEN/ENTFERNEN
// ========================================================================
const commonAllergies = [
  "Gluten",        // ← Hier kannst du Allergien ändern
  "Laktose",       // ← Oder neue hinzufügen
  "Nüsse",
  "Soja",
  "Eier",
  "Fisch",
  "Schalentiere",
  "Sesam",
  // "Senf",       // ← Neue Allergie hinzufügen (auskommentiert)
  // "Sellerie",   // ← Weitere Optionen
];
// ========================================================================

// Render-Code für Checkboxen (ca. Zeile 280-300)
{commonAllergies.map((allergy) => (
  <div key={allergy} className="flex items-center space-x-2">
    <Checkbox
      id={`allergy-${allergy}`}
      checked={filters.allergies.includes(allergy)}
      onCheckedChange={(checked) => {
        const newAllergies = checked
          ? [...filters.allergies, allergy]
          : filters.allergies.filter((a) => a !== allergy);
        onFilterChange({ allergies: newAllergies });
      }}
    />
    <label htmlFor={`allergy-${allergy}`}>{allergy}</label>
  </div>
))}
```

**Änderungen:**
- ✅ Allergien zur Liste hinzufügen/entfernen
- ✅ Automatische Checkbox-Generierung
- ✅ State wird automatisch aktualisiert

---

## 2️⃣ FRONTEND: Filter-State (optional prüfen)

### 📁 Datei: `App.tsx`

**Zeilen: ~30-40** (suche nach `RecipeFilters` interface)

```typescript
// ========================================================================
// 🔧 FILTER-INTERFACE - PRÜFE OB ALLERGIES DEFINIERT IST
// ========================================================================
interface RecipeFilters {
  dietType: "alle" | "vegetarisch" | "vegan";
  difficulty: number;
  workTime: [number, number];
  totalTime: [number, number];
  allergies: string[];  // ← Allergien als String-Array
  ingredients: string;
}
// ========================================================================

// Initial State (ca. Zeile 60-70)
const [filters, setFilters] = useState<RecipeFilters>({
  dietType: "alle",
  difficulty: 0,
  workTime: [0, 120],
  totalTime: [0, 240],
  allergies: [],  // ← Leer am Anfang
  ingredients: "",
});
```

**Info:** Dieser Code muss normalerweise **nicht geändert** werden, außer du möchtest Standard-Allergien vordefinieren.

---

## 3️⃣ BACKEND: Filter-Logik implementieren

### 📁 Datei: `supabase/functions/server/index.tsx`

**Zeilen: ~340-380** (suche nach "Apply additional filters")

```typescript
// ========================================================================
// STEP 5: Apply additional filters (time, allergies, ingredients)
// ========================================================================
let filteredRecipes = recipesWithDetails;

// Work time filter
if (filters?.workTime && Array.isArray(filters.workTime)) {
  if (filters.workTime[0] !== 0 || filters.workTime[1] !== 120) {
    filteredRecipes = filteredRecipes.filter(r => 
      r.workTime >= filters.workTime[0] && r.workTime <= filters.workTime[1]
    );
  }
}

// Total time filter
if (filters?.totalTime && Array.isArray(filters.totalTime)) {
  if (filters.totalTime[0] !== 0 || filters.totalTime[1] !== 240) {
    filteredRecipes = filteredRecipes.filter(r => 
      r.totalTime >= filters.totalTime[0] && r.totalTime <= filters.totalTime[1]
    );
  }
}

// ========================================================================
// 🏷️ ALLERGIEN-FILTER - HIER FILTER-LOGIK IMPLEMENTIEREN
// ========================================================================
// WICHTIG: Derzeit ist der Allergien-Filter NICHT implementiert!
// TODO: Füge hier die Filter-Logik hinzu

if (filters?.allergies && filters.allergies.length > 0) {
  console.log(`🏷️ Filtering by allergies: ${filters.allergies.join(', ')}`);
  
  // OPTION 1: Filter in Backend (benötigt allergens-Feld im Recipe)
  // --------------------------------------------------------------------
  // filteredRecipes = filteredRecipes.filter(recipe => {
  //   // Annahme: recipe.allergens ist ein Array von Strings
  //   const hasConflict = filters.allergies.some(allergy => 
  //     recipe.allergens.includes(allergy)
  //   );
  //   return !hasConflict; // Nur Rezepte OHNE diese Allergene
  // });
  
  // OPTION 2: Datenbank-Query (effizienter für große Datenmengen)
  // --------------------------------------------------------------------
  // Nutze eine WHERE-Klausel in der SQL-Query (Zeile ~172-206)
  // if (filters?.allergies?.length > 0) {
  //   sqlQuery = sqlQuery.not('allergens', 'cs', `{${filters.allergies.join(',')}}`);
  // }
  
  // AKTUELL: Nur Logging (keine echte Filterung)
  console.log(`⚠️ Allergien-Filter ist noch nicht implementiert!`);
  console.log(`   → Siehe ALLERGIEN_FILTER_ANLEITUNG.md für Implementierung`);
}
// ========================================================================

// Ingredients filter (existing code)
if (filters?.ingredients && filters.ingredients.trim() !== "") {
  // ... existing code ...
}
```

---

## 4️⃣ DATENBANK: Allergen-Feld hinzufügen (Optional)

### Option A: Einfaches Array-Feld

**Füge zu `test_recipes` hinzu:**

```sql
-- In database-schema.sql oder via SQL Editor
ALTER TABLE test_recipes 
ADD COLUMN allergens text[]; -- PostgreSQL Array

-- Beispiel-Daten
UPDATE test_recipes 
SET allergens = ARRAY['Laktose', 'Gluten']
WHERE name = 'Cremige Tomatensuppe';

UPDATE test_recipes 
SET allergens = ARRAY[]
WHERE name = 'Karottensuppe mit Ingwer'; -- Vegan, keine Allergene
```

### Option B: Separate Allergen-Tabelle (Empfohlen für Produktion)

```sql
-- Allergen-Tabelle erstellen
CREATE TABLE allergens (
  allergen_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL -- z.B. "Gluten", "Laktose"
);

-- Verknüpfungs-Tabelle
CREATE TABLE recipe_allergens (
  recipe_id uuid REFERENCES test_recipes(recipe_id) ON DELETE CASCADE,
  allergen_id uuid REFERENCES allergens(allergen_id) ON DELETE CASCADE,
  PRIMARY KEY (recipe_id, allergen_id)
);

-- Beispiel-Daten
INSERT INTO allergens (name) VALUES
  ('Gluten'), ('Laktose'), ('Nüsse'), ('Soja'), 
  ('Eier'), ('Fisch'), ('Schalentiere'), ('Sesam');

-- Rezept-Allergen verknüpfen
INSERT INTO recipe_allergens (recipe_id, allergen_id)
SELECT 
  (SELECT recipe_id FROM test_recipes WHERE name = 'Cremige Tomatensuppe'),
  allergen_id
FROM allergens
WHERE name IN ('Laktose', 'Gluten');
```

---

## 5️⃣ BACKEND: Allergen-Daten laden

### 📁 Datei: `supabase/functions/server/index.tsx`

**Zeilen: ~260-310** (suche nach "Fetch ingredients for each recipe")

```typescript
// ========================================================================
// 🏷️ ALLERGENE LADEN - FÜGE DIES NACH DEM ZUTATEN-FETCH HINZU
// ========================================================================
const recipesWithDetails = await Promise.all(
  sortedRecipes.map(async (recipe: any) => {
    
    // Existing code: Fetch ingredients
    const { data: recipeIngredients, error: ingError } = await supabase
      .from('test_recipe_ingredients')
      .select(/* ... */);
    
    // ========================================================================
    // NEU: Fetch allergens (wenn separate Tabelle verwendet wird)
    // ========================================================================
    const { data: recipeAllergens, error: allergenError } = await supabase
      .from('recipe_allergens')
      .select(`
        allergens!inner (
          name
        )
      `)
      .eq('recipe_id', recipe.recipe_id);
    
    if (allergenError) {
      console.log(`⚠️ Error fetching allergens for recipe ${recipe.recipe_id}: ${allergenError.message}`);
    }
    
    // Extrahiere Allergen-Namen
    const allergens = recipeAllergens?.map(ra => ra.allergens.name) || [];
    // ========================================================================
    
    // ... existing instructions parsing ...
    
    return {
      id: recipe.recipe_id,
      name: recipe.name,
      // ... existing fields ...
      allergens: allergens, // ← FÜGE DIES HINZU
      imageUrl: recipe.image_url
    };
  })
);
```

**Alternative (wenn allergens als Array in test_recipes):**

```typescript
return {
  id: recipe.recipe_id,
  name: recipe.name,
  // ... existing fields ...
  allergens: recipe.allergens || [], // ← Direkt aus DB
  imageUrl: recipe.image_url
};
```

---

## 6️⃣ VOLLSTÄNDIGE IMPLEMENTIERUNG: Schritt-für-Schritt

### Schritt 1: Frontend anpassen (Sidebar.tsx)

```typescript
// Zeile ~150
const commonAllergies = [
  "Gluten",
  "Laktose",
  "Nüsse",
  "Soja",
  "Eier",
  "Fisch",
  "Schalentiere",
  "Sesam",
  "Senf",      // NEU
  "Sellerie",  // NEU
];
```

### Schritt 2: Datenbank erweitern

**Option A (Einfach):**
```sql
ALTER TABLE test_recipes ADD COLUMN allergens text[];

UPDATE test_recipes SET allergens = ARRAY['Laktose'] 
WHERE name = 'Cremige Tomatensuppe';

UPDATE test_recipes SET allergens = ARRAY[] 
WHERE vegan = true;
```

**Option B (Empfohlen):**
Siehe "Option B: Separate Allergen-Tabelle" oben.

### Schritt 3: Backend SQL-Query anpassen

```typescript
// Zeile ~172-186: Füge allergens zum SELECT hinzu
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
    allergens,        // ← NEU HINZUFÜGEN (wenn Option A)
    text_embedding,
    ingredients_embedding,
    created_at
  `);
```

### Schritt 4: Backend Filter-Logik implementieren

```typescript
// Zeile ~350: Ersetze den TODO-Kommentar
if (filters?.allergies && filters.allergies.length > 0) {
  console.log(`🏷️ Filtering by allergies: ${filters.allergies.join(', ')}`);
  
  filteredRecipes = filteredRecipes.filter(recipe => {
    // Nur Rezepte anzeigen, die KEINE der ausgewählten Allergene enthalten
    const hasConflict = filters.allergies.some(allergy => 
      recipe.allergens && recipe.allergens.includes(allergy)
    );
    return !hasConflict;
  });
  
  console.log(`✅ After allergy filter: ${filteredRecipes.length} recipes`);
}
```

### Schritt 5: Backend neu deployen

```bash
supabase functions deploy make-server-b187574e
```

### Schritt 6: Testen

1. Öffne die App
2. Öffne Sidebar → Allergien
3. Wähle z.B. "Laktose"
4. Suche nach "Suppe"
5. **Erwartetes Ergebnis:** Keine Rezepte mit Laktose (z.B. keine Tomatensuppe mit Sahne)

---

## 📋 Checkliste: Vollständige Implementierung

- [ ] **Frontend:** Allergien-Liste in `Sidebar.tsx` angepasst
- [ ] **Datenbank:** Allergen-Feld/Tabelle erstellt
- [ ] **Datenbank:** Beispiel-Daten für Allergene eingefügt
- [ ] **Backend:** SQL-Query um `allergens` erweitert (falls Option A)
- [ ] **Backend:** Allergen-Fetch implementiert (falls Option B)
- [ ] **Backend:** Filter-Logik implementiert (Zeile ~350)
- [ ] **Backend:** Edge Function neu deployed
- [ ] **Testing:** Filter getestet mit verschiedenen Allergien

---

## 🧪 Test-Queries

### Überprüfe Allergen-Daten:

```sql
-- Option A: Array-Feld
SELECT name, allergens 
FROM test_recipes
ORDER BY name;

-- Option B: Separate Tabelle
SELECT r.name, array_agg(a.name) as allergens
FROM test_recipes r
LEFT JOIN recipe_allergens ra ON r.recipe_id = ra.recipe_id
LEFT JOIN allergens a ON ra.allergen_id = a.allergen_id
GROUP BY r.recipe_id, r.name
ORDER BY r.name;
```

### Teste Filter manuell:

```sql
-- Zeige alle Rezepte OHNE Laktose
SELECT name, allergens
FROM test_recipes
WHERE NOT 'Laktose' = ANY(allergens) OR allergens IS NULL;

-- Zeige alle veganen Rezepte (sollten keine tierischen Allergene haben)
SELECT name, allergens, vegan
FROM test_recipes
WHERE vegan = true;
```

---

## 🎯 Beispiel-Implementierung (Komplett)

### Sidebar.tsx (Zeile ~150)
```typescript
const commonAllergies = [
  "Gluten", "Laktose", "Nüsse", "Soja", 
  "Eier", "Fisch", "Schalentiere", "Sesam"
];
```

### database-schema.sql
```sql
ALTER TABLE test_recipes ADD COLUMN allergens text[];
```

### sample-data-v2.sql (Beispiel-Rezept)
```sql
INSERT INTO test_recipes (
  name, allergens, -- ...
) VALUES (
  'Tomatensuppe', 
  ARRAY['Laktose', 'Gluten'], 
  -- ...
);
```

### index.tsx (Backend, Zeile ~175)
```typescript
.select(`
  recipe_id, name, ..., allergens, ...
`)
```

### index.tsx (Backend, Zeile ~295)
```typescript
return {
  // ... existing fields ...
  allergens: recipe.allergens || [],
};
```

### index.tsx (Backend, Zeile ~350)
```typescript
if (filters?.allergies && filters.allergies.length > 0) {
  filteredRecipes = filteredRecipes.filter(recipe => {
    const hasConflict = filters.allergies.some(allergy => 
      recipe.allergens && recipe.allergens.includes(allergy)
    );
    return !hasConflict;
  });
}
```

---

## 🚨 Häufige Fehler

### Fehler 1: "allergens is undefined"
**Ursache:** Feld nicht in SQL SELECT  
**Lösung:** Zeile ~175 in index.tsx ergänzen

### Fehler 2: "Filter funktioniert nicht"
**Ursache:** Backend-Code nicht deployed  
**Lösung:** `supabase functions deploy make-server-b187574e`

### Fehler 3: "Alle Rezepte werden gefiltert"
**Ursache:** Alle Rezepte haben Allergene eingetragen  
**Lösung:** Setze `allergens = ARRAY[]` für allergenfreie Rezepte

---

## 📚 Weiterführende Tipps

### Multi-Allergen-Filter (UND vs. ODER):

```typescript
// ODER-Logik (Aktuell): Filtere wenn IRGENDEIN Allergen zutrifft
const hasConflict = filters.allergies.some(allergy => 
  recipe.allergens.includes(allergy)
);

// UND-Logik: Filtere wenn ALLE Allergene zutreffen
const hasAllConflicts = filters.allergies.every(allergy => 
  recipe.allergens.includes(allergy)
);
```

### Performance-Optimierung:

Für große Datenmengen solltest du die Filterung in der SQL-Query machen:

```typescript
// In SQL-Query (Zeile ~195)
if (filters?.allergies?.length > 0) {
  // PostgreSQL Array-Overlap-Operator
  sqlQuery = sqlQuery.not('allergens', 'ov', filters.allergies);
}
```

---

**Erstellt:** November 2025  
**Version:** 2.0  
**Status:** ✅ Vollständige Anleitung
