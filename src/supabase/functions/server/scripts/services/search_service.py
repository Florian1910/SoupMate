import logging
import re
import sys
import math
import uuid
from typing import List, Dict, Any, Tuple, Set
from models.embedding import embedding_model
from services.database import DatabaseService
from config import TABLE_RECIPES, TABLE_ING, TABLE_LINK, TABLE_NUTRITION

class EmbeddingService:
    #Wrapper, wandelt in ein gesamten String um [Banana, Strawberry, Almond milk] - [banana strawberry almond milk]
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

            # 1. Erstelle Vektor für Query
            print(f"🔍 Erstelle Embedding für Query...", file=sys.stderr)
            try:
                query_embedding = embedding_model.embed(query) #erstellt Zahlenvektor
                print(f"🔍 Embedding Dimension: {len(query_embedding)}", file=sys.stderr)
                query_vector = embedding_model.vector_to_literal(query_embedding) #wichtig für Postgres Format
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
                    cur.execute(sql, [query_vector, query_vector, expanded_limit]) #Ausführung des SQL statements
                    rows = cur.fetchall()

                    print(f"✅ {len(rows)} Roh-Ergebnisse von DB", file=sys.stderr)

                    if len(rows) == 0:
                        print("❌ Keine Ergebnisse von SQL-Abfrage", file=sys.stderr)
                        return []

                    results = []
                    for idx, row in enumerate(rows):
                        recipe_id = row[0]

                        # Zeige Debug-Info für die ersten 3 Ergebnisse - Testen
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

                        # DEBUG für erste 3 Ergebnisse - Testen
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

    def _ingredients_similarity_for_ids(self, query: str, recipe_ids: List[str]) -> Dict[str, float]:
        """
        Berechnet die Zutaten-Similarity NUR für die gegebenen recipe_ids.
        Liefert ein Mapping: recipe_id -> ingredients_similarity (0.0–1.0)
        Aspekt der Verfeinerung der gegebenen Werte aus Semantischer Suche von oben
        """
        print(f"\n=== _ingredients_similarity_for_ids ===", file=sys.stderr)
        print(f"🔍 Query: '{query}'", file=sys.stderr)
        print(f"🔍 Anzahl recipe_ids: {len(recipe_ids)}", file=sys.stderr)

        if not recipe_ids:
            print("⚠️  Keine recipe_ids übergeben, breche ab.", file=sys.stderr)
            return {}

        try:
            # 1. Validiere und konvertiere UUIDs
            valid_uuids = []
            for recipe_id in recipe_ids:
                try:
                    uuid_obj = uuid.UUID(recipe_id)
                    valid_uuids.append(str(uuid_obj))
                except ValueError:
                    print(f"⚠️  Ungültige UUID: {recipe_id}", file=sys.stderr)
                    continue

            if not valid_uuids:
                print("❌ Keine gültigen UUIDs gefunden", file=sys.stderr)
                return {}

            # 2. Embedding für Query
            print(f"🔍 Erstelle Embedding für Query (Zutaten)...", file=sys.stderr)
            query_embedding = embedding_model.embed(query)
            query_vector = embedding_model.vector_to_literal(query_embedding)
            print(f"✅ Query-Vektor für Zutaten erstellt", file=sys.stderr)

            # 3. SQL-Query mit UUID-Array Vergleich der Ähnlichkeit aller Zutaten zu Query
            sql = f"""
                    WITH recipe_ingredients AS (
                        SELECT 
                            ri.recipe_id,
                            i.name,
                            1.0 - (i.name_embedding <=> %s::vector) AS similarity
                        FROM {TABLE_LINK} ri
                        JOIN {TABLE_ING} i ON ri.ingredient_id = i.ingredient_id
                        WHERE ri.recipe_id::text = ANY(%s)
                    ),
                    recipe_stats AS (
                        SELECT
                            recipe_id,
                            MAX(similarity) as best_match,
                            AVG(similarity) as avg_match,
                            COUNT(*) as ingredient_count
                        FROM recipe_ingredients
                        GROUP BY recipe_id
                    )
                    SELECT
                        recipe_id::text,
                        -- Kombiniere beste Übereinstimmung mit Durchschnitt
                        (best_match * 0.7 + avg_match * 0.3) as weighted_similarity,
                        best_match,
                        avg_match,
                        ingredient_count
                    FROM recipe_stats
                """

            similarity_map: Dict[str, float] = {}

            with self.db.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, [query_vector, valid_uuids])
                    rows = cur.fetchall()

                    print(f"✅ {len(rows)} Zutaten-Similarity Werte für Text-Results geladen", file=sys.stderr)

                    for row in rows:
                        recipe_id = row[0]
                        weighted_similarity = float(row[1]) if row[1] is not None else 0.0
                        best_match = float(row[2]) if row[2] is not None else 0.0
                        avg_match = float(row[3]) if row[3] is not None else 0.0
                        ingredient_count = int(row[4]) if row[4] is not None else 0

                        # Clamp den Wert zwischen 0 und 1
                        weighted_similarity = max(0.0, min(1.0, weighted_similarity))

                        # ✅ KEIN Boost mehr
                        similarity_map[str(recipe_id)] = weighted_similarity

                        print(f"   📊 Recipe {recipe_id}:", file=sys.stderr)
                        print(f"      - Best Match: {best_match:.4f}", file=sys.stderr)
                        print(f"      - Avg Match: {avg_match:.4f}", file=sys.stderr)
                        print(f"      - Weighted (Raw): {weighted_similarity:.4f}", file=sys.stderr)
                        print(f"      - Ingredient Count: {ingredient_count}", file=sys.stderr)

            return similarity_map

        except Exception as e:
            print(f"❌ ERROR in _ingredients_similarity_for_ids: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            return {}


    def search_combined(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Kombiniert Text- und Zutaten-Ähnlichkeit:
        - Schritt 1: Text-Suche (größeres Limit)
        - Schritt 2: Zutaten-Similarity NUR für diese Text-Ergebnisse
        - Schritt 3: Score = 0.7 * Text + 0.3 * Ingredients
        """
        print(f"\n=== START COMBINED SEARCH (NEU) ===", file=sys.stderr)
        print(f"🔍 Query: '{query}'", file=sys.stderr)

        TEXT_WEIGHT = 0.7
        ING_WEIGHT = 0.3

        print(f"⚖️  Gewichtung: {TEXT_WEIGHT * 100}% Text, {ING_WEIGHT * 100}% Zutaten", file=sys.stderr)

        # 1. Text-Ergebnisse holen (mit erweitertem Limit)
        expanded_limit = max(30, limit * 3)
        print(f"📝 1. Starte Text-Ähnlichkeitssuche mit expanded_limit={expanded_limit}...", file=sys.stderr)
        text_results = self.search_by_text(query, expanded_limit)
        print(f"✅ Text-Ähnlichkeit: {len(text_results)} Ergebnisse", file=sys.stderr)

        if not text_results:
            print("⚠️  Keine Text-Ergebnisse, breche kombinierte Suche ab.", file=sys.stderr)
            return []

        # 2. Zutaten-Similarity NUR für diese besten Text-Results (Top 15)
        top_15_recipe_ids = [r["recipe_id"] for r in text_results[:15]]
        ingredients_map = self._ingredients_similarity_for_ids(query, top_15_recipe_ids)

        print(f"🥕 Zutaten-Scores für {len(ingredients_map)} von 15 Text-Ergebnissen gefunden", file=sys.stderr)

        # 3. Kombiniert alle Text-Ergebnisse mit ihren Ingredients-Scores
        combined: List[Dict[str, Any]] = []

        for idx, r in enumerate(text_results[:15]):  # Nur die Top 15
            recipe_id = r["recipe_id"]
            text_score = float(r.get("score", 0.0))
            ingredients_score = float(ingredients_map.get(recipe_id, 0.0))

            final_score = text_score * TEXT_WEIGHT + ingredients_score * ING_WEIGHT

            enriched = {
                **r,
                "text_score": text_score,
                "ingredients_score": ingredients_score,
                "combined_score": final_score,
                "score": final_score
            }

            combined.append(enriched)

            if idx < 3:
                print(
                    f"   #{idx+1} {r['name'][:40]}... "
                    f"Text={text_score:.4f}, Zutaten={ingredients_score:.4f}, Final={final_score:.4f}",
                    file=sys.stderr
                )

        # 4. Sortieren & limitieren
        combined.sort(key=lambda x: x["score"], reverse=True)
        final_results = combined[:limit]

        print(f"🎯 {len(final_results)} finale kombinierte Ergebnisse", file=sys.stderr)
        if final_results:
            best = final_results[0]
            print(f"🏆 Bester kombinierter Score: {best['score']:.4f} ({best['name']})", file=sys.stderr)
            print(f"📊 Score-Verteilung (Top {min(5, len(final_results))}):", file=sys.stderr)
            for i, r in enumerate(final_results[:5]):
                print(
                    f"   {i+1}. {r['name'][:30]}...: {r['score']:.4f} "
                    f"(Text: {r.get('text_score', 0):.4f}×{TEXT_WEIGHT} "
                    f"+ Zutaten: {r.get('ingredients_score', 0):.4f}×{ING_WEIGHT})",
                    file=sys.stderr
                )

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
            name = row[0] or ""
            quantity_text = row[1] or ""

            # ENTFERNE PROBLEMATISCHE UNICODE-ZEICHEN
            if quantity_text:
                # Entferne spezielle Bruchzeichen
                fraction_chars = {
                    '½': '1/2', '⅓': '1/3', '⅔': '2/3',
                    '¼': '1/4', '¾': '3/4', '⅕': '1/5',
                    '⅖': '2/5', '⅗': '3/5', '⅘': '4/5',
                    '⅙': '1/6', '⅚': '5/6', '⅛': '1/8',
                    '⅜': '3/8', '⅝': '5/8', '⅞': '7/8'
                }

                for frac_char, replacement in fraction_chars.items():
                    quantity_text = quantity_text.replace(frac_char, replacement)

            ingredients.append({
                "name": name,
                "quantity_text": quantity_text,
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
