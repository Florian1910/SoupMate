
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

```bash
# In das Server-Verzeichnis wechseln
cd src\supabase\functions\server

# Rezepte von Spoonacular importieren
python scripts\faiss_search.py ingest --number=10

# Semantische Suche
python scripts\faiss_search.py search-text --q="tomato soup" --k=5

# Zutaten-basierte Suche
python scripts\faiss_search.py search-ingredients --ing "tomato" "onion" --k=5

# Rezept-Details anzeigen
python scripts\faiss_search.py details --recipe-id="RECIPE_ID"
```

---

## 📂 **Projektstruktur**

```bash
C:\Users\flori\OneDrive\Desktop\SoupMate\src\supabase\functions\server\
├── 📁 config/
│   ├── import_map.json
│   └── environment.ts
├── 📁 services/
│   ├── database.ts
│   ├── spoonacular.ts
│   └── embedding.ts
├── 📁 routes/
│   ├── recipes.ts
│   ├── search.ts
│   └── health.ts
├── 📁 scripts/
│   └── faiss_search.py
├── 📁 types/
│   └── recipe.ts
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
