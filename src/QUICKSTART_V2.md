# 🚀 SoupMate Quickstart v2.0

## In 5 Minuten zur funktionsfähigen Suppe-Such-App!

---

## ✅ Voraussetzungen

- [x] Supabase-Projekt erstellt
- [x] Supabase CLI installiert: `npm install -g supabase`
- [x] Projekt-Credentials bereit (Project URL & API Key)

---

## 📝 Schritt 1: Datenbank einrichten

### 1.1 Vector Extension aktivieren

Gehe zu deinem Supabase Dashboard → SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 1.2 Schema erstellen

Kopiere den Inhalt von **`database-schema.sql`** und führe ihn aus.

✅ Das erstellt:
- 5 Tabellen (test_recipes, test_ingredients, test_recipe_ingredients, user_preferences, user_favorites)
- Trigger für automatische Embedding-Aggregation
- Alle benötigten Constraints und Indizes

### 1.3 Demo-Daten einfügen

Kopiere den Inhalt von **`sample-data-v2.sql`** und führe ihn aus.

✅ Das fügt hinzu:
- 25 Zutaten mit Embeddings
- 5 vollständige Rezepte mit allen Zeitangaben
- Automatische Verknüpfung und Embedding-Berechnung

---

## 🔧 Schritt 2: Backend deployen

### 2.1 Mit Supabase verbinden

```bash
# In deinem Projekt-Verzeichnis
supabase link --project-ref brssalvqnbxgaiwmycpf
```

### 2.2 Edge Function deployen

```bash
supabase functions deploy make-server-b187574e
```

✅ Das deployed den Backend-Code mit:
- Semantischer Suche
- Filter-Logik
- Embedding-Generierung

---

## 🎨 Schritt 3: Frontend starten (bereits fertig!)

Das Frontend ist bereits vollständig konfiguriert und nutzt:

### Aktuelle Features:
- ✅ Header mit SoupMate-Logo
- ✅ Collapsible Sidebar mit Filtern:
  - Ernährung (Alles/Vegetarisch/Vegan) mit Icons
  - Schwierigkeit (1-5 Sterne)
  - Arbeitszeit & Gesamtzeit
  - Allergien (8 Optionen)
  - Zutaten-Freitext
- ✅ Zentrale Suchleiste
- ✅ Rezept-Ergebnisse mit Details
- ✅ Login-System mit personalisierter Begrüßung
- ✅ Favoriten-Verwaltung
- ✅ Responsive Design mit Orange-Gradient-Theme

### Deine Credentials sind bereits eingetragen:
```typescript
// config.tsx
PROJECT_URL: "https://brssalvqnbxgaiwmycpf.supabase.co"
ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## 🧪 Schritt 4: Testen

### 4.1 Überprüfe die Datenbank

```sql
-- Zeige alle Rezepte mit vollständigen Infos
SELECT 
  name,
  difficulty,
  prep_time,
  total_time,
  servings,
  CASE WHEN vegan THEN '🌱 Vegan'
       WHEN vegetarian THEN '🥬 Vegetarisch'
       ELSE '🍖 Omnivore' END as diet
FROM test_recipes
ORDER BY difficulty, total_time;

