# Reine Test datei für Semantische Zutaten suche
import sys
import os

# Pfade korrigieren
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from services.search_service import EmbeddingService

def test_ingredients_similarity():
    service = EmbeddingService()

    # Echte Recipe-IDs aus deiner Datenbank
    query = "Strawberry, Banana, Almond milk"

    # Hol dir ein paar echte Recipe-IDs aus der Datenbank
    # Hier ein Beispiel - ersetze mit tatsächlichen IDs
    recipe_ids = [
        "01257c56-b3d1-4da8-bde1-48203b5e63c7",  # Erste ID aus deinem Screenshot
        "90bd6015-e3b5-44d7-84ef-dcdac0f216f0",
        "35d5b37d-247e-4dad-8af5-7c5d199930fd"
    ]

    result = service.search_by_text_for_ingredients(query, recipe_ids)

    print("Test Ergebnisse für Zutaten-Ähnlichkeit:")
    for recipe_id, score in result.items():
        print(f"  {recipe_id[:8]}...: {score:.4f}")

if __name__ == "__main__":
    test_ingredients_similarity()