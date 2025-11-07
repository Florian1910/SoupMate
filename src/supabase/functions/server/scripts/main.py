#!/usr/bin/env python3
import argparse
import logging
import sys
from typing import List

from utils.helpers import setup_logging, print_json, format_recipe_details, format_search_results
from services.spoonacular import SpoonacularService
from services.database import DatabaseService
from services.embedding_service import EmbeddingService

def ingest_recipes(query: str = "", number: int = 20):
    """Importiert Rezepte von Spoonacular und speichert sie in der Datenbank"""
    spoonacular = SpoonacularService()
    db = DatabaseService()

    try:
        recipes_data = spoonacular.fetch_recipes(query=query, number=number)
        if not recipes_data:
            logging.warning("Keine Rezepte von Spoonacular erhalten.")
            return

        saved_count = 0
        for recipe_data in recipes_data:
            try:
                recipe = spoonacular.normalize_recipe(recipe_data)
                recipe_id = db.save_recipe(recipe)

                saved_count += 1
                logging.info(
                    f"({saved_count}/{len(recipes_data)}) gespeichert: {recipe.name} - "
                    f"{recipe.nutrition.calories} kcal, {recipe.price.price_per_serving}€/Portion, "
                    f"Schwierigkeit: {recipe.difficulty}/5"
                )

            except Exception as e:
                logging.error(f"Fehler beim Verarbeiten von Rezept '{recipe_data.get('title', 'Unbekannt')}': {e}")
                continue

        logging.info(f"Ingest fertig ✅ - {saved_count} Rezepte gespeichert")

    except Exception as e:
        logging.error(f"Fehler beim Ingestion-Prozess: {e}")
        sys.exit(1)

def search_by_text(query: str, limit: int, format_output: bool = False):
    """Führt eine textbasierte semantische Suche durch"""
    embedding_service = EmbeddingService()

    try:
        results = embedding_service.search_by_text(query, limit)

        if format_output:
            formatted = format_search_results(results)
            print(formatted)
        else:
            print_json(results)

    except Exception as e:
        logging.error(f"Fehler bei der Textsuche: {e}")
        sys.exit(1)

def search_by_ingredients(ingredients: List[str], limit: int, format_output: bool = False):
    """Führt eine zutatenbasierte semantische Suche durch"""
    embedding_service = EmbeddingService()

    try:
        results = embedding_service.search_by_ingredients(ingredients, limit)

        if format_output:
            formatted = format_search_results(results)
            print(formatted)
        else:
            print_json(results)

    except Exception as e:
        logging.error(f"Fehler bei der Zutaten-Suche: {e}")
        sys.exit(1)

def get_recipe_details(recipe_id: str):
    """Zeigt detaillierte Informationen zu einem Rezept an"""
    embedding_service = EmbeddingService()

    try:
        details = embedding_service.get_recipe_details(recipe_id)

        if "error" in details:
            print(details["error"])
        else:
            formatted_output = format_recipe_details(details)
            print(formatted_output)

    except Exception as e:
        logging.error(f"Fehler beim Abrufen der Rezept-Details: {e}")
        sys.exit(1)

def main():
    setup_logging()

    parser = argparse.ArgumentParser(
        description="SoupMate – Ingest & semantische Suche mit Nährwerten und Preisen in EUR"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Ingestion Parser
    ingest_parser = subparsers.add_parser("ingest", help="Rezepte von Spoonacular importieren")
    ingest_parser.add_argument("--query", default="", help="Optional: Spezifische Suchanfrage")
    ingest_parser.add_argument("--number", type=int, default=20, help="Anzahl der Rezepte")

    # Text Search Parser
    text_search_parser = subparsers.add_parser("search-text", help="Textbasierte semantische Suche")
    text_search_parser.add_argument("--q", required=True, help="Suchanfrage")
    text_search_parser.add_argument("--k", type=int, default=10, help="Anzahl der Ergebnisse")
    text_search_parser.add_argument("--format", action="store_true", help="Formatierte Ausgabe")

    # Ingredient Search Parser
    ing_search_parser = subparsers.add_parser("search-ingredients", help="Zutatenbasierte Suche")
    ing_search_parser.add_argument("--ing", nargs="+", required=True, help="Zutaten")
    ing_search_parser.add_argument("--k", type=int, default=10, help="Anzahl der Ergebnisse")
    ing_search_parser.add_argument("--format", action="store_true", help="Formatierte Ausgabe")

    # Details Parser
    details_parser = subparsers.add_parser("details", help="Rezept-Details anzeigen")
    details_parser.add_argument("--recipe-id", required=True, help="Recipe ID für Details")

    args = parser.parse_args()

    try:
        if args.command == "ingest":
            ingest_recipes(args.query, args.number)
        elif args.command == "search-text":
            search_by_text(args.q, args.k, getattr(args, 'format', False))
        elif args.command == "search-ingredients":
            search_by_ingredients(args.ing, args.k, getattr(args, 'format', False))
        elif args.command == "details":
            get_recipe_details(args.recipe_id)

    except KeyboardInterrupt:
        logging.info("Vorgang durch Benutzer abgebrochen")
        sys.exit(0)
    except Exception as e:
        logging.error(f"Unerwarteter Fehler: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()