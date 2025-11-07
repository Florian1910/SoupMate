
# Anleitung: SoupMate Frontend, Backend und Datenbank

## Frontend:

### Installiere die Abhängigkeiten:
Öffne das Projektverzeichnis und führe im Terminal den folgenden Befehl aus, um die Abhängigkeiten zu installieren:

```bash
npm i
```

### Starte den Entwicklungsserver:
Nachdem die Abhängigkeiten installiert sind, starte den Entwicklungsserver mit folgendem Befehl:

```bash
npm run dev
```

Dies startet das Frontend, das dann im Browser zugänglich ist.

## Backend:

### Wechsle in das Verzeichnis für die Serverfunktionen:
Navigiere im Terminal zu diesem Verzeichnis:

```bash
cd C:\Users\flori\OneDrive\Desktop\SoupMate_\src\supabase\functions\server
```

### Starte den Deno-Server:
Führe den folgenden Befehl aus, um den Server zu starten:

```bash
deno run --import-map=import_map.json --allow-net --allow-env --allow-run --allow-read server.tsx
```

Dieser Befehl startet das Backend, das mit den Funktionen in `server.tsx` verbunden ist.

## Datenbank:

### Wechsle in das Verzeichnis für die Datenbank-Funktionen:
```bash
cd C:\Users\flori\OneDrive\Desktop\SoupMate_\src\supabase\functions\server
```

### Starte das FAISS-Skript:
Führe den folgenden Befehl aus, um das FAISS-Skript zu starten:

```bash
python faiss_search.py
```

### Rezepte importieren (Ingest):

```bash
python faiss_search.py ingest --number=2
```

### Textbasierte Suche (Search by Description):

```bash
python faiss_search.py search-text --q="tomato" --k=2
```
