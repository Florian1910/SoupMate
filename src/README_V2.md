# 🍲 SoupMate v2.0 - Semantische Rezept-Suche

Eine moderne Web-App für die intelligente Suche nach Suppenrezepten mit semantischer Vektorsuche, Filtern und Favoriten-Verwaltung.

![Version](https://img.shields.io/badge/version-2.0-orange)
![Status](https://img.shields.io/badge/status-stable-green)
![Database](https://img.shields.io/badge/database-Supabase-green)
![Embeddings](https://img.shields.io/badge/embeddings-3D%20demo-yellow)

---

## ✨ Features

### 🔍 Intelligente Suche
- **Semantische Vektorsuche** mit pgvector
- **Kombinierte Text- und Zutaten-Suche**
- **Echtzeit-Filterung** nach:
  - Ernährungstyp (Alles/Vegetarisch/Vegan) mit Icons 🍴🥬🌱
  - Schwierigkeitsgrad (1-5 Sterne)
  - Arbeitszeit & Gesamtzeit
  - Allergien (8 Kategorien)
  - Verfügbare Zutaten

### 🎨 Modernes Design
- Orange-Gradient Theme
- Responsive Layout
- Collapsible Sidebar
- Smooth Animations
- Poppins-Schriftart

### 👤 Benutzer-Features
- Login/Logout-System
- Personalisierte Begrüßung
- Favoriten-Verwaltung
- (Zukünftig: Präferenzen speichern)

### 📊 Rezept-Daten
- Vollständige Zeitangaben (Vorbereitung, Kochen, Gesamt)
- Portionenanzahl
- Schwierigkeitsgrad (1-5)
- Detaillierte Zutatenlisten mit Mengen
- Schritt-für-Schritt Anleitung
- Bilder (Unsplash/eigene URLs)

---

## 🚀 Quick Start

### 1. Datenbank einrichten

```bash
# 1. Supabase-Projekt erstellen auf supabase.com
# 2. Vector Extension aktivieren
CREATE EXTENSION IF NOT EXISTS vector;

# 3. Schema erstellen (Datei: database-schema.sql)
# 4. Demo-Daten einfügen (Datei: sample-data-v2.sql)
```

### 2. Backend deployen

```bash
# Mit Supabase CLI verbinden
supabase link --project-ref <your-project-ref>

# Edge Function deployen
supabase functions deploy make-server-b187574e
```

### 3. Frontend starten

Frontend ist bereits konfiguriert! Credentials in `config.tsx` anpassen falls nötig.

**Fertig! 🎉**

Siehe `QUICKSTART_V2.md` für detaillierte Anleitung.

---

## 📁 Projekt-Struktur

```
SoupMate/
├── App.tsx                      # Haupt-App-Komponente
├── config.tsx                   # Konfiguration (Credentials)
│
├── components/                  # React-Komponenten
│   ├── Header.tsx              # Header mit Logo
│   ├── SearchBar.tsx           # Zentrale Suchleiste
│   ├── Sidebar.tsx             # Filter-Sidebar
│   ├── RecipeResults.tsx       # Ergebnis-Anzeige
│   ├── LoginPage.tsx           # Login-Formular
│   └── ui/                     # Shadcn UI-Komponenten
│
├── supabase/functions/server/  # Backend (Edge Functions)
│   ├── index.tsx               # Haupt-Server-Datei
│   └── kv_store.tsx            # Key-Value Store (geschützt)
│
├── styles/
│   └── globals.css             # Globale Styles + Theme
│
├── utils/supabase/
│   └── info.tsx                # Supabase Config
│
└── Dokumentation/
    ├── QUICKSTART_V2.md        # 5-Minuten Quick-Start ⭐
    ├── DATENBANK_SETUP_V2.md   # Vollständige DB-Doku
    ├── MIGRATION_GUIDE.md      # v1 → v2 Migration
    ├── CHANGELOG_V2.md         # Änderungsprotokoll
    ├── database-schema.sql     # DB-Schema
    └── sample-data-v2.sql      # Demo-Daten
```

---

## 🗄️ Datenbank-Schema

### Haupttabellen:

1. **`test_recipes`** - Rezepte mit Embeddings
   - Vollständige Zeitfelder (prep_time, cook_time, total_time)
   - Portionenanzahl (servings)
   - Integer-Schwierigkeitsgrad (1-5)
   - Vector-Embeddings für Text & Zutaten

2. **`test_ingredients`** - Zutaten mit Embeddings
   - Eindeutige Namen
   - 3D-Vektoren (Demo), später 768D/1536D

3. **`test_recipe_ingredients`** - Verknüpfungs-Tabelle
   - Rezept-Zutaten-Beziehung (N:M)
   - Mengenangaben
   - Trigger für Auto-Aggregation

4. **`user_preferences`** - Benutzerpräferenzen (NEU in v2.0)
   - Ernährungstyp
   - Allergien
   - Diät-Präferenzen

5. **`user_favorites`** - Favoriten (NEU in v2.0)
   - User-Rezept-Verknüpfung

### Automatische Prozesse:

- **Trigger:** Aktualisiert `ingredients_embedding` automatisch bei Änderungen
- **Funktion:** `refresh_test_recipe_ingredients_embedding()`

---

## 🔧 Technologie-Stack

### Frontend:
- **React** + TypeScript
- **Tailwind CSS v4.0**
- **Shadcn UI** Komponenten
- **Lucide Icons**
- **Sonner** für Toasts

### Backend:
- **Supabase Edge Functions** (Deno)
- **Hono** Web Framework
- **Supabase Client** für DB-Zugriff

### Datenbank:
- **Supabase PostgreSQL**
- **pgvector** Extension
- **Cosine Similarity** für semantische Suche

### Deployment:
- **Supabase Functions** (Backend)
- **Vercel/Netlify** (Frontend, optional)

---

## 📚 Dokumentation

| Dokument | Zweck | Zielgruppe |
|----------|-------|------------|
| `QUICKSTART_V2.md` | 5-Minuten Einstieg | Alle ⭐ |
| `DATENBANK_SETUP_V2.md` | Vollständige DB-Setup-Anleitung | Entwickler |
| `MIGRATION_GUIDE.md` | v1 → v2 Migration | Existing Users |
| `CHANGELOG_V2.md` | Änderungsprotokoll | Alle |
| `database-schema.sql` | Schema-Definition | DB-Admins |
| `sample-data-v2.sql` | Demo-Daten | Tester |

---

## 🎯 Verwendung

### Beispiel-Suchen:

```
"Cremige Tomatensuppe"       → Findet Tomatensuppe
"Vegan Kokos Curry"          → Findet Thai-Suppe & Karottensuppe
"Schnelle Suppe unter 30min" → Filtert nach Zeit
"Vegetarisch ohne Nüsse"     → Kombiniert Filter
```

### Filter-Optionen:

- **Ernährung:** Alles 🍴 | Vegetarisch 🥬 | Vegan 🌱
- **Schwierigkeit:** ⭐ bis ⭐⭐⭐⭐⭐
- **Arbeitszeit:** 0-120+ Minuten (Slider)
- **Gesamtzeit:** 0-240+ Minuten (Slider)
- **Allergien:** 8 Checkboxen (Gluten, Laktose, Nüsse, ...)
- **Zutaten:** Freitext-Eingabe

### Favoriten:

1. Klicke auf das ❤️-Icon bei einem Rezept
2. Öffne die Sidebar → Tab "Favoriten"
3. Verwalte deine gespeicherten Rezepte

---

## 🧪 Testing

### Demo-Daten prüfen:

```sql
-- Zeige alle Rezepte
SELECT name, difficulty, prep_time, total_time, servings
FROM test_recipes
ORDER BY difficulty, total_time;

-- Überprüfe Embeddings
SELECT name,
  CASE WHEN text_embedding IS NULL THEN '❌' ELSE '✅' END as text,
  CASE WHEN ingredients_embedding IS NULL THEN '❌' ELSE '✅' END as ing
FROM test_recipes;
```

### Backend-Logs:

```bash
# Supabase Dashboard → Functions → make-server-b187574e → Logs
# Oder via CLI:
supabase functions logs make-server-b187574e
```

---

## 🐛 Troubleshooting

### Problem: "Keine Rezepte gefunden"

**Lösung:**
1. Überprüfe, ob Demo-Daten eingefügt wurden
2. Prüfe Browser-Console auf Fehler
3. Validiere Embeddings in der DB

### Problem: "401 Unauthorized"

**Lösung:**
1. Edge Function neu deployen
2. Überprüfe API-Keys in `config.tsx`
3. Prüfe Supabase Dashboard → Settings → API

### Problem: "Internal Server Error"

**Lösung:**
1. Überprüfe Supabase Function Logs
2. Validiere Datenbank-Schema
3. Prüfe, ob Vector Extension aktiviert ist

Siehe `QUICKSTART_V2.md` für weitere Debugging-Tipps.

---

## 🔮 Roadmap

### Phase 1: Foundation ✅ (v2.0)
- [x] Datenbank-Schema mit erweiterten Feldern
- [x] Semantische Suche
- [x] Filter-System
- [x] Login/Logout
- [x] Favoriten (Frontend)

### Phase 2: Enhancement 🚧
- [ ] Favoriten-Sync mit Datenbank
- [ ] User Preferences API
- [ ] Höherdimensionale Embeddings (768D/1536D)
- [ ] IVFFlat-Index für Performance

### Phase 3: Integration 🔮
- [ ] OpenAI/Sentence Transformer Embeddings
- [ ] Spoonacular API Integration
- [ ] Nährwert-Informationen
- [ ] Bild-Upload für eigene Rezepte

### Phase 4: Social 🌟
- [ ] User-Generated Rezepte
- [ ] Bewertungen & Kommentare
- [ ] Rezepte teilen
- [ ] Meal Planning

---

## 🤝 Beiträge

Dieses Projekt ist Teil eines Prototyps. Verbesserungen sind willkommen!

### Entwicklung:

1. Clone das Repository
2. Folge `QUICKSTART_V2.md`
3. Mache deine Änderungen
4. Teste mit Demo-Daten
5. Dokumentiere Änderungen

---

## 📄 Lizenz

Dieses Projekt ist ein Prototyp für Bildungszwecke.

---

## 🙏 Credits

- **UI-Komponenten:** [Shadcn UI](https://ui.shadcn.com/)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Datenbank:** [Supabase](https://supabase.com/)
- **Vector Search:** [pgvector](https://github.com/pgvector/pgvector)
- **Bilder:** [Unsplash](https://unsplash.com/)
- **Schriftart:** [Poppins](https://fonts.google.com/specimen/Poppins)

---

## 📞 Support

Bei Fragen oder Problemen:

1. 📖 Lies `QUICKSTART_V2.md`
2. 🔍 Überprüfe `DATENBANK_SETUP_V2.md`
3. 🐛 Konsultiere `MIGRATION_GUIDE.md`
4. 💬 Prüfe Browser-Console & Supabase-Logs

---

## 🌟 Features im Detail

### Semantische Suche

Die Suche nutzt **Vector Embeddings** für intelligente Ergebnisse:

```typescript
// Beispiel: Kombinierte Suche
WITH q AS (
  SELECT
    '[0.10, 0.20, 0.30]'::vector AS v_ing,  // Zutaten-Vektor
    '[0.12, 0.34, 0.56]'::vector AS v_txt   // Text-Vektor
)
SELECT name, description,
  0.6 * (ingredients_embedding <=> q.v_ing) + 
  0.4 * (text_embedding <=> q.v_txt) AS score
FROM test_recipes
ORDER BY score ASC
LIMIT 10;
```

### Filter-System

Alle Filter werden kombiniert:

```typescript
interface RecipeFilters {
  dietType: "alle" | "vegetarisch" | "vegan";
  difficulty: number;           // 0-5 (0 = alle)
  workTime: [number, number];   // [min, max] in Minuten
  totalTime: [number, number];  // [min, max] in Minuten
  allergies: string[];          // Liste von Allergien
  ingredients: string;          // Freitext-Suche
}
```

---

**Version:** 2.0.0  
**Stand:** November 2025  
**Status:** ✅ Stable Release  
**Demo:** ✅ 3D Embeddings | Produktion: ⏳ 768D/1536D empfohlen

---

Made with ❤️ and 🍲
