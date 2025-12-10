#!/usr/bin/env python3
"""
ingest_recipes.py
Importiert Rezepte von der Spoonacular API inklusive Vektor-Embeddings.
"""

import argparse
import logging
import sys
import json
import os
import time
from typing import List

# Importiere benötigte Module
try:
    from services.spoonacular import SpoonacularService
    from services.database import DatabaseService
except ImportError as e:
    # Füge parent directory zum Pfad hinzu
    import sys
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from services.spoonacular import SpoonacularService
    from services.database import DatabaseService

# Logging Setup
def setup_logging():
    """Konfiguriert das Logging-System."""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler('ingest.log')
        ]
    )

# State Management
STATE_FILE = "ingest_state.json"

def load_state():
    """Lädt den letzten Offset aus einer Datei."""
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r") as f:
                data = json.load(f)
                return data.get("offset", 0)
        except Exception as e:
            logging.warning(f"Fehler beim Laden des States: {e}")
            return 0
    return 0

def save_state(offset):
    """Speichert den aktuellen Offset in eine Datei."""
    try:
        with open(STATE_FILE, "w") as f:
            json.dump({"offset": offset}, f)
        logging.info(f"State gespeichert: Offset {offset}")
    except Exception as e:
        logging.error(f"Fehler beim Speichern des States: {e}")

def set_manual_offset(offset_value: int):
    """Setzt den Offset manuell auf einen bestimmten Wert."""
    save_state(offset_value)
    logging.info(f"✅ Offset manuell auf {offset_value} gesetzt.")
    logging.info(f"   Nächster Import startet bei Position {offset_value}")

# Haupt-Ingest-Funktionen
def ingest_one_recipe(query: str = ""):
    """
    Importiert EIN einzelnes Rezept für Testzwecke.
    """
    logging.info(f"🚀 START: Importiere EIN Rezept für Query: '{query}'")

    spoonacular = SpoonacularService()
    db = DatabaseService()

    try:
        # Hole nur ein Rezept
        recipes_data = spoonacular.fetch_recipes(
            query=query,
            number=1,  # Nur ein Rezept
            offset=0
        )

        if not recipes_data:
            logging.warning("⚠️ Keine Rezepte gefunden!")
            return

        logging.info(f"📥 {len(recipes_data)} Rezept(e) von API empfangen")

        # Verarbeite das erste Rezept
        recipe_data = recipes_data[0]
        recipe = spoonacular.normalize_recipe(recipe_data)

        # Speichere in der Datenbank
        recipe_id = db.save_recipe(recipe)

        logging.info(f"✅ Rezept erfolgreich importiert!")
        logging.info(f"   Name: {recipe.name}")
        logging.info(f"   Rezept ID: {recipe_id}")
        logging.info(f"   Zutaten: {len(recipe.ingredients)}")
        logging.info(f"   Text-Embedding Dimension: {len(recipe.text_embedding)}")
        logging.info(f"   Zutaten-Embedding Dimension: {len(recipe.ingredients_embedding)}")

        return recipe_id

    except Exception as e:
        logging.error(f"❌ Fehler beim Import: {e}")
        import traceback
        traceback.print_exc()
        return None

def check_database_count():
    """Prüft wie viele Rezepte bereits in der Datenbank sind."""
    try:
        db = DatabaseService()
        with db.get_connection() as conn:
            with conn.cursor() as cur:
                # Prüfe Rezept-Zahl in der Datenbank
                from config import TABLE_RECIPES
                cur.execute(f"SELECT COUNT(*) FROM {TABLE_RECIPES}")
                db_count = cur.fetchone()[0]
                return db_count
    except Exception as e:
        logging.error(f"❌ Fehler beim Prüfen der DB: {e}")
        return 0

def check_max_available_recipes(query: str = ""):
    """Prüft wie viele Rezepte maximal verfügbar sind."""
    try:
        spoonacular = SpoonacularService()
        # Test-Aufruf mit minimaler Anzahl
        test_data = spoonacular.fetch_recipes(
            query=query,
            number=1,
            offset=0
        )

        if not test_data:
            return 0

        # Spoonacular API gibt die Gesamtzahl in der Antwort zurück
        # In der Realität müssen wir vielleicht mehrere Aufrufe machen
        # Für jetzt geben wir eine Schätzung zurück
        logging.info("ℹ️  Hinweis: Die maximale Anzahl verfügbarer Rezepte kann von Spoonacular limitiert sein.")
        return 1000  # Spoonacular's typisches Limit für kostenlose API

    except Exception as e:
        logging.error(f"❌ Fehler beim Prüfen verfügbarer Rezepte: {e}")
        return 0

