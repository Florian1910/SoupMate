
# 🥣 **SoupMate** – Backend & Semantische Rezeptsuche

**SoupMate** ist eine webbasierte Anwendung zur **semantischen Suche von Rezepten**, basierend auf Zutaten, Text und Nährwerten.  
Das Projekt kombiniert **Supabase**, **FAISS** und **Deno (Hono)**, um Rezepte zu importieren, zu vektorisieren und effizient abzufragen.

---

## 💻 **Frontend starten**

1. **Wechsle in das Projekt-Root-Verzeichnis**
   ```bash
   cd C:\Users\flori\OneDrive\Desktop\SoupMate
   ```

2. **Installiere die Abhängigkeiten**
   ```bash
   npm install
   ```

3. **Starte den Entwicklungsserver**
   ```bash
   npm run dev
   ```

   Das Frontend ist jetzt unter [**http://localhost:3000**](http://localhost:3000) erreichbar.

---

## 🚀 **Backend starten**

1. **Wechsle in das Server-Verzeichnis**
   ```bash
   cd src\supabase\functions\server
   ```

2. **Starte den Deno-Server**
   ```bash
   deno run --import-map=config/import_map.json --allow-all --env-file=.env server.tsx
   ```

   Das Backend ist nun unter [**http://localhost:8000**](http://localhost:8000) erreichbar.

---

## ⚙️ **Python Script Commands**

Führe die folgenden Python-Kommandos im `server`-Verzeichnis aus, um Rezepte zu importieren und die semantische Suche durchzuführen:

### In das Server-Verzeichnis wechseln
   ```bash 
   cd src\supabase\functions\server
   ```

### Rezepte von Spoonacular importieren
   ```bash
   python scripts\main.py ingest --number=10
   ```

### Semantische Suche
   ```bash
   python scripts\main.py search-text --q="tomato soup" --k=5 --format
   ```

### Zutaten-basierte Suche
   ```bash
   python scripts\main.py search-ingredients --ing "tomato" "onion" --k=5 --format
   ```

---

## 📂 **Projektstruktur**

```bash
SoupMate\src\supabase\functions\server\
├── 📁 config
│   ├── import_map.json          # Import-Mappings für Deno
│   └── environment.ts           # Umgebungsvariablen
├── 📁 routes
│   ├── favorites.ts             
│   ├── health.ts                # Health-Check
│   ├── recipes.ts               # Endpunkte rund um Rezepte
│   └── search.ts                # Endpunkte für die Suche
├── 📁 services/                 # (TypeScript Services für Edge Functions)
│   ├── database.ts              # TypeScript DB Service
│   ├── embedding.ts             # TypeScript Embedding Service
│   └── spoonacular.ts           # TypeScript Spoonacular Service
├── 📁 scripts/                  # (Python Backend & Data Pipeline)
│   ├── 📁 models/
│   │   ├── embedding.py         # KI-Modell Wrapper & Text-Cleaning
│   │   ├── init.py              # Package Init
│   │   └── recipe.py            # Datenklassen (Recipe, Nutrition, Ingredient)
│   ├── 📁 services/
│   │   ├── database.py          # Python DB Service (Postgres & pgvector)
│   │   ├── init.py              # Package Init
│   │   ├── search_service.py    # Such-Logik (Intent-Erkennung & Ranking)
│   │   └── spoonacular.py       # Python Spoonacular Client (Ingestion)
│   ├── 📁 utils
│   └── main.py                  # CLI Entry-Point (Steuert Ingest & Suche)
├── .env                         # Lokale Umgebungsvariablen
└── server.tsx                   # Haupt-Server-Datei (Deno/Supabase)
```

---

## 🧠 **Technologien**

| Bereich         | Technologie                  |
|-----------------|------------------------------|
| **Backend (API)** | Deno + Hono Framework       |
| **Datenbank**   | Supabase (PostgreSQL + pgvector) |
| **Suche / KI**  | Python + FAISS + SentenceTransformers |
| **Frontend**    | React + TypeScript            |

---

## 🔧 **Voraussetzungen**

- **Deno** (für das Backend): [Installation](https://deno.land/)
- **Node.js & npm** (für das Frontend): [Installation](https://nodejs.org/)
- **Python** (für FAISS-Skripte): [Installation](https://www.python.org/)

## 🔧 **Probleme & Lösungen**

Während der Einrichtung und Ausführung des Projekts traten mehrere typische Fehler auf, die hier dokumentiert und gelöst wurden, um zukünftige Setups zu vereinfachen.

---

## 🖥️ **Frontend-Probleme**

### Vite-Fehler durch OneDrive
**Problem:** Der Projektordner befand sich im OneDrive-Verzeichnis, wodurch einige Build-Dateien blockiert wurden.

**Lösung:**
1. Projekt außerhalb von Outlook nach zb: `C:\Dev\SoupMate` verschieben
2. `node_modules` und `package-lock.json` löschen
3. npm-Cache bereinigen:
   ```bash
   npm cache clean --force
4. Vite neu installieren
   ```bash
   npm install -D vite@5.4.10
   npm install
   npm run dev
