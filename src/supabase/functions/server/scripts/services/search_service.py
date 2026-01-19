import sys
from typing import Any, Dict, List, Tuple
from models.embedding import embedding_model
from services.database import DatabaseService
from config import TABLE_RECIPES, TABLE_ING, TABLE_LINK, TABLE_NUTRITION


class EmbeddingService:

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
                query_vector = embedding_model.vector_to_literal(query_embedding) #wichtig für Postgres Format - Distanzberechnung
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


    #altes konzept - Problem mit 0 Ergebenissen
    def search_by_text_for_ingredients(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        print(f"\n=== START SEMANTISCHE ZUTATEN-SUCHE ===", file=sys.stderr)
        print(f"🔍 Query: '{query}'", file=sys.stderr)
        print(f"🔍 Suche nach ZUTATEN-Ähnlichkeit", file=sys.stderr)

        try:
            # 1. Erstelle Vektor für den Query (Gleich wie in search_by_text)
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


    def search_combined(self, query: str, limit: int = 10, ingredients_query: str = "") -> List[Dict[str, Any]]:
        """
        RE-RANKING:

        1) Kandidaten holen über Text-Embedding (expanded)
        2) NUR diese Kandidaten mit ingredients_embedding bewerten (Similarity)
        3) Final Score = 0.7 * Text + 0.3 * Zutaten (wenn Zutaten vorhanden)
           - Wenn Zutaten-Embedding fehlt: keine "0-Strafe", sondern nur Textscore

        Ergebnis: Keine "ingredients_score = 0" nur weil Rezept nicht in einer zweiten Top-N Liste war.
        """



        print(f"\n=== START COMBINED SEARCH (RE-RANK TEXT → INGREDIENTS) ===", file=sys.stderr)
        print(f"🔍 Query: '{query}'", file=sys.stderr)

        TEXT_WEIGHT = 0.7
        ING_WEIGHT = 0.3
        expanded_limit = max(30, limit * 3)

        print(f"⚖️  Gewichtung: {TEXT_WEIGHT * 100:.0f}% Text, {ING_WEIGHT * 100:.0f}% Zutaten", file=sys.stderr)
        print(f"🧲 Expanded candidates: {expanded_limit}", file=sys.stderr)

        # ---------------------------------------------------------------------
        # 1) Text-Kandidaten holen
        # ---------------------------------------------------------------------
        print(f"📝 1. Text-Suche (Candidates) ...", file=sys.stderr)
        text_results = self.search_by_text(query, expanded_limit)
        print(f"✅ Text-Suche: {len(text_results)} Ergebnisse", file=sys.stderr)

        if not text_results:
            print("⚠️  Keine Text-Ergebnisse -> return [].", file=sys.stderr)
            return []

        # recipe_id rausholen
        candidate_ids = [r["recipe_id"] for r in text_results if r.get("recipe_id")]

        # text score map von allen ergebnissen
        text_score_map: Dict[str, float] = {
            r["recipe_id"]: float(r.get("score", 0.0)) for r in text_results
        }

        # base data aus text_results (enthält komplettes Rezept Objekt)
        base_by_id: Dict[str, Dict[str, Any]] = {r["recipe_id"]: r for r in text_results}

        # ---------------------------------------------------------------------
        # 2) Zutaten-Score nur für diese Kandidaten berechnen
        # ---------------------------------------------------------------------
        ing_q = (ingredients_query.strip() if ingredients_query else "").strip()
        if not ing_q:
            # fallback: wenn kein ingredients_query vorhanden, nutze query
            ing_q = query

        print(f"🥕 2. Zutaten-Re-Ranking Query: '{ing_q}'", file=sys.stderr)

        # Query-Embedding (ingredients) erzeugen
        try:
            query_embedding = embedding_model.embed(ing_q)
            query_vector = embedding_model.vector_to_literal(query_embedding)
        except Exception as e:
            print(f"❌ Fehler beim Erstellen des Zutaten-Embeddings: {e}", file=sys.stderr)
            # Wenn Embedding nicht geht: liefere einfach Text-Ranking
            final_results = text_results[:limit]
            for r in final_results:
                r["text_score"] = float(r.get("score", 0.0))
                r["ingredients_score"] = None
                r["combined_score"] = float(r.get("score", 0.0))
                r["score"] = r["combined_score"]
            return final_results

        # Zutaten-Scores für Kandidaten abfragen (nur IN (...)!)
        # - Wenn ein Rezept kein ingredients_embedding hat, kommt es nicht zurück -> wir behandeln das als "missing", NICHT als 0
        ing_score_map: Dict[str, float] = {}

        try:
            placeholders = ",".join(["%s"] * len(candidate_ids))

            sql = f"""
                SELECT
                    r.recipe_id,
                    1.0 - (r.ingredients_embedding <-> %s::vector) / 2.0 AS ingredients_similarity
                FROM {TABLE_RECIPES} r
                WHERE r.recipe_id IN ({placeholders})
                  AND r.ingredients_embedding IS NOT NULL
                ORDER BY r.ingredients_embedding <-> %s::vector ASC
            """

            params = [query_vector] + candidate_ids + [query_vector]

            with self.db.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, params)
                    rows = cur.fetchall()

                    for row in rows:
                        rid = row[0]
                        sim = float(row[1]) if row[1] is not None else 0.0
                        # clamp
                        sim = max(0.0, min(1.0, sim))
                        ing_score_map[rid] = sim

            print(f"✅ Zutaten-Scores berechnet für {len(ing_score_map)}/{len(candidate_ids)} Kandidaten", file=sys.stderr)

        except Exception as e:
            print(f"❌ ERROR beim Zutaten-Re-Ranking SQL: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)

            # fallback: nur Text
            final_results = text_results[:limit]
            for r in final_results:
                r["text_score"] = float(r.get("score", 0.0))
                r["ingredients_score"] = None
                r["combined_score"] = float(r.get("score", 0.0))
                r["score"] = r["combined_score"]
            return final_results

        # ---------------------------------------------------------------------
        # 3) Kombinieren (ohne 0-Strafe bei missing ingredients_embedding)
        # ---------------------------------------------------------------------
        combined: List[Dict[str, Any]] = []

        for idx, rid in enumerate(candidate_ids):
            base = base_by_id.get(rid)
            if not base:
                continue

            text_score = float(text_score_map.get(rid, 0.0))
            has_ing = rid in ing_score_map
            ingredients_score = float(ing_score_map.get(rid, 0.0)) if has_ing else None

            if has_ing:
                final_score = text_score * TEXT_WEIGHT + float(ingredients_score) * ING_WEIGHT
            else:

                final_score = text_score

            enriched = {
                **base,
                "text_score": text_score,
                "ingredients_score": ingredients_score,                # None wenn nicht vorhanden
                "ingredients_score_available": has_ing,
                "combined_score": final_score,
                "score": final_score,
            }
            #aktualisierter Wert eintragen
            combined.append(enriched)

            if idx < 3:
                print(
                    f"   #{idx+1} {enriched.get('name','')[:40]}... "
                    f"Text={text_score:.4f}, Zutaten={'—' if ingredients_score is None else f'{ingredients_score:.4f}'}, Final={final_score:.4f}",
                    file=sys.stderr
                )

        # ---------------------------------------------------------------------
        # 4) Sortieren & limitieren
        # ---------------------------------------------------------------------
        combined.sort(key=lambda x: float(x.get("score", 0.0)), reverse=True)
        final_results = combined[:limit]

        print(f"🎯 {len(final_results)} finale re-ranked Ergebnisse", file=sys.stderr)
        if final_results:
            best = final_results[0]
            print(f"🏆 Bester Score: {best['score']:.4f} ({best.get('name','')})", file=sys.stderr)

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
