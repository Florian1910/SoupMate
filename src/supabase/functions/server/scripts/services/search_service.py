import logging
import re
import sys
import math
from typing import List, Dict, Any, Tuple, Set
from models.embedding import embedding_model
from services.database import DatabaseService
from config import TABLE_RECIPES, TABLE_ING, TABLE_LINK, TABLE_NUTRITION

class EmbeddingService:
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

    def _extract_ingredients_simple(self, query: str) -> List[Tuple[str, float]]:
        """Einfache Extraktion von Zutaten - nur exakte Matches"""
        query_lower = query.lower()
        all_ingredients = self._get_all_ingredients()

        # Einfache Suche: Prüfe ob Zutat als Wort im Query vorkommt
        found = []
        for ingredient in all_ingredients:
            if len(ingredient) < 3:
                continue

            # Suche nach ganzen Wörtern
            pattern = r'\b' + re.escape(ingredient) + r'\b'
            if re.search(pattern, query_lower):
                position = query_lower.find(ingredient)
                found.append((ingredient, position))

        # Entferne Duplikate
        unique_ingredients = []
        seen = set()
        for ingredient, position in found:
            if ingredient not in seen:
                seen.add(ingredient)
                unique_ingredients.append((ingredient, position))

        # Exponentielle Gewichtung
        weighted = []
        for i, (ingredient, _) in enumerate(unique_ingredients):
            weight = math.pow(2/3, i)
            weighted.append((ingredient, weight))

        print(f"🔍 Einfache Zutatenextraktion: {weighted}", file=sys.stderr)
        return weighted

    def search_by_text(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        print(f"\n=== START search_by_text ===", file=sys.stderr)
        print(f"Query: '{query}'", file=sys.stderr)

        try:
            # 1. Einfache Zutatenextraktion
            weighted_ingredients = self._extract_ingredients_simple(query)

            # 2. Vektor-Suche (ohne komplexe Filter)
            query_vector = embedding_model.vector_to_literal(embedding_model.embed(query))

            sql = f"""
                WITH q AS (SELECT %s::vector AS qv)
                SELECT
                    r.recipe_id, r.name, r.description, r.instructions,
                    r.diet, r.vegan, r.vegetarian, r.total_time, r.difficulty,
                    r.calories, r.protein, r.carbohydrates, r.fat, r.price_per_serving,
                    r.image_url,
                    (r.text_embedding <-> q.qv) AS d_text,
                    (r.ingredients_embedding <-> q.qv) AS d_ing,
                    -- Einfacher Score: 1 - (Abstand/2)
                    1.0 - (r.text_embedding <-> q.qv) / 2.0 AS base_score
                FROM {TABLE_RECIPES} r
                CROSS JOIN q
                WHERE 1=1
                ORDER BY base_score DESC
                LIMIT %s
            """

            expanded_limit = max(50, limit * 10)

            with self.db.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, [query_vector, expanded_limit])
                    rows = cur.fetchall()

                    print(f"✅ {len(rows)} Rezepte gefunden", file=sys.stderr)

                    results = []
                    for row in rows:
                        recipe_id = row[0]
                        ingredients = self._get_recipe_ingredients(cur, recipe_id)

                        base_score = float(row[17]) if row[17] is not None else 0.0

                        # ZUTATEN-MATCH-BOOST (vereinfacht)
                        ingredient_match_score = 0
                        if weighted_ingredients and ingredients:
                            recipe_ingredient_names = [ing["name"].lower() for ing in ingredients]

                            matched_count = 0
                            for query_ingredient, _ in weighted_ingredients:
                                # Einfaches Matching: Prüfe ob die Zutat im Rezept vorkommt
                                query_ing_lower = query_ingredient.lower()
                                found = False

                                for recipe_ing in recipe_ingredient_names:
                                    # Entferne 's' am Ende für einfache Pluralerkennung
                                    recipe_base = recipe_ing.rstrip('s')
                                    query_base = query_ing_lower.rstrip('s')

                                    if query_ing_lower in recipe_ing or recipe_ing in query_ing_lower:
                                        found = True
                                        break
                                    elif query_base == recipe_base:
                                        found = True
                                        break

                                if found:
                                    matched_count += 1

                            total_query_ingredients = len(weighted_ingredients)
                            if total_query_ingredients > 0:
                                ingredient_match_score = matched_count / total_query_ingredients

                        # FINALER SCORE: 70% Base Score + 30% Ingredient Match
                        final_score = (base_score * 0.7) + (ingredient_match_score * 0.3)
                        final_score = max(0, min(1, final_score))

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
                            "distance_text": float(row[15]) if row[15] is not None else None,
                            "distance_ingredients": float(row[16]) if row[16] is not None else None,
                            "score": final_score,
                            "base_score": base_score,
                            "ingredient_match_score": ingredient_match_score,
                            "ingredients": ingredients,
                            "query_ingredients": [ing for ing, _ in weighted_ingredients]
                        })

                    # Sortieren nach finalem Score
                    results.sort(key=lambda x: x["score"], reverse=True)

                    print(f"🎯 {len(results[:limit])} finale Ergebnisse", file=sys.stderr)
                    return results[:limit]

        except Exception as e:
            print(f"❌ ERROR in search_by_text: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            return []

    def search_by_ingredients(self, ingredients: List[str], limit: int = 10) -> List[Dict[str, Any]]:
        if not ingredients:
            return []

        PRIMARY_WEIGHT = 2.0
        DECAY = 1.0

        single_vecs: List[List[float]] = []
        weights: List[float] = []
        for idx, ing in enumerate(ingredients):
            v = embedding_model.embed(ing)
            single_vecs.append(v)
            w = (PRIMARY_WEIGHT if idx == 0 else (DECAY ** idx))
            weights.append(w)

        dim = len(single_vecs[0])
        weighted = [0.0] * dim
        weight_sum = 0.0
        for v, w in zip(single_vecs, weights):
            for i in range(dim):
                weighted[i] += w * v[i]
            weight_sum += w
        if weight_sum > 0:
            weighted = [x / weight_sum for x in weighted]

        query_vector = embedding_model.vector_to_literal(weighted)
        expanded_limit = max(20, int(limit) * 5)

        with self.db.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    SELECT 
                        r.recipe_id, r.name, r.description, r.instructions,
                        r.diet, r.vegan, r.vegetarian, r.total_time, r.difficulty,
                        r.calories, r.protein, r.carbohydrates, r.fat,
                        r.price_per_serving, r.image_url,
                        (r.ingredients_embedding <-> %s::vector) AS d_ing
                    FROM {TABLE_RECIPES} r
                    ORDER BY r.ingredients_embedding <-> %s::vector
                    LIMIT %s
                    """,
                    (query_vector, query_vector, expanded_limit)
                )

                rows = cur.fetchall()

                seen_titles = set()
                results: List[Dict[str, Any]] = []

                for row in rows:
                    recipe_id = row[0]
                    name = row[1] or ""

                    if name in seen_titles:
                        continue

                    ingredients_list = self._get_recipe_ingredients(cur, recipe_id)

                    results.append({
                        "recipe_id": recipe_id,
                        "name": name,
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
                        "distance": float(row[15]) if row[15] is not None else None,
                        "distance_ingredients": float(row[15]) if row[15] is not None else None,
                        "ingredients": ingredients_list
                    })

                    seen_titles.add(name)

                    if len(results) >= limit:
                        break

                return results

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