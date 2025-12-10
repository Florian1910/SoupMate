# Reine Test datei für Semantische Zutaten suche
import sys
import os

# Pfade korrigieren
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from services.search_service import EmbeddingService

def test_ingredients_similarity():
    service = EmbeddingService()

    # Echte Recipe-IDs aus deiner Datenbank
    query = "Lentils, Malt Syrup or Molasses, Garbanzo Beans Soaked, Water, Onions"

    # Hol dir ein paar echte Recipe-IDs aus der Datenbank
    # Hier ein Beispiel - ersetze mit tatsächlichen IDs
    recipe_ids = [
        "01257c56-b3d1-4da8-bde1-48203b5e63c7",  # Erste ID aus deinem Screenshot
        "02444f2b-4f55-478c-9fd7-fe7caeae14f0",
        "63092d80-def2-4cd4-b833-a79b3dcfac7c"
    ]

    result = service._ingredients_similarity_for_ids(query, recipe_ids)

    print("Test Ergebnisse für Zutaten-Ähnlichkeit:")
    for recipe_id, score in result.items():
        print(f"  {recipe_id[:8]}...: {score:.4f}")

if __name__ == "__main__":
    test_ingredients_similarity()