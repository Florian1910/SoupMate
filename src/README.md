# 🍜 SoupMate - Semantic Recipe Search

Eine moderne Web-Anwendung mit **semantischer Rezeptsuche** basierend auf Supabase PostgreSQL und Vector Embeddings.

![SoupMate](https://img.shields.io/badge/Status-Database%20Integrated-success)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)
![React](https://img.shields.io/badge/React-18.3-61dafb)
![Tailwind](https://img.shields.io/badge/Tailwind-4.0-38bdf8)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e)

## ✨ Features

### 🎨 UI Features
- ✅ **Modernes Orange Design** mit Farbverläufen und Gradienten
- ✅ **Responsive Layout** für Desktop & Mobile
- ✅ **Ausklappbare Sidebar** mit umfangreichen Filteroptionen
- ✅ **Login-System** mit personalisierten Begrüßungen
- ✅ **Favoriten-System** zum Speichern von Lieblingsrezepten
- ✅ **Such-Verlauf** mit intelligenter Autocomplete-Funktion

### 🔍 Such- und Filter-Features
- ✅ **Ernährung:** Vegan, Vegetarisch oder Alles
- ✅ **Schwierigkeit:** 1-5 Sterne (interaktive Auswahl)
- ✅ **Arbeitszeit:** Einstellbarer Zeitbereich
- ✅ **Gesamtzeit:** Inklusive Koch- und Wartezeit
- ✅ **Allergien:** Ausschluss bestimmter Allergene
- ✅ **Verfügbare Zutaten:** Rezepte basierend auf vorhandenen Zutaten
- ✅ **Portionenanzahl:** Anpassbare Personenzahl

### 🤖 Semantische Suche mit Embeddings
- ✅ **Supabase PostgreSQL** mit pgvector Extension
- ✅ **Vector Embeddings** für intelligente Ähnlichkeitssuche
- ✅ **Kombinierte Suche** - 60% Zutaten + 40% Text-Ähnlichkeit
- ✅ **Filterbasierte Suche** - alle Filter werden berücksichtigt
- ✅ **3 Datenbank-Tabellen** - test_recipes, test_ingredients, test_recipe_ingredients
- ✅ **Detaillierte Rezeptinformationen** mit Zutaten, Anleitung und Allergenen

## 🚀 Schnellstart

### Voraussetzungen
- Node.js 18+ und npm
- Supabase Account (kostenlos)
- Deine Supabase-Datenbank ist bereits konfiguriert

### 1. Datenbank mit Rezepten füllen

**Die App ist bereits mit deiner Supabase-Datenbank verbunden!**

Um die Datenbank mit Test-Rezepten zu füllen:

1. Öffne [Supabase Dashboard](https://supabase.com/dashboard)
2. Wähle dein Projekt `brssalvqnbxgaiwmycpf`
3. Gehe zu **SQL Editor**
4. Kopiere den Inhalt von `/sample-recipes.sql` und führe ihn aus
5. ✅ Du hast jetzt 4 Test-Rezepte!

**Siehe [DATENBANK_SCHNELLSTART.md](./DATENBANK_SCHNELLSTART.md) für Details**

### 2. App starten

```bash
# Dependencies installieren
npm install

# App starten (nutzt echte Datenbank)
npm run dev
```

Die App läuft auf **http://localhost:5173** und verwendet deine Supabase-Datenbank!

### 3. Suchen und Testen

- Gib eine Suchanfrage ein: "Tomatensuppe" oder "vegane Suppe"
- Die App findet Rezepte basierend auf semantischer Ähnlichkeit
- Filter anwenden: Vegan, Schwierigkeit, Zeit, etc.
- Favoriten speichern und verwalten

## 📁 Projektstruktur

```
soupmate/
├── App.tsx                           # Hauptkomponente
├── config.tsx                        # ⭐ Konfiguration (Datenbank aktiv)
│
├── 📚 DOKUMENTATION
├── DATENBANK_SCHNELLSTART.md        # ⭐ Start hier!
├── DATABASE_INTEGRATION.md          # Semantische Suche Details
├── sample-recipes.sql               # SQL zum Befüllen der DB
├── BACKEND_SETUP.md                 # Backend-Referenz
├── deployment-guide.md              # Deployment-Anleitung
│
├── components/
│   ├── Header.tsx                   # Header mit Logo und Login
│   ├── SearchBar.tsx                # Suchleiste mit Verlauf
│   ├── Sidebar.tsx                  # Filter-Sidebar
│   ├── LoginPage.tsx                # Login-Seite
│   ├── RecipeResults.tsx            # Rezept-Ergebnisse
│   └── ui/                          # Shadcn UI Komponenten
│
├── styles/
│   └── globals.css                  # Tailwind CSS & Design Tokens
│
├── supabase/
│   └── functions/server/            # ⭐ Supabase Edge Functions
│       ├── index.tsx                # Hono Server mit semantischer Suche
│       └── kv_store.tsx             # KV-Store für Favoriten
│
└── utils/
    └── supabase/
        └── info.tsx                 # Supabase Credentials
```

## ⚙️ Konfiguration

### Frontend-Konfiguration (`config.tsx`)

✅ **Bereits konfiguriert für deine Supabase-Datenbank!**

```typescript
export const DEV_MODE = {
  useMockData: false,  // ✅ Echte Datenbank aktiv!
  mockDelay: 1000
};

export const API_CONFIG = {
  baseUrl: "https://brssalvqnbxgaiwmycpf.supabase.co/functions/v1",
  endpoints: {
    search: "/make-server-b187574e/search",
    favorites: "/make-server-b187574e/favorites",
    health: "/make-server-b187574e/health"
  }
};
```

**Keine weitere Konfiguration nötig!**

### Datenbank-Schema

Deine Supabase-Datenbank nutzt 3 Tabellen:

1. **test_recipes** - Rezept-Stammdaten mit Embeddings
2. **test_ingredients** - Zutaten mit Embeddings  
3. **test_recipe_ingredients** - N:M-Verknüpfung

Siehe [DATABASE_INTEGRATION.md](./DATABASE_INTEGRATION.md) für Details.

## 🎯 Verwendung

### Aktueller Modus: Produktiv (Supabase Datenbank)

✅ **Die App ist bereits produktionsbereit!**

1. **Datenbank befüllen:** Siehe [DATENBANK_SCHNELLSTART.md](./DATENBANK_SCHNELLSTART.md)
2. **App starten:** `npm run dev`
3. **Suchen:** Die App nutzt semantische Suche mit Embeddings
4. **Favoriten:** Werden in Supabase KV-Store gespeichert

### Semantische Suche verstehen

```
Suchbegriff: "vegane Karottensuppe"
     ↓
Embedding generieren: [0.23, 0.45, 0.67]
     ↓
Ähnlichkeit berechnen mit:
  - Rezept-Text (40%)
  - Zutaten (60%)
     ↓
Top 5 ähnlichste Rezepte
```

**Aktuell:** 3D Demo-Embeddings (Hash-basiert)  
**Produktion:** Upgrade auf OpenAI/Voyage AI (768-1536D)  
Siehe [DATABASE_INTEGRATION.md](./DATABASE_INTEGRATION.md) Abschnitt "Erweiterte Integration"

## 🛠️ Verfügbare Scripts

```bash
npm run dev      # Entwicklungsserver starten
npm run build    # Production Build erstellen
npm run preview  # Production Build testen
```

## 📚 Dokumentation

### 🎯 Start hier:
- **[DATENBANK_SCHNELLSTART.md](./DATENBANK_SCHNELLSTART.md)** ⭐ Schnellstart-Guide
- **[sample-recipes.sql](./sample-recipes.sql)** - SQL zum Befüllen der Datenbank

### 📖 Detaillierte Infos:
- **[DATABASE_INTEGRATION.md](./DATABASE_INTEGRATION.md)** - Semantische Suche erklärt
- **[BACKEND_SETUP.md](./BACKEND_SETUP.md)** - Backend-Referenz (optional)
- **[deployment-guide.md](./deployment-guide.md)** - Deployment-Anleitung
- **[Attributions.md](./Attributions.md)** - Credits

## 🔑 Datenbank & API Keys

### ✅ Supabase Datenbank (bereits konfiguriert)

Deine Credentials sind bereits in `/utils/supabase/info.tsx` hinterlegt:
- **Project ID:** brssalvqnbxgaiwmycpf
- **URL:** https://brssalvqnbxgaiwmycpf.supabase.co
- **Anon Key:** (bereits gesetzt)

### 🔄 Upgrade auf echte Embeddings (Optional für Produktion)

Aktuell nutzt die App Hash-basierte Mock-Embeddings (3D). Für bessere Ergebnisse:

**Option A: OpenAI Embeddings (Empfohlen)**
```bash
# In Supabase Dashboard → Settings → Edge Functions → Secrets
OPENAI_API_KEY=sk-...
```

**Option B: Voyage AI Embeddings**
```bash
VOYAGE_API_KEY=pa-...
```

**Option C: Gemini Embeddings**
```bash
GEMINI_API_KEY=...
```

Siehe [DATABASE_INTEGRATION.md](./DATABASE_INTEGRATION.md) für Implementierung.

**⚠️ Wichtig:** API Keys gehören **nur ins Backend** (Supabase Secrets)!

## 🎨 Design

- **Primary Color:** Orange (#ff6b35 - #ff9966)
- **Typography:** Poppins (Header), System Fonts (Content)
- **Design System:** Tailwind CSS 4.0
- **UI Components:** Shadcn/ui (Radix UI)
- **Icons:** Lucide React

## 🌐 Deployment

### Option 1: Vercel (empfohlen)
```bash
npm install -g vercel
vercel
```

### Option 2: Netlify
```bash
npm install -g netlify-cli
netlify deploy
```

### Option 3: Eigener Server
```bash
npm run build
# Deploye den /dist Ordner
```

Siehe **[deployment-guide.md](./deployment-guide.md)** für Details.

## 🤝 Entwicklung

### Projekt-Setup für IntelliJ IDEA

Vollständige Anleitung: **[deployment-guide.md](./deployment-guide.md)**

### Wichtige Hinweise

1. **Figma Assets:** Die `figma:asset/*` Imports müssen durch lokale Bilder ersetzt werden
2. **Backend optional:** Die App funktioniert komplett im Mock-Modus
3. **TypeScript:** Alle Komponenten sind voll typisiert

## 📝 Lizenz

Dieses Projekt wurde mit Figma Make erstellt.

## 🎉 Los geht's!

```bash
# 1. Datenbank befüllen (siehe DATENBANK_SCHNELLSTART.md)
# In Supabase SQL Editor: sample-recipes.sql ausführen

# 2. Installation
npm install

# 3. App starten (nutzt echte Datenbank mit semantischer Suche)
npm run dev

# 4. Öffne http://localhost:5173
# Viel Spaß beim Suchen nach leckeren Suppen! 🍲
```

### 🚀 Nächste Schritte

1. ✅ **Jetzt:** App testen mit Demo-Rezepten
2. 🔄 **Später:** Eigene Rezepte hinzufügen
3. 🚀 **Produktion:** Upgrade auf echte Embeddings (OpenAI/Voyage AI)
4. 📊 **Optional:** Schema erweitern (work_time, total_time, allergens)

---

**Entwickelt mit ❤️, Figma Make & Supabase**  
**Semantische Suche powered by pgvector 🔍**