def ingest_recipes(query: str = "", max_requests: int = 50, batch_size: int = 100):
    """
    Importiert Rezepte in Batches (Pagination).
    Hauptfunktion für die CLI.
    """
    spoonacular = SpoonacularService()
    db = DatabaseService()

    # Lade aktuellen Offset
    current_offset = load_state()

    # Prüfe wie viele Rezepte bereits in der DB sind
    db_count = check_database_count()
    max_available = check_max_available_recipes(query)

    logging.info(f"📊 Aktuelle Statistik:")
    logging.info(f"   Rezepte in Datenbank: {db_count}")
    logging.info(f"   Gespeicherter Offset: {current_offset}")
    logging.info(f"   Maximal verfügbar (geschätzt): {max_available}")

    if current_offset >= max_available and max_available > 0:
        logging.warning(f"⚠️  Offset {current_offset} erreicht oder überschreitet das geschätzte Maximum von {max_available}")
        logging.info("   Tipp: Setze den Offset zurück oder ändere die Query.")

    total_saved_session = 0

    logging.info(f"🚀 START: Import beginnt bei Offset: {current_offset}")
    logging.info(f"   Query: '{query}'")
    logging.info(f"   Max Requests: {max_requests}")
    logging.info(f"   Batch Size: {batch_size}")

    for batch_num in range(max_requests):
        logging.info(f"--- Batch {batch_num+1}/{max_requests} (Offset {current_offset}) ---")

        try:
            # Hole Rezepte von der API
            recipes_data = spoonacular.fetch_recipes(
                query=query,
                number=batch_size,
                offset=current_offset
            )

            if not recipes_data:
                logging.warning("⚠️ Keine weiteren Rezepte gefunden (Ende der Liste).")
                # Keine weiteren Rezepte, setze Offset auf aktuellen Wert
                save_state(current_offset)
                break

            logging.info(f"📥 {len(recipes_data)} Rezepte von API empfangen")

            # Verarbeite und speichere jedes Rezept
            saved_count = 0
            for idx, recipe_data in enumerate(recipes_data):
                try:
                    recipe = spoonacular.normalize_recipe(recipe_data)
                    recipe_id = db.save_recipe(recipe)
                    saved_count += 1

                    # Status für ersten Batch
                    if batch_num == 0 and saved_count == 1:
                        logging.info(f"   Erste Rezept-ID: {recipe_id}")
                        logging.info(f"   Erster Rezept-Name: {recipe.name}")

                except Exception as e:
                    logging.warning(f"⚠️ Überspringe Rezept {idx+1}: {e}")
                    continue

            total_saved_session += saved_count
            logging.info(f"✅ Batch fertig: {saved_count} Rezepte gespeichert.")

            # WICHTIG: Aktualisiere Offset um die tatsächliche Anzahl der empfangenen Rezepte
            current_offset += len(recipes_data)
            save_state(current_offset)

            # Prüfe ob wir weniger Rezepte bekommen haben als angefragt
            # Das bedeutet, dass keine weiteren Rezepte verfügbar sind
            if len(recipes_data) < batch_size:
                logging.info("🏁 Alle verfügbaren Rezepte geladen.")
                logging.info(f"   Letzter API-Aufruf: {len(recipes_data)} Rezepte (von {batch_size} angefragt)")
                break

            # Kurze Pause zwischen API-Calls
            time.sleep(1)

        except Exception as e:
            logging.error(f"❌ Kritischer Fehler in Batch {batch_num+1}: {e}")
            break

    # Finale Statistik
    new_db_count = check_database_count()
    added_count = new_db_count - db_count

    logging.info(f"🎉 Import beendet.")
    logging.info(f"   Gesamt in Datenbank: {new_db_count} Rezepte")
    logging.info(f"   Diese Session hinzugefügt: {added_count}")
    logging.info(f"   Nächster Start bei Offset: {current_offset}")

    if added_count == 0 and current_offset > 0:
        logging.info("💡 Tipp: Es scheint keine neuen Rezepte mehr verfügbar zu sein.")
        logging.info("   Versuche eine andere Query oder setze den Offset zurück.")

def reset_offset():
    """Setzt den Offset auf 0 zurück."""
    save_state(0)
    logging.info("✅ Offset wurde auf 0 zurückgesetzt.")
    logging.info("   Nächster Import startet wieder von vorne.")

# Main Function mit dem ursprünglichen CLI-Interface
def main():
    """Hauptfunktion der CLI - mit dem ursprünglichen Interface."""
    setup_logging()

    parser = argparse.ArgumentParser(
        description="Importiere Rezepte von Spoonacular API inklusive Vektor-Embeddings"
    )

    parser.add_argument("--query", default="", help="Suchbegriff (optional)")
    parser.add_argument("--limit-calls", type=int, default=50,
                        help="Maximale Anzahl API-Calls (default: 50)")
    parser.add_argument("--batch-size", type=int, default=100,
                        help="Rezepte pro API-Call (default: 100)")
    parser.add_argument("--test-one", action="store_true",
                        help="Nur EIN Rezept importieren (Testmodus)")
    parser.add_argument("--reset-offset", action="store_true",
                        help="Setzt den Offset auf 0 zurück")
    parser.add_argument("--show-stats", action="store_true",
                        help="Zeigt Statistiken an")
    parser.add_argument("--set-offset", type=int,
                        help="Setzt den Offset manuell auf einen bestimmten Wert")

    args = parser.parse_args()

    try:
        if args.set_offset is not None:
            set_manual_offset(args.set_offset)

        elif args.show_stats:
            db_count = check_database_count()
            current_offset = load_state()
            max_available = check_max_available_recipes(args.query)

            logging.info(f"📊 Statistiken:")
            logging.info(f"   Rezepte in Datenbank: {db_count}")
            logging.info(f"   Gespeicherter Offset: {current_offset}")
            logging.info(f"   Maximal verfügbar (geschätzt): {max_available}")
            logging.info(f"   Noch verfügbar (geschätzt): {max(0, max_available - current_offset)}")

        elif args.reset_offset:
            reset_offset()

        elif args.test_one:
            recipe_id = ingest_one_recipe(query=args.query)
            if recipe_id:
                logging.info(f"🎯 Test erfolgreich! Rezept-ID: {recipe_id}")
            else:
                logging.error("❌ Test fehlgeschlagen!")
                sys.exit(1)
        else:
            ingest_recipes(
                query=args.query,
                max_requests=args.limit_calls,
                batch_size=args.batch_size
            )

    except KeyboardInterrupt:
        print("\n🔴 Import durch Benutzer abgebrochen.")
        sys.exit(0)
    except Exception as e:
        logging.error(f"💥 Unerwarteter Fehler: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()