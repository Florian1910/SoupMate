# 🗄️ Supabase Datenbank-Integration - SoupMate

## ✅ Integration abgeschlossen!

Die SoupMate-Anwendung ist jetzt vollständig mit deiner Supabase-Datenbank integriert und nutzt **semantische Suche** mit Embeddings.

---

## 📊 Datenbankschema

Das System nutzt drei Tabellen für die semantische Rezeptsuche:

### 1️⃣ `test_recipes` - Rezept-Stammdaten
Speichert alle Rezeptinformationen inklusive Embeddings.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `recipe_id` | uuid | Primärschlüssel |
| `name` | text | Rezeptname |
| `description` | text | Kurzbeschreibung |
| `instructions` | text | Zubereitungsschritte |
| `vegan` | boolean | Ist das Rezept vegan? |
| `vegetarian` | boolean | Ist das Rezept vegetarisch? |
| `difficulty` | varchar(50) | Schwierigkeit (easy, medium, hard) |
| `diet` | varchar(50) | Ernährungsart (z.B. LowCal) |
| `image_url` | text | Bild-URL |
| `text_embedding` | vector(3) | Embedding des Rezepttexts |
| `ingredients_embedding` | vector(3) | Aggregiertes Zutaten-Embedding |
| `created_at` | timestamptz | Erstellungszeitpunkt |
| `updated_at` | timestamptz | Letzte Aktualisierung |

### 2️⃣ `test_ingredients` - Zutaten
Enthält alle verfügbaren Zutaten mit Embeddings.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `ingredient_id` | uuid | Primärschlüssel |
| `name` | text | Zutatenname |
| `name_embedding` | vector(3) | Embedding des Zutatenbegriffs |

### 3️⃣ `test_recipe_ingredients` - Rezept-Zutaten-Verknüpfung
N:M-Beziehung zwischen Rezepten und Zutaten.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `recipe_id` | uuid | FK auf test_recipes |
| `ingredient_id` | uuid | FK auf test_ingredients |
| `quantity` | text | Mengenangabe (z.B. "200g") |

---

## 🔍 Semantische Suche - Funktionsweise

### Aktuelles System (Demo-Version)
- **Embedding-Dimensionen**: 3D (für einfaches Testing)
- **Suchmethode**: Kombinierte Suche
  - 60% Gewichtung auf Zutaten-Ähnlichkeit
  - 40% Gewichtung auf Text-Ähnlichkeit
- **Distanz-Metrik**: Euklidische Distanz
- **Embedding-Generierung**: Mock-Hashing (Demo)

### Backend-Ablauf

```
1. Suchbegriff eingeben
   ↓
2. Embedding generieren (aktuell: Mock-Hash-Funktion)
   ↓
3. Filter anwenden (vegan/vegetarisch, Schwierigkeit)
   ↓
4. Semantische Ähnlichkeit berechnen
   Score = 0.6 × Zutaten-Distanz + 0.4 × Text-Distanz
   ↓
5. Nach Ähnlichkeit sortieren (niedrigster Score = beste Übereinstimmung)
   ↓
6. Top 5 Rezepte zurückgeben
   ↓
7. Zusätzliche Filter anwenden (Zeit, Allergien, Zutaten)
   ↓
8. Ergebnisse an Frontend senden
```

---

## 🚀 Erweiterte Integration für Produktion

### ⚠️ Wichtig: Aktuelle Demo-Einschränkungen

Die aktuelle Implementierung nutzt **3-dimensionale Embeddings** und **Mock-Hashing** für Demo-Zwecke. Für die produktive Nutzung solltest du folgende Upgrades durchführen:

### 1️⃣ Echte Embedding-Generierung

Ersetze die `generateMockEmbedding()` Funktion in `/supabase/functions/server/index.tsx`:

#### Option A: OpenAI Embeddings (Empfohlen)
```typescript
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small', // 1536 dimensions
      input: text
    })
  });
  
  const data = await response.json();
  return data.data[0].embedding;
}
```

