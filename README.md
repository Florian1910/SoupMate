# 🥣 **SoupMate** – Backend & Semantische Rezeptsuche

**SoupMate** ist eine webbasierte Anwendung zur **semantischen Suche von Rezepten**, basierend auf Zutaten, Text und Nährwerten.
Das Projekt kombiniert **Supabase**, **FAISS** und **Deno (Hono)**, um Rezepte zu importieren, zu vektorisieren und effizient abzufragen.

---

## 🧠 **Technologien**

| Bereich | Technologie |
| :--- | :--- |
| **Backend (API)** | Deno + Hono Framework |
| **Datenbank** | Supabase (PostgreSQL + pgvector) |
| **Suche / KI** | Python + FAISS + SentenceTransformers |
| **Frontend** | React + TypeScript |

---

## 🔧 **Voraussetzungen**

Stelle vor dem Start sicher, dass die folgenden Laufzeitumgebungen installiert sind:

* **Deno** (für das Backend): [Installation](https://deno.land/)
* **Node.js & npm** (für das Frontend): [Installation](https://nodejs.org/)
* **Python** (für FAISS-Skripte): [Installation](https://www.python.org/)

---

## 🛠️ **Ersteinrichtung (Initial Setup)**

Diese Schritte sind **einmalig** nach dem Klonen des Repositories oder wenn sich die Abhängigkeiten (`package.json`) geändert haben, notwendig.

### 1. **Abhängigkeiten installieren**
Wechsle in das **Projekt-Root-Verzeichnis** und installiere die Frontend-Pakete sowie **`concurrently`** zur gleichzeitigen Ausführung der Server:

```bash
# Im Projekt-Root-Verzeichnis
npm install
npm install concurrently --save-dev
```


## 🚀 Anwendung starten (Runtime) ##

```bash
# Im Projekt-Root-Verzeichnis
npm run start-all
```

Server	Erreichbar unter
Frontend (Vite)	http://localhost:3000
Backend (Deno)	http://localhost:8000

## 🚀⚙️ Python Skripte (Datenbank & Suche) ##
```bash
cd src\supabase\functions\server
```
```bash
# Importiert Rezepte von Spoonacular und generiert Vektoren:
python scripts\main.py ingest --number=10
```

```bash
# Sucht nach Rezepten, die dem Suchbegriff semantisch ähneln:
python scripts\main.py search-text --q="tomato soup" --k=5 --format
```

```bash
# Sucht nach Rezepten, die die angegebenen Zutaten enthalten:
python scripts\main.py search-ingredients --ing "tomato" "onion" --k=5 --format
```

## 📂 **Projektstruktur**



```bash
C:\\SoupMate\src\supabase\functions\server\
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