-- Erwartete Ausgabe: 5 Rezepte mit allen Feldern gefüllt
```

### 4.2 Teste die Suche

1. **Öffne die App** im Browser
2. **Melde dich an** mit beliebigem Namen
3. **Teste die Suche:**
   - "Tomatensuppe" → Sollte Tomatensuppe finden
   - "Vegan Kokos" → Sollte Thai-Suppe & Karottensuppe zeigen
   - "Schnelle Suppe" → Sollte einfache Rezepte zeigen

### 4.3 Teste die Filter

Öffne die Sidebar und teste:

**Ernährungsfilter:**
- ✅ "Vegan" → 3 Rezepte (Karotten, Minestrone, Thai)
- ✅ "Vegetarisch" → 5 Rezepte (alle außer Thai wenn nicht vegan)
- ✅ "Alles" → 5 Rezepte

**Schwierigkeit:**
- ✅ 2 Sterne → Tomatensuppe & Karottensuppe
- ✅ 3 Sterne → +Kürbissuppe & Minestrone
- ✅ 4+ Sterne → +Thai-Suppe

**Zeit:**
- ✅ Arbeitszeit 0-20 Min → Tomatensuppe & Karottensuppe
- ✅ Gesamtzeit 0-45 Min → Tomatensuppe & Karottensuppe

---

## 🎯 Was funktioniert jetzt?

### Backend (Supabase):
- ✅ Semantische Suche mit Vector Embeddings
- ✅ Filter nach Ernährung, Schwierigkeit, Zeit, Allergien
- ✅ Automatische Aggregation von Zutaten-Embeddings
- ✅ Vollständige Rezept-Daten (Zeit, Portionen, etc.)

### Frontend:
- ✅ Moderne UI mit Orange-Gradient-Design
- ✅ Collapsible Sidebar mit Icons
- ✅ Echtzeit-Suche mit Filter-Integration
- ✅ Login/Logout mit personalisierter Begrüßung
- ✅ Favoriten-System
- ✅ Responsive Design

---

## 🔍 Debugging

### Problem: "Keine Rezepte gefunden"

**Lösung 1:** Überprüfe, ob Daten in der DB sind:
```sql
SELECT COUNT(*) FROM test_recipes;
-- Sollte 5 zurückgeben
```

**Lösung 2:** Überprüfe, ob Embeddings vorhanden sind:
```sql
SELECT name, 
  CASE WHEN text_embedding IS NULL THEN '❌' ELSE '✅' END as text_emb,
  CASE WHEN ingredients_embedding IS NULL THEN '❌' ELSE '✅' END as ing_emb
FROM test_recipes;
-- Alle sollten ✅ haben
```

### Problem: "401 Unauthorized"

**Lösung:** Edge Function wurde nicht deployed:
```bash
supabase functions deploy make-server-b187574e
```

### Problem: "Internal Server Error"

**Lösung:** Überprüfe Supabase Logs:
1. Gehe zu Dashboard → Functions → make-server-b187574e
2. Klicke auf "Logs"
3. Suche nach Fehlermeldungen

---

## 🎨 Anpassungen

### Filter hinzufügen/entfernen

Bearbeite `/components/Sidebar.tsx`:
```typescript
// Beispiel: Neues Allergen hinzufügen
const commonAllergies = [
  "Gluten",
  "Laktose",
  "Nüsse",
  "Soja",
  "Neues Allergen", // ← Hier hinzufügen
];
```

### Design-Farben ändern

Bearbeite `/styles/globals.css`:
```css
/* Ändere das Orange zu einer anderen Farbe */
:root {
  --primary: 25 85% 61%; /* Orange HSL */
}
```

### Mehr Demo-Rezepte hinzufügen

Kopiere ein Rezept-Block aus `sample-data-v2.sql` und passe es an.

---

## 📚 Weitere Dokumentation

- **Vollständige Schema-Doku:** `DATENBANK_SETUP_V2.md`
- **Migration von v1.0:** `MIGRATION_GUIDE.md`
- **Schema-Definition:** `database-schema.sql`
- **Demo-Daten:** `sample-data-v2.sql`

---

## 🚀 Nächste Schritte

### Phase 1: Basis-Features ✅
- [x] Datenbank-Schema
- [x] Semantische Suche
- [x] Filter-System
- [x] Login/Logout
- [x] Favoriten

### Phase 2: Erweiterte Features (Optional)

1. **User Preferences:**
   - Speichere Ernährungspräferenzen
   - Allergie-Profile
   - Automatische Filter-Anwendung

2. **Echte Embeddings:**
   - Integration von OpenAI oder Sentence Transformers
   - Upgrade von 3D zu 768D Vektoren
   - IVFFlat-Index für Performance

3. **Spoonacular API:**
   - Automatischer Import von Rezepten
   - Hochauflösende Bilder
   - Nährwert-Informationen

4. **Social Features:**
   - Rezepte teilen
   - Bewertungen & Kommentare
   - Eigene Rezepte erstellen

---

## ✨ Du bist fertig!

Deine SoupMate-App ist jetzt vollständig funktionsfähig. Viel Spaß beim Suppen-Suchen! 🍲

**Bei Fragen:** Überprüfe die Dokumentation oder die Browser-Console für Fehler.

---

**Stand:** November 2025  
**Version:** 2.0  
**Status:** ✅ Produktionsbereit (mit echten Embeddings)
