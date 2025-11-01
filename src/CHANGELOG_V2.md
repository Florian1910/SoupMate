# 📋 Changelog: SoupMate v2.0

## Version 2.0 - November 2025

### 🎉 Zusammenfassung

Vollständiges Datenbank-Upgrade mit erweiterten Feldern, verbesserter UI und streamlined Filter-System.

---

## 🗄️ Datenbank-Änderungen

### Neue Felder in `test_recipes`:

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `prep_time` | int | Arbeitszeit in Minuten (NEU) |
| `cook_time` | int | Kochzeit in Minuten (NEU) |
| `total_time` | int | Gesamtzeit in Minuten (NEU) |
| `servings` | int | Anzahl der Portionen (NEU) |
| `diet` | varchar(50) | Ernährungstyp (NEU) |

### Geänderte Felder:

| Feld | Alt | Neu |
|------|-----|-----|
| `difficulty` | varchar ('easy', 'medium', 'hard') | int (1-5) |

### Neue Tabellen:

1. **`user_preferences`** - Benutzerpräferenzen
   - `user_id`, `is_vegan`, `is_vegetarian`, `diet_type`, `allergies`

2. **`user_favorites`** - Benutzer-Favoriten
   - `user_id`, `recipe_id`, `created_at`

### Trigger & Funktionen:

- ✅ `refresh_test_recipe_ingredients_embedding()` - Automatische Embedding-Aggregation
- ✅ `t_test_refresh_ing_embedding_i` - Trigger bei Zutaten-Änderungen

---

## 🎨 UI/UX-Änderungen

### Sidebar-Filter:

**Entfernt:**
- ❌ Quick-Filter (Schnell, Vegan, Gourmet)
- ❌ Personenanzahl-Filter
- ❌ Filter-Chips unter der Suchleiste

**Hinzugefügt:**
- ✅ Icons für Ernährungsfilter:
  - 🍴 Alles (orange Utensils-Icon)
  - 🥬 Vegetarisch (hellgrünes Leaf-Icon)
  - 🌱 Vegan (grünes Leaf-Icon)

**Verbessert:**
- ✨ Cleaner Look ohne redundante Filter-Chips
- ✨ Bessere visuelle Hierarchie
- ✨ Kompaktere Anzeige

### Design:

- Behält Orange-Gradient-Theme
- Verbesserte Icon-Darstellung mit Hover-Effekten
- Responsive Button-Layouts

---

## 🔧 Backend-Änderungen

### `/supabase/functions/server/index.tsx`:

**Geändert:**
```typescript
// ALT: difficulty als varchar
const difficultyMap = {
  'easy': 2, 'medium': 3, 'hard': 4
};
sqlQuery.eq('difficulty', difficultyMap[filters.difficulty]);

// NEU: difficulty als int
sqlQuery.lte('difficulty', filters.difficulty);
```

**Hinzugefügt:**
```typescript
// Neue Felder aus DB nutzen mit Fallbacks
const totalTime = recipe.total_time || 
  (recipe.prep_time || 15) + (recipe.cook_time || 25);
const workTime = recipe.prep_time || estimateWorkTime(...);
const servings = recipe.servings || 4;
```

**Entfernt:**
```typescript
// servings aus Filtern entfernt
// - filters?.servings wird nicht mehr verwendet
```

---

## 📝 Neue Dokumentation

### Neu hinzugefügt:

1. **`database-schema.sql`** - Vollständiges Schema v2.0
   - Alle Tabellen mit erweiterten Feldern
   - Trigger-Definitionen
   - Kommentierte Beispiel-Queries

2. **`sample-data-v2.sql`** - Demo-Daten für v2.0
   - 5 vollständige Rezepte
   - 25 Zutaten mit Embeddings
   - Automatische Verknüpfungen

3. **`DATENBANK_SETUP_V2.md`** - Vollständige Setup-Anleitung
   - Schritt-für-Schritt Anweisungen
   - Beispiel-Queries
   - Troubleshooting

4. **`MIGRATION_GUIDE.md`** - Migrations-Anleitung
   - v1.0 → v2.0 Migration
   - Datenerhaltung
   - Rollback-Optionen

5. **`QUICKSTART_V2.md`** - 5-Minuten Quick-Start
   - Schnelleinstieg
   - Testing-Anweisungen
   - Debugging-Tipps

6. **`CHANGELOG_V2.md`** - Diese Datei

### Aktualisiert:

- **`sample-recipes.sql`** - Markiert als veraltet, verweist auf v2

---

## 🗑️ Entfernte Dateien

- ❌ `/components/FilterChips.tsx` - Nicht mehr benötigt

---

## 🔄 Migrations-Pfad

### Option A: Neu aufsetzen (Empfohlen für Demo)
```sql
DROP TABLE IF EXISTS test_recipe_ingredients, test_ingredients, test_recipes CASCADE;
-- Dann: database-schema.sql ausführen
-- Dann: sample-data-v2.sql ausführen
```

