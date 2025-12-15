#!/usr/bin/env python3
import sys
import json
import os
import argparse
import logging

# DEBUG: Welche Datei wird ausgeführt?
print(f"🔍 Python-Skript gestartet: {__file__}", file=sys.stderr)
print(f"🔍 Python Version: {sys.version}", file=sys.stderr)

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from services.search_service import EmbeddingService
    from services.spoonacular import SpoonacularService
    from services.database import DatabaseService
    from utils.helpers import (
        setup_logging,
        print_json,
        format_recipe_details,
        format_search_results,
    )
    CLI_AVAILABLE = True
except ImportError:
    CLI_AVAILABLE = False
    # Für TypeScript reicht EmbeddingService
    from services.search_service import EmbeddingService

def typescript_mode():
    """
    Erwartet als erstes Argument die Query,
    führt die kombinierte Suche aus.
    """
    try:
        if len(sys.argv) > 1:
            query = sys.argv[1]
        else:
            query = "test"

        limit = 10

        print(f"🔍 START COMBINED SEARCH for: '{query}'", file=sys.stderr)
        print(f"🔍 Limit: {limit}", file=sys.stderr)

        service = EmbeddingService()
        results = service.search_combined(query, limit)

        print(f"✅ COMBINED search completed: {len(results)} results", file=sys.stderr)

        output = json.dumps(results, ensure_ascii=False, default=str)
        sys.stdout.write(output)
        sys.stdout.flush()

    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        import traceback

        traceback.print_exc(file=sys.stderr)
        # Fehler: leeres JSON-Array an Frontend zurückgeben
        print(json.dumps([]))


#Debbugging für Terminal ohne Frontend
def search_by_text_cli(query: str, limit: int, format_output: bool = False):
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


def search_by_ingredients_cli(ingredients, limit: int, format_output: bool = False):
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


def get_recipe_details_cli(recipe_id: str):
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


def cli_mode():
    """CLI-Hauptfunktion für administrative Such- und Detail-Abfragen."""
    if not CLI_AVAILABLE:
        print("❌ CLI-Funktionen nicht verfügbar. Prüfe Imports.", file=sys.stderr)
        sys.exit(1)

    setup_logging()

    # Falls noch kein StreamHandler existiert, einen hinzufügen
    root_logger = logging.getLogger()
    has_stream_handler = any(
        isinstance(h, logging.StreamHandler) for h in root_logger.handlers
    )
    if not has_stream_handler:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO)
        formatter = logging.Formatter(
            "%(asctime)s - %(message)s", datefmt="%H:%M:%S"
        )
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)
        root_logger.setLevel(logging.INFO)

    parser = argparse.ArgumentParser(description="SoupMate CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Search Text
    text_parser = subparsers.add_parser("search-text", help="Textsuche")
    text_parser.add_argument("--q", required=True, help="Suchtext")
    text_parser.add_argument("--k", type=int, default=10, help="Anzahl Ergebnisse")
    text_parser.add_argument("--format", action="store_true", help="Schön formatiert ausgeben")

    # Search Ingredients
    ing_parser = subparsers.add_parser("search-ingredients", help="Zutatensuche")
    ing_parser.add_argument("--ing", nargs="+", required=True, help="Liste von Zutaten")
    ing_parser.add_argument("--k", type=int, default=10, help="Anzahl Ergebnisse")
    ing_parser.add_argument("--format", action="store_true", help="Schön formatiert ausgeben")

    # Details
    det_parser = subparsers.add_parser("details", help="Rezept-Details anzeigen")
    det_parser.add_argument("--recipe-id", required=True, help="Rezept-ID")

    args = parser.parse_args()

    try:
        if args.command == "search-text":
            search_by_text_cli(args.q, args.k, getattr(args, "format", False))
        elif args.command == "search-ingredients":
            search_by_ingredients_cli(args.ing, args.k, getattr(args, "format", False))
        elif args.command == "details":
            get_recipe_details_cli(args.recipe_id)

    except KeyboardInterrupt:
        print("\nAbbruch durch Benutzer.")
        sys.exit(0)
    except Exception as e:
        logging.error(f"Unerwarteter Fehler: {e}")
        print(f"CRITICAL ERROR: {e}")
        sys.exit(1)


# ====== HAUPTPROGRAMM ======
if __name__ == "__main__":
    """
    Heuristik:
    - Keine Argumente: TypeScript-Modus (leere Query, nur zum Testen)
    - Erstes Argument ist bekannter CLI-Befehl -> CLI-Modus
    - Sonst: TypeScript-Modus mit Query als erstem Argument
    """
    if len(sys.argv) == 1:
        # Keine Argumente = TypeScript-Modus mit Default-Query
        typescript_mode()
    else:
        cli_commands = ["search-text", "search-ingredients", "details"]
        if sys.argv[1] in cli_commands:
            cli_mode()
        else:
            # TypeScript-Modus mit Query als erstem Argument
            typescript_mode()
