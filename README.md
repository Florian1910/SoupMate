
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
C:\Users\flori\OneDrive\Desktop\SoupMate\src\supabase\functions\server\
├── 📁 config/
│   ├── import_map.json
│   └── environment.ts
├── 📁 services/
│   ├── database.ts              # TypeScript DB Service
│   ├── spoonacular.ts           # TypeScript Spoonacular Service
│   └── embedding.ts             # TypeScript Embedding Service
├── 📁 routes/
│   ├── recipes.ts
│   ├── search.ts
│   └── health.ts
├── 📁 types/
│   └── recipe.ts
├── 📁 scripts/                  # Python ML Komponenten
│   ├── 📁 models/
│   │   ├── recipe.py            # Recipe Datenklassen
│   │   └── embedding.py         # Embedding Logik
│   ├── 📁 services/
│   │   ├── database.py          # Python DB Service
│   │   ├── spoonacular.py       # Python Spoonacular Service
│   │   └── embedding_service.py # Python Embedding Service
│   ├── 📁 utils/
│   │   └── helpers.py           # Hilfsfunktionen
│   ├── main.py                  # Hauptscript (CLI)
│   └── config.py                # Python Konfiguration
├── server.tsx
└── .env
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