### Option B: Bestehende Daten migrieren
Siehe `MIGRATION_GUIDE.md` für detaillierte Schritte.

---

## ✅ Validierung

Nach dem Update solltest du folgende Checks durchführen:

### 1. Datenbank-Struktur:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'test_recipes'
ORDER BY ordinal_position;
```

Erwartete wichtige Spalten:
- difficulty (integer) ✅
- prep_time (integer) ✅
- total_time (integer) ✅
- servings (integer) ✅

### 2. Demo-Daten:
```sql
SELECT name, difficulty, prep_time, total_time, servings
FROM test_recipes;
```

Erwartete Ausgabe: 5 Rezepte mit vollständigen Daten

### 3. Embeddings:
```sql
SELECT name,
  CASE WHEN ingredients_embedding IS NULL THEN '❌' ELSE '✅' END
FROM test_recipes;
```

Alle Rezepte sollten ✅ haben.

### 4. Backend-Deployment:
```bash
supabase functions deploy make-server-b187574e
```

Sollte erfolgreich ohne Fehler deployen.

---

## 🐛 Bekannte Issues & Fixes

### Issue: Alte difficulty-Werte in DB
**Symptom:** Backend-Fehler "invalid input syntax for type integer"  
**Fix:** Führe Migration aus `MIGRATION_GUIDE.md` durch

### Issue: Filter-Chips werden noch angezeigt
**Symptom:** Komponente nicht gefunden  
**Fix:** FilterChips wurde entfernt, App.tsx wurde bereits aktualisiert

### Issue: servings wird nicht angezeigt
**Symptom:** Alle Rezepte zeigen 4 Portionen  
**Fix:** 
```sql
UPDATE test_recipes SET servings = 4 WHERE servings IS NULL;
```

---

## 🚀 Performance-Verbesserungen

### Backend:
- Direkter Zugriff auf Zeit-Felder (keine Schätzungen mehr)
- Effizientere difficulty-Filter (int-Vergleich statt string)
- Weniger Code-Complexity

### Frontend:
- Weniger DOM-Elemente (Filter-Chips entfernt)
- Cleaner State-Management (servings entfernt)
- Schnellere Render-Zeiten

---

## 📊 Vergleich v1.0 vs v2.0

| Feature | v1.0 | v2.0 |
|---------|------|------|
| Difficulty | varchar | int (1-5) ✅ |
| Zeitfelder | Geschätzt | Aus DB ✅ |
| Portionen | Statisch 4 | Aus DB ✅ |
| User Prefs | - | Neue Tabelle ✅ |
| Favoriten | Client-only | DB-backed ✅ |
| Quick-Filter | Ja | Entfernt 🗑️ |
| Filter-Chips | Ja | Entfernt 🗑️ |
| Ernährungs-Icons | Nein | Ja ✅ |

---

## 🎯 Nächste Schritte

### Kurzfristig (Ready to implement):
- [ ] User Preferences API-Endpoints
- [ ] Favoriten Sync mit Datenbank
- [ ] Allergen-Filter aus DB

### Mittelfristig:
- [ ] Upgrade auf 768D Embeddings
- [ ] OpenAI/Sentence Transformer Integration
- [ ] IVFFlat-Index für Performance
- [ ] Spoonacular API Integration

### Langfristig:
- [ ] User-Generated Content (eigene Rezepte)
- [ ] Social Features (Teilen, Bewerten)
- [ ] Nährwert-Informationen
- [ ] Meal Planning

---

## 🙏 Breaking Changes

### Für Entwickler:

1. **Datenbank:**
   - `difficulty` ist jetzt int → Queries müssen angepasst werden
   - Neue Spalten in `test_recipes` → SELECT * kann mehr Felder zurückgeben

2. **Backend:**
   - `RecipeFilters` Interface hat kein `servings` mehr
   - Difficulty-Filter-Logik geändert

3. **Frontend:**
   - `FilterChips` Komponente entfernt
   - `removeFilter` Funktion entfernt
   - Sidebar hat keine Quick-Filter mehr

### Migration erforderlich:
- ⚠️ Bestehende Datenbanken müssen migriert werden (siehe MIGRATION_GUIDE.md)
- ⚠️ Edge Function muss neu deployed werden
- ⚠️ Frontend-Code wurde bereits aktualisiert (keine Action nötig)

---

## 📞 Support

Bei Fragen oder Problemen:

1. Überprüfe `QUICKSTART_V2.md` für Quick-Start
2. Siehe `DATENBANK_SETUP_V2.md` für Details
3. Konsultiere `MIGRATION_GUIDE.md` bei Migrations-Problemen
4. Prüfe Browser-Console & Supabase-Logs

---

**Erstellt:** November 2025  
**Version:** 2.0.0  
**Status:** ✅ Stable Release  
**Breaking Changes:** Ja (siehe oben)
