#!/usr/bin/env python3
"""
ingest_recipes.py
Importiert Rezepte von der Spoonacular API inklusive Vektor-Embeddings.
Fokus: Reiner Import-Prozess ohne Zusatz-Statistiken.
"""

import argparse
import logging
import sys
import json
import os
import time
from typing import List

# Import-Fix für Pfade
try:
    from services.spoonacular import SpoonacularService
    from services.database import DatabaseService
except ImportError:
    import sys
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from services.spoonacular import SpoonacularService
    from services.database import DatabaseService

# Logging Setup
def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler('ingest.log')
        ]
    )

STATE_FILE = "ingest_state.json"

def load_state():
    """Liest den Offset direkt aus der Datei."""
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r") as f:
                data = json.load(f)
                return data.get("offset", 0)
        except Exception:
            return 0
    return 0

def save_state(offset):
    """Speichert den Offset in der Datei."""
    try:
        with open(STATE_FILE, "w") as f:
            json.dump({"offset": offset}, f)
        logging.info(f"Fortschritt gespeichert: Offset {offset}")
    except Exception as e:
        logging.error(f"Fehler beim Speichern: {e}")

def reset_offset():
    save_state(0)
    logging.info("✅ Offset auf 0 zurückgesetzt.")

def ingest_recipes(query: str = "", max_requests: int = 50, batch_size: int = 100):
    """Haupt-Schleife für den Import."""
    spoonacular = SpoonacularService()
    db = DatabaseService()

    current_offset = load_state()
    total_saved_session = 0

    logging.info(f"🚀 START: Import bei Offset {current_offset} (Query: '{query}')")

    for batch_num in range(max_requests):
        logging.info(f"--- Batch {batch_num+1}/{max_requests} (Offset {current_offset}) ---")

        try:
            # API Abruf
            recipes_data = spoonacular.fetch_recipes(
                query=query,
                number=batch_size,
                offset=current_offset
            )

            if not recipes_data:
                logging.warning("⚠️ Keine weiteren Rezepte gefunden.")
                break

            logging.info(f"📥 {len(recipes_data)} Rezepte empfangen.")

            # Verarbeitung & Speichern
            saved_count = 0
            for recipe_data in recipes_data:
                try:
                    recipe = spoonacular.normalize_recipe(recipe_data)
                    db.save_recipe(recipe)
                    saved_count += 1
                except Exception as e:
                    logging.warning(f"⚠️ Rezept übersprungen: {e}")
                    continue

            total_saved_session += saved_count
            logging.info(f"✅ Batch fertig: {saved_count} Rezepte gespeichert.")

            # State aktualisieren
            current_offset += len(recipes_data)
            save_state(current_offset)

            if len(recipes_data) < batch_size:
                logging.info("🏁 Ende der API-Ergebnisse erreicht.")
                break

            time.sleep(1) # API-Pause

        except Exception as e:
            logging.error(f"❌ Kritischer Fehler im Batch: {e}")
            break

    logging.info(f"🎉 Session beendet. Hinzugefügt: {total_saved_session}")
    logging.info(f"👉 Nächster Startpunkt: {current_offset}")

def main():
    setup_logging()
    parser = argparse.ArgumentParser(description="Recipe Ingest Tool")

    parser.add_argument("--query", default="", help="Suchbegriff")
    parser.add_argument("--limit-calls", type=int, default=50, help="Anzahl API-Calls")
    parser.add_argument("--batch-size", type=int, default=100, help="Rezepte pro Call")
    parser.add_argument("--reset-offset", action="store_true", help="Auf 0 zurücksetzen")
    parser.add_argument("--show-stats", action="store_true", help="Zeige aktuellen Offset")
    parser.add_argument("--set-offset", type=int, help="Offset manuell setzen")

    args = parser.parse_args()

    if args.reset_offset:
        reset_offset()
    elif args.set_offset is not None:
        save_state(args.set_offset)
        logging.info(f"✅ Offset manuell auf {args.set_offset} gesetzt.")
    elif args.show_stats:
        logging.info(f"📊 Aktueller Offset in {STATE_FILE}: {load_state()}")
    else:
        ingest_recipes(
            query=args.query,
            max_requests=args.limit_calls,
            batch_size=args.batch_size
        )

if __name__ == "__main__":
    main()
