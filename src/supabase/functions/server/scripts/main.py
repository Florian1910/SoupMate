#!/usr/bin/env python3
import sys
import json
import os

# Pfad zu deinen Modulen
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.search_service import EmbeddingService

def main():
    """Hauptfunktion für das Python-Skript"""
    try:
        # Query aus den Kommandozeilenargumenten lesen
        if len(sys.argv) > 1:
            query = sys.argv[1]
        else:
            # Fallback für Testzwecke
            query = "tomato soup"

        limit = 10

        print(f"🔍 Starte Suche nach: '{query}'", file=sys.stderr)

        # EmbeddingService initialisieren
        service = EmbeddingService()

        # Suche durchführen
        results = service.search_by_text(query, limit)

        # Ergebnisse als JSON ausgeben (für TypeScript)
        output = json.dumps(results, ensure_ascii=False, default=str)
        print(output)

        print(f"✅ Suche abgeschlossen. {len(results)} Ergebnisse gefunden.", file=sys.stderr)

    except Exception as e:
        print(f"❌ Fehler in main(): {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        print(json.dumps([]))

if __name__ == "__main__":
    main()