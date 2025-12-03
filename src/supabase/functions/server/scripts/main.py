#!/usr/bin/env python3
# Der zentrale Einstiegspunkt (Entry Point) für das CLI-Tool.

import argparse
import logging
import sys
import json
import os
import time
from typing import List

# Importiere Module (Pfade relativ zum Ausführungsort)
from utils.helpers import setup_logging, print_json, format_recipe_details, format_search_results
from services.spoonacular import SpoonacularService
from services.database import DatabaseService
from services.search_service import EmbeddingService

STATE_FILE = "ingest_state.json"

def load_state():
    """Lädt den letzten Offset aus einer Datei."""
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r") as f:
                data = json.load(f)
                return data.get("offset", 0)
        except Exception:
            return 0
    return 0

def save_state(offset):
    """Speichert den aktuellen Offset in eine Datei."""
    with open(STATE_FILE, "w") as f:
        json.dump({"offset": offset}, f)

def ingest_recipes(query: str = "", max_requests: int = 50):
    """
    Importiert Rezepte in einer Schleife (Pagination).
    """
    spoonacular = SpoonacularService()
    db = DatabaseService()

    # 1. Start-Offset laden
    current_offset = load_state()
    recipes_per_call = 100

    logging.info(f"🚀 START: Ingest beginnt bei Offset: {current_offset}")

    total_saved_session = 0

    # 2. Schleife
    for i in range(max_requests):
        logging.info(f"--- Batch {i+1}/{max_requests} (Lade Offset {current_offset}) ---")

        try:
            recipes_data = spoonacular.fetch_recipes(
                query=query,
                number=recipes_per_call,
                offset=current_offset
            )

            if not recipes_data:
                logging.warning("⚠️ Keine weiteren Rezepte gefunden (Ende der Liste).")
                break

            saved_count = 0
            for recipe_data in recipes_data:
                try:
                    recipe = spoonacular.normalize_recipe(recipe_data)
                    db.save_recipe(recipe)
                    saved_count += 1
                    # Kleines Feedback alle 10 Rezepte
                    if saved_count % 10 == 0:
                        print(f"   ... {saved_count} Rezepte verarbeitet ...")
                except Exception as e:
                    logging.warning(f"Überspringe Rezept: {e}")
                    continue

            total_saved_session += saved_count
            logging.info(f"✅ Batch fertig: {saved_count} Rezepte gespeichert.")

            # 3. Offset erhöhen & speichern
            current_offset += recipes_per_call
            save_state(current_offset)

            if len(recipes_data) < recipes_per_call:
                logging.info("🏁 Alle verfügbaren Rezepte geladen.")
                break

            time.sleep(1)

        except Exception as e:
            logging.error(f"❌ Kritischer Fehler: {e}")
            break

    logging.info(f"🎉 Session beendet. Gespeichert: {total_saved_session}")
    logging.info(f"👉 Nächster Start bei Offset: {current_offset}")


# --- Such-Funktionen ---

def search_by_text(query: str, limit: int, format_output: bool = False):
    embedding_service = EmbeddingService()
    try:
        results = embedding_service.search_by_text(query, limit)
        if format_output:
            print(format_search_results(results))
        else:
            print_json(results)
    except Exception as e:
        logging.error(f"Fehler bei Textsuche: {e}")
        sys.exit(1)

def search_by_ingredients(ingredients: List[str], limit: int, format_output: bool = False):
    embedding_service = EmbeddingService()
    try:
        results = embedding_service.search_by_ingredients(ingredients, limit)
        if format_output:
            print(format_search_results(results))
        else:
            print_json(results)
    except Exception as e:
        logging.error(f"Fehler bei Zutaten-Suche: {e}")
        sys.exit(1)

def get_recipe_details(recipe_id: str):
    embedding_service = EmbeddingService()
    try:
        details = embedding_service.get_recipe_details(recipe_id)
        if "error" in details:
            print(details["error"])
        else:
            print(format_recipe_details(details))
    except Exception as e:
        logging.error(f"Fehler bei Details: {e}")
        sys.exit(1)


# --- MAIN ---

def main():
    # 1. Standard-Logging Setup
    setup_logging()

    # 2. FORCE CONSOLE OUTPUT
    # Falls setup_logging() nur in eine Datei schreibt, erzwingen wir hier die Ausgabe.
    root_logger = logging.getLogger()
    has_stream_handler = any(isinstance(h, logging.StreamHandler) for h in root_logger.handlers)
    if not has_stream_handler:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO)
        formatter = logging.Formatter('%(asctime)s - %(message)s', datefmt='%H:%M:%S')
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)
        root_logger.setLevel(logging.INFO)
        print("DEBUG: Konsole-Logging wurde manuell aktiviert.")

    parser = argparse.ArgumentParser(description="SoupMate CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Ingest
    ingest_parser = subparsers.add_parser("ingest", help="Rezepte importieren")
    ingest_parser.add_argument("--query", default="", help="Optional Query")
    ingest_parser.add_argument("--limit-calls", type=int, default=50, help="Max Calls")

    # Search Text
    text_parser = subparsers.add_parser("search-text", help="Textsuche")
    text_parser.add_argument("--q", required=True)
    text_parser.add_argument("--k", type=int, default=10)
    text_parser.add_argument("--format", action="store_true")

    # Search Ingredients
    ing_parser = subparsers.add_parser("search-ingredients", help="Zutatensuche")
    ing_parser.add_argument("--ing", nargs="+", required=True)
    ing_parser.add_argument("--k", type=int, default=10)
    ing_parser.add_argument("--format", action="store_true")

    # Details
    det_parser = subparsers.add_parser("details", help="Details")
    det_parser.add_argument("--recipe-id", required=True)

    args = parser.parse_args()

    try:
        if args.command == "ingest":
            ingest_recipes(query=args.query, max_requests=args.limit_calls)
        elif args.command == "search-text":
            search_by_text(args.q, args.k, getattr(args, 'format', False))
        elif args.command == "search-ingredients":
            search_by_ingredients(args.ing, args.k, getattr(args, 'format', False))
        elif args.command == "details":
            get_recipe_details(args.recipe_id)

    except KeyboardInterrupt:
        print("\nAbbruch durch Benutzer.")
        sys.exit(0)
    except Exception as e:
        logging.error(f"Unerwarteter Fehler: {e}")
        print(f"CRITICAL ERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()