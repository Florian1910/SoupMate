import logging
import re
import sys
import math
from typing import List, Dict, Any, Tuple, Set
from models.embedding import embedding_model
from services.database import DatabaseService
from config import TABLE_RECIPES, TABLE_ING, TABLE_LINK, TABLE_NUTRITION

class EmbeddingService:
# Add this method to the EmbeddingService class in search_service.py
    def search_by_ingredients(self, ingredients: List[str], limit: int = 10) -> List[Dict[str, Any]]:
        """Search recipes by list of ingredients"""
        if not ingredients:
            return []

        # Combine ingredients into a query
        query = " ".join(ingredients)
        return self.search_by_text_for_ingredients(query, limit)

    def __init__(self):
        self.db = DatabaseService()
        self._all_ingredients_cache = None
        print("✅ EmbeddingService initialisiert", file=sys.stderr)

    def _get_all_ingredients(self) -> List[str]:
        """Holt alle Zutaten aus der DB (gecached)"""
        if self._all_ingredients_cache is None:
            try:
                with self.db.get_connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute(f"SELECT LOWER(name) FROM {TABLE_ING}")
                        self._all_ingredients_cache = [row[0] for row in cur.fetchall()]
                        print(f"📊 {len(self._all_ingredients_cache)} Zutaten aus DB geladen", file=sys.stderr)
            except Exception as e:
                print(f"❌ Fehler beim Laden der Zutaten: {e}", file=sys.stderr)
                self._all_ingredients_cache = []
        return self._all_ingredients_cache

    def search_by_text(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        print(f"\n=== DEBUG search_by_text ===", file=sys.stderr)
        print(f"Query: '{query}'", file=sys.stderr)

        try:
            # DEBUG 1: Datenbank prüfen
            with self.db.get_connection() as conn:
                with conn.cursor() as cur:
                    # Prüfe Rezept-Zahl
                    cur.execute(f"SELECT COUNT(*) FROM {TABLE_RECIPES}")
                    recipe_count = cur.fetchone()[0]
                    print(f"🔍 Rezepte in DB: {recipe_count}", file=sys.stderr)

                    # Prüfe ob Embeddings existieren
                    cur.execute(f"""
                        SELECT COUNT(*) 
                        FROM {TABLE_RECIPES} 
                        WHERE text_embedding IS NOT NULL 
                        AND ingredients_embedding IS NOT NULL
                    """)
                    embedding_count = cur.fetchone()[0]
                    print(f"🔍 Rezepte mit Embeddings: {embedding_count}", file=sys.stderr)

            if recipe_count == 0:
                print("❌ Keine Rezepte in der Datenbank!", file=sys.stderr)
                return []

            if embedding_count == 0:
                print("❌ Keine Embeddings in der Datenbank!", file=sys.stderr)
                # Fallback zu einfacher Textsuche
                return self._fallback_text_search(query, limit)

            # 1. Erstelle Vektor für Query
            print(f"🔍 Erstelle Embedding für Query...", file=sys.stderr)
            try:
                query_embedding = embedding_model.embed(query)
                print(f"🔍 Embedding Dimension: {len(query_embedding)}", file=sys.stderr)
                query_vector = embedding_model.vector_to_literal(query_embedding)
                print(f"🔍 Vektor erstellt (Länge: {len(query_vector)})", file=sys.stderr)
            except Exception as e:
                print(f"❌ Fehler beim Erstellen des Embeddings: {e}", file=sys.stderr)
                return []

            # 2. Einfache Vektor-Suche (ohne Optimierung)
            sql = f"""
                SELECT
                    r.recipe_id, r.name, r.description, r.instructions,
                    r.diet, r.vegan, r.vegetarian, r.total_time, r.difficulty,
                    r.calories, r.protein, r.carbohydrates, r.fat, r.price_per_serving,
                    r.image_url,
                    1.0 - (r.text_embedding <-> %s::vector) / 2.0 AS similarity
                FROM {TABLE_RECIPES} r
                WHERE r.text_embedding IS NOT NULL
                ORDER BY r.text_embedding <-> %s::vector
                LIMIT %s
            """

            expanded_limit = max(20, limit * 3)

            with self.db.get_connection() as conn:
                with conn.cursor() as cur:
                    print(f"🔍 Führe SQL-Abfrage aus mit limit={expanded_limit}...", file=sys.stderr)
                    cur.execute(sql, [query_vector, query_vector, expanded_limit])
                    rows = cur.fetchall()

                    print(f"✅ {len(rows)} Roh-Ergebnisse von DB", file=sys.stderr)

                    if len(rows) == 0:
                        print("❌ Keine Ergebnisse von SQL-Abfrage", file=sys.stderr)
                        return []

                    results = []
                    for idx, row in enumerate(rows):
                        recipe_id = row[0]

                        # Zeige Debug-Info für die ersten 3 Ergebnisse
                        if idx < 3:
                            print(f"🔍 Ergebnis {idx+1}: '{row[1]}', Similarity: {row[15]:.4f}", file=sys.stderr)

                        ingredients = self._get_recipe_ingredients(cur, recipe_id)

                        similarity = float(row[15]) if row[15] is not None else 0.0

                        results.append({
                            "recipe_id": recipe_id,
                            "name": row[1],
                            "description": row[2],
                            "instructions": row[3],
                            "diet": row[4],
                            "vegan": row[5],
                            "vegetarian": row[6],
                            "total_time": row[7],
                            "difficulty": row[8],
                            "calories": row[9],
                            "protein": row[10],
                            "carbohydrates": row[11],
                            "fat": row[12],
                            "price_per_serving": f"{row[13]}€" if row[13] is not None else None,
                            "image_url": row[14],
                            "score": similarity,
                            "ingredients": ingredients
                        })

                    print(f"🎯 {len(results[:limit])} finale Ergebnisse", file=sys.stderr)
                    return results[:limit]

        except Exception as e:
            print(f"❌ ERROR in search_by_text: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            return []


    def search_by_text_for_ingredients(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        print(f"\n=== START SEMANTISCHE ZUTATEN-SUCHE ===", file=sys.stderr)
        print(f"🔍 Query: '{query}'", file=sys.stderr)
        print(f"🔍 Suche nach ZUTATEN-Ähnlichkeit", file=sys.stderr)

        try:
            # 1. Erstelle Vektor für den Query (GLEICH wie in search_by_text)
            print(f"🔍 Erstelle Embedding für Query...", file=sys.stderr)
            query_embedding = embedding_model.embed(query)
            query_vector = embedding_model.vector_to_literal(query_embedding)
            print(f"✅ Query-Vektor erstellt", file=sys.stderr)

            # 2. SQL-Abfrage - aber mit ingredients_embedding!
            sql = f"""
                SELECT
                    r.recipe_id,
                    r.name,
                    r.description,
                    r.instructions,
                    r.diet,
                    r.vegan,
                    r.vegetarian,
                    r.total_time,
                    r.difficulty,
                    r.calories,
                    r.protein,
                    r.carbohydrates,
                    r.fat,
                    r.price_per_serving,
                    r.image_url,
                    -- Cosine Distance zu ZUTATEN-Embedding
                    (r.ingredients_embedding <-> %s::vector) AS ingredients_distance,
                    -- Similarity Score: 1 - (distance/2)
                    1.0 - (r.ingredients_embedding <-> %s::vector) / 2.0 AS ingredients_similarity
                FROM {TABLE_RECIPES} r
                WHERE r.ingredients_embedding IS NOT NULL
                ORDER BY r.ingredients_embedding <-> %s::vector ASC
                LIMIT %s
            """

            expanded_limit = max(30, limit * 3)

            print(f"🔍 Führe SQL-Abfrage für ZUTATEN aus...", file=sys.stderr)

            with self.db.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, [query_vector, query_vector, query_vector, expanded_limit])
                    rows = cur.fetchall()

                    print(f"✅ {len(rows)} Roh-Ergebnisse von DB (Zutaten)", file=sys.stderr)

                    if len(rows) == 0:
                        print("⚠️  Keine Ergebnisse für Zutaten-Suche", file=sys.stderr)
                        return []

                    results = []
                    for idx, row in enumerate(rows):
                        recipe_id = row[0]

                        # DEBUG für erste 3 Ergebnisse
                        if idx < 3:
                            print(f"   📊 Zutaten-Ergebnis {idx+1}: '{row[1]}'", file=sys.stderr)
                            print(f"      Zutaten-Distance: {row[15]:.4f}, Score: {row[16]:.4f}", file=sys.stderr)

                        ingredients = self._get_recipe_ingredients(cur, recipe_id)

                        ingredients_distance = float(row[15]) if row[15] is not None else 2.0
                        ingredients_similarity = float(row[16]) if row[16] is not None else 0.0

                        # Score = 100% Zutaten-Ähnlichkeit
                        final_score = ingredients_similarity
                        final_score = max(0.0, min(1.0, final_score))

                        results.append({
                            "recipe_id": recipe_id,
                            "name": row[1],
                            "description": row[2],
                            "instructions": row[3],
                            "diet": row[4],
                            "vegan": row[5],
                            "vegetarian": row[6],
                            "total_time": row[7],
                            "difficulty": row[8],
                            "calories": row[9],
                            "protein": row[10],
                            "carbohydrates": row[11],
                            "fat": row[12],
                            "price_per_serving": f"{row[13]}€" if row[13] is not None else None,
                            "image_url": row[14],
                            "ingredients_distance": ingredients_distance,
                            "ingredients_similarity": ingredients_similarity,
                            "score": final_score,
                            "ingredients": ingredients
                        })

                    results.sort(key=lambda x: x["score"], reverse=True)
                    final_results = results[:limit]

                    print(f"🎯 {len(final_results)} finale Zutaten-Ergebnisse", file=sys.stderr)
                    if final_results:
                        print(f"🏆 Bester Zutaten-Score: {final_results[0]['score']:.4f}", file=sys.stderr)

                    return final_results

        except Exception as e:
            print(f"❌ ERROR in search_by_text_for_ingredients: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            return []

    # In search_combined() Funktion:
    def search_combined(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Kombiniert Text- und Zutaten-Ähnlichkeit (90/10)"""
        print(f"\n=== START COMBINED SEARCH ===", file=sys.stderr)
        print(f"🔍 Query: '{query}'", file=sys.stderr)
        print(f"🔍 Kombiniere Text- und Zutaten-Ähnlichkeit (90%/10%)", file=sys.stderr)

        # 1. Text-Ähnlichkeit
        print(f"📝 1. Starte Text-Ähnlichkeitssuche...", file=sys.stderr)
        text_results = self.search_by_text(query, limit * 2)
        print(f"✅ Text-Ähnlichkeit: {len(text_results)} Ergebnisse", file=sys.stderr)

        # 2. Zutaten-Ähnlichkeit
        print(f"🥕 2. Starte Zutaten-Ähnlichkeitssuche...", file=sys.stderr)
        ingredients_results = self.search_by_text_for_ingredients(query, limit * 2)
        print(f"✅ Zutaten-Ähnlichkeit: {len(ingredients_results)} Ergebnisse", file=sys.stderr)

        # Debug: Zeige Top-Ergebnisse
        if text_results:
            print(f"📊 Top Text-Scores:", file=sys.stderr)
            for i, r in enumerate(text_results[:3]):
                print(f"   {i+1}. {r['name']}: {r.get('score', 0):.4f}", file=sys.stderr)

        if ingredients_results:
            print(f"📊 Top Zutaten-Scores:", file=sys.stderr)
            for i, r in enumerate(ingredients_results[:3]):
                print(f"   {i+1}. {r['name']}: {r.get('score', 0):.4f} (Dist: {r.get('ingredients_distance', 0):.4f})", file=sys.stderr)

        # 3. Kombiniere und gewichte
        combined = {}

        print(f"🧮 3. Kombiniere Scores...", file=sys.stderr)

        for result in text_results:
            recipe_id = result["recipe_id"]
            combined[recipe_id] = {
                **result,
                "text_score": result.get("score", 0),
                "ingredients_score": 0.0,
                "combined_score": result.get("score", 0) * 0.9,  # 90% Text
                "score": result.get("score", 0) * 0.9  # Haupt-Score für Kompatibilität
            }

        for result in ingredients_results:
            recipe_id = result["recipe_id"]
            ingredients_score = result.get("score", 0)

            if recipe_id in combined:
                # Füge Zutaten-Score hinzu (10%)
                old_score = combined[recipe_id]["score"]
                combined[recipe_id]["ingredients_score"] = ingredients_score
                combined[recipe_id]["score"] += ingredients_score * 0.1
                combined[recipe_id]["combined_score"] += ingredients_score * 0.1
            else:
                # Nur Zutaten-Score
                combined[recipe_id] = {
                    **result,
                    "text_score": 0.0,
                    "ingredients_score": ingredients_score,
                    "combined_score": ingredients_score * 0.1,
                    "score": ingredients_score * 0.1
                }

        # Sortiere nach score (nicht combined_score)
        final_results = sorted(combined.values(),
                               key=lambda x: x["score"],
                               reverse=True)[:limit]

        print(f"🎯 {len(final_results)} finale kombinierte Ergebnisse", file=sys.stderr)
        if final_results:
            print(f"🏆 Bester kombinierter Score: {final_results[0]['score']:.4f}", file=sys.stderr)
            print(f"📊 Score-Verteilung:", file=sys.stderr)
            for i, r in enumerate(final_results[:5]):
                print(f"   {i+1}. {r['name'][:30]}...: {r['score']:.4f} "
                      f"(Text: {r.get('text_score', 0):.4f}×0.9 + "
                      f"Zutaten: {r.get('ingredients_score', 0):.4f}×0.1)", file=sys.stderr)

        return final_results

    def _get_recipe_ingredients(self, cur, recipe_id: str) -> List[Dict[str, Any]]:
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

                ingredients = self._get_recipe_ingredients(cur, recipe_id)

                return {
                    "recipe": {
                        "name": recipe[0],
                        "description": recipe[1],
                        "instructions": recipe[2],
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
                    "ingredients": ingredients
                }