#### Option B: Voyage AI Embeddings
```typescript
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('VOYAGE_API_KEY')}`
    },
    body: JSON.stringify({
      model: 'voyage-2',
      input: text
    })
  });
  
  const data = await response.json();
  return data.data[0].embedding;
}
```

#### Option C: Gemini Embeddings
```typescript
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/embedding-001:embedContent?key=${Deno.env.get('GEMINI_API_KEY')}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/embedding-001',
        content: { parts: [{ text }] }
      })
    }
  );
  
  const data = await response.json();
  return data.embedding.values;
}
```

### 2️⃣ Datenbank-Schema für Produktion aktualisieren

Wenn du auf hochdimensionale Embeddings (768-1536 Dimensionen) umsteigst:

```sql
-- Ändere vector(3) zu vector(1536) für OpenAI
-- oder vector(768) für andere Modelle

ALTER TABLE test_recipes 
  ALTER COLUMN text_embedding TYPE vector(1536),
  ALTER COLUMN ingredients_embedding TYPE vector(1536);

ALTER TABLE test_ingredients 
  ALTER COLUMN name_embedding TYPE vector(1536);

-- Erstelle Indizes für schnellere Suche
CREATE INDEX ON test_recipes 
  USING ivfflat (text_embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX ON test_recipes 
  USING ivfflat (ingredients_embedding vector_cosine_ops)
  WITH (lists = 100);
```

### 3️⃣ Erweitere das Schema um fehlende Felder

Füge diese Spalten für bessere Filterung hinzu:

```sql
-- Zeiten hinzufügen
ALTER TABLE test_recipes
  ADD COLUMN work_time INTEGER, -- Arbeitszeit in Minuten
  ADD COLUMN total_time INTEGER, -- Gesamtzeit in Minuten
  ADD COLUMN allergens TEXT[]; -- Array von Allergenen

-- Beispiel für Allergene: 
-- UPDATE test_recipes 
-- SET allergens = ARRAY['Gluten', 'Laktose'] 
-- WHERE recipe_id = '...';
```

### 4️⃣ Optimierte Suche mit pgvector

Nutze den `<=>` Operator für Cosine-Similarity (statt euklidischer Distanz):

```typescript
// In der Supabase-Abfrage
const { data } = await supabase.rpc('semantic_search', {
  query_embedding: queryEmbedding,
  match_threshold: 0.8,
  match_count: 10
});
```

Erstelle dafür eine PostgreSQL-Funktion:

```sql
CREATE OR REPLACE FUNCTION semantic_search(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  recipe_id uuid,
  name text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    recipe_id,
    name,
    1 - (ingredients_embedding <=> query_embedding) AS similarity
  FROM test_recipes
  WHERE 1 - (ingredients_embedding <=> query_embedding) > match_threshold
  ORDER BY ingredients_embedding <=> query_embedding
  LIMIT match_count;
$$;
```

---

## 🔧 Konfiguration

### Umgebungsvariablen setzen

Für die Supabase Edge Functions:

```bash
# Supabase CLI verwenden
supabase secrets set OPENAI_API_KEY=sk-...
# ODER
supabase secrets set VOYAGE_API_KEY=pa-...
# ODER
supabase secrets set GEMINI_API_KEY=...
```

### Frontend-Konfiguration

Die Datei `/config.tsx` ist bereits korrekt konfiguriert:
- ✅ `useMockData: false` - Echte Datenbanksuche aktiv
- ✅ `baseUrl` zeigt auf deine Supabase-Instanz

---

## 📝 Rezepte zur Datenbank hinzufügen

### Manuell via Supabase Dashboard

1. Gehe zu deinem Supabase-Dashboard
2. Navigiere zu "Table Editor"
3. Füge Rezepte in `test_recipes` ein
4. Füge Zutaten in `test_ingredients` ein
5. Verknüpfe sie in `test_recipe_ingredients`

### Programmatisch via SQL

```sql
-- Beispiel: Neues Rezept hinzufügen
INSERT INTO test_recipes (
  recipe_id, 
  name, 
  description, 
  instructions,
  vegan, 
  vegetarian, 
  difficulty,
  text_embedding,
  ingredients_embedding
) VALUES (
  gen_random_uuid(),
  'Cremige Tomatensuppe',
  'Eine klassische Tomatensuppe',
  'Zwiebeln anschwitzen. Tomaten hinzufügen. Pürieren.',
  false,
  true,
  'easy',
  '[0.1, 0.2, 0.3]'::vector,
  '[0.15, 0.25, 0.28]'::vector
);
```

### Programmatisch via API

Erstelle einen neuen Endpoint in `/supabase/functions/server/index.tsx`:

```typescript
app.post("/make-server-b187574e/admin/recipes", async (c) => {
  const { name, description, instructions, vegan, vegetarian, difficulty, ingredients } = await c.req.json();
  
  // Generiere Embeddings
  const textEmbedding = await generateEmbedding(`${name} ${description} ${instructions}`);
  const ingredientTexts = ingredients.map((i: any) => i.name).join(' ');
  const ingredientsEmbedding = await generateEmbedding(ingredientTexts);
  
  // Speichere Rezept
  const { data: recipe, error } = await supabase
    .from('test_recipes')
    .insert({
      name,
      description,
      instructions,
      vegan,
      vegetarian,
      difficulty,
      text_embedding: textEmbedding,
      ingredients_embedding: ingredientsEmbedding
    })
    .select()
    .single();
    
  // Speichere Zutaten...
  
  return c.json({ success: true, recipe });
});
```

---

## 🧪 Testing

### Test 1: Basis-Suche
```bash
curl -X POST https://brssalvqnbxgaiwmycpf.supabase.co/functions/v1/make-server-b187574e/search \
  -H "Content-Type: application/json" \
  -d '{"query": "Tomatensuppe", "filters": {}}'
```

### Test 2: Mit Filtern
```bash
curl -X POST https://brssalvqnbxgaiwmycpf.supabase.co/functions/v1/make-server-b187574e/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Suppe", 
    "filters": {
      "dietType": "vegan",
      "difficulty": 2
    }
  }'
```

---

## 🐛 Troubleshooting

### Problem: "Keine Rezepte gefunden"
**Lösung**: Füge Rezepte zur Datenbank hinzu (siehe oben)

### Problem: "Database query failed"
**Lösung**: Überprüfe die Supabase-Credentials in den Umgebungsvariablen

### Problem: Embeddings funktionieren nicht
**Lösung**: 
1. Überprüfe, ob `vector` Extension in Supabase aktiviert ist
2. Stelle sicher, dass die Dimensionen übereinstimmen (aktuell: 3)

### Problem: Langsame Suche
**Lösung**: Erstelle Indizes (siehe "Datenbank-Schema für Produktion")

---

## 📚 Weitere Ressourcen

- [Supabase Vector Documentation](https://supabase.com/docs/guides/ai/vector-columns)
- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)

---

## ✅ Nächste Schritte

1. ✅ **Datenbank ist integriert** - Semantische Suche funktioniert
2. 🔄 **Rezepte hinzufügen** - Fülle deine Datenbank mit Rezepten
3. 🚀 **Embedding-Modell upgraden** - Wechsle von Mock zu echten Embeddings (768-1536D)
4. 📊 **Schema erweitern** - Füge `work_time`, `total_time`, `allergens` hinzu
5. ⚡ **Performance optimieren** - Erstelle IVFFlat-Indizes
6. 🎨 **UI-Verbesserungen** - Zeige Ähnlichkeits-Scores, Rezeptbilder, etc.

Viel Erfolg mit SoupMate! 🍲
