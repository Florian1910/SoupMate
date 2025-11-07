import logging
from typing import List, Dict, Any
from config import TABLE_RECIPES, TABLE_ING, TABLE_LINK
from models.embedding import embedding_model
from services.database import DatabaseService

class EmbeddingService:
    def __init__(self):
        self.db = DatabaseService()

    def search_by_text(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        query_vector = embedding_model.vector_to_literal(embedding_model.embed(query))

        with self.db.get_connection() as conn:
            with conn.cursor() as cur:
                # Haupt-Suche mit mehr Feldern
                cur.execute(
                    f"""
                    SELECT 
                        r.recipe_id, r.name, r.description, r.instructions, 
                        r.diet, r.vegan, r.vegetarian, r.total_time, r.difficulty,
                        r.calories, r.protein, r.carbohydrates, r.fat,
                        r.price_per_serving,
                        (r.text_embedding <-> %s::vector) as distance
                    FROM {TABLE_RECIPES} r
                    ORDER BY r.text_embedding <-> %s::vector
                    LIMIT %s
                    """,
                    (query_vector, query_vector, limit)
                )

                results = []
                for row in cur.fetchall():
                    recipe_id = row[0]

                    # Zutaten für dieses Rezept abrufen
                    ingredients = self._get_recipe_ingredients(cur, recipe_id)

                    results.append({
                        "recipe_id": recipe_id,
                        "name": row[1],
                        "description": row[2],
                        "instructions": row[3],  # ✅ Instructions hinzugefügt
                        "diet": row[4],
                        "vegan": row[5],
                        "vegetarian": row[6],
                        "total_time": row[7],
                        "difficulty": row[8],
                        "calories": row[9],
                        "protein": row[10],
                        "carbohydrates": row[11],
                        "fat": row[12],
                        "price_per_serving": f"{row[13]}€",
                        "distance": float(row[14]),
                        "ingredients": ingredients  # ✅ Ingredients hinzugefügt
                    })
                return results

    def search_by_ingredients(self, ingredients: List[str], limit: int = 10) -> List[Dict[str, Any]]:
        query_text = " ".join(ingredients)
        query_vector = embedding_model.vector_to_literal(embedding_model.embed(query_text))

        with self.db.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    SELECT 
                        r.recipe_id, r.name, r.description, r.instructions,
                        r.diet, r.vegan, r.vegetarian, r.total_time, r.difficulty,
                        r.calories, r.protein, r.carbohydrates, r.fat,
                        r.price_per_serving,
                        (r.ingredients_embedding <-> %s::vector) as distance
                    FROM {TABLE_RECIPES} r
                    ORDER BY r.ingredients_embedding <-> %s::vector
                    LIMIT %s
                    """,
                    (query_vector, query_vector, limit)
                )

                results = []
                for row in cur.fetchall():
                    recipe_id = row[0]

                    # Zutaten für dieses Rezept abrufen
                    ingredients_list = self._get_recipe_ingredients(cur, recipe_id)

                    results.append({
                        "recipe_id": row[0],
                        "name": row[1],
                        "description": row[2],
                        "instructions": row[3],  # ✅ Instructions hinzugefügt
                        "diet": row[4],
                        "vegan": row[5],
                        "vegetarian": row[6],
                        "total_time": row[7],
                        "difficulty": row[8],
                        "calories": row[9],
                        "protein": row[10],
                        "carbohydrates": row[11],
                        "fat": row[12],
                        "price_per_serving": f"{row[13]}€",
                        "distance": float(row[14]),
                        "ingredients": ingredients_list  # ✅ Ingredients hinzugefügt
                    })
                return results

    def _get_recipe_ingredients(self, cur, recipe_id: str) -> List[Dict[str, Any]]:
        """Holt alle Zutaten für ein Rezept"""
        cur.execute(
            f"""
            SELECT 
                i.name, 
                ri.quantity_text, 
                ri.amount, 
                ri.unit
            FROM {TABLE_LINK} ri
            JOIN {TABLE_ING} i ON ri.ingredient_id = i.ingredient_id
            WHERE ri.recipe_id = %s
            ORDER BY ri.amount DESC NULLS LAST
            """,
            (recipe_id,)
        )

        ingredients = []
        for row in cur.fetchall():
            ingredients.append({
                "name": row[0],
                "quantity_text": row[1],
                "amount": row[2],
                "unit": row[3]
            })

        return ingredients

    def get_recipe_details(self, recipe_id: str) -> Dict[str, Any]:
        with self.db.get_connection() as conn:
            with conn.cursor() as cur:
                # Grundlegende Rezeptinformationen
                cur.execute(
                    f"""
                    SELECT 
                        r.name, r.description, r.instructions, r.vegan, r.vegetarian, 
                        r.difficulty, r.diet, r.image_url, r.total_time, r.servings,
                        r.calories, r.protein, r.carbohydrates, r.fat, r.fiber, r.sugar, r.sodium,
                        r.price_per_serving
                    FROM {TABLE_RECIPES} r
                    WHERE r.recipe_id = %s
                    """,
                    (recipe_id,)
                )
                recipe = cur.fetchone()

                if not recipe:
                    return {"error": "Rezept nicht gefunden"}

                # Detaillierte Nährwerte
                cur.execute(
                    f"""
                    SELECT calories, protein, carbohydrates, fat, saturated_fat, fiber, sugar,
                           sodium, cholesterol, potassium, vitamin_a, vitamin_c, calcium, iron
                    FROM {TABLE_NUTRITION}
                    WHERE recipe_id = %s
                    """,
                    (recipe_id,)
                )
                nutrition = cur.fetchone()

                # Zutaten
                ingredients = self._get_recipe_ingredients(cur, recipe_id)

                return {
                    "recipe": {
                        "name": recipe[0],
                        "description": recipe[1],
                        "instructions": recipe[2],  # ✅ Instructions
                        "vegan": recipe[3],
                        "vegetarian": recipe[4],
                        "difficulty": recipe[5],
                        "diet": recipe[6],
                        "image_url": recipe[7],
                        "total_time": recipe[8],
                        "servings": recipe[9],
                        "calories": recipe[10],
                        "protein": recipe[11],
                        "carbohydrates": recipe[12],
                        "fat": recipe[13],
                        "fiber": recipe[14],
                        "sugar": recipe[15],
                        "sodium": recipe[16],
                        "price_per_serving": recipe[17]
                    },
                    "nutrition": nutrition if nutrition else None,
                    "ingredients": ingredients  # ✅ Bereits vorhanden
                }