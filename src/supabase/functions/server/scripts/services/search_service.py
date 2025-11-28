# Such-Engine

import logging
import re
from typing import List, Dict, Any, Tuple, Set
from models.embedding import embedding_model
from services.database import DatabaseService
from config import TABLE_RECIPES, TABLE_ING, TABLE_LINK, TABLE_NUTRITION



class EmbeddingService:
    def __init__(self):
        self.db = DatabaseService()

    # -------------------------------
    # 1) INTENT ERKENNEN (generisch)
    # -------------------------------
    def _parse_intent(self, q: str) -> Dict[str, Any]:
        ql = q.lower()

        # einfache Negations-Erkennung (no X / ohne X)
        neg_patterns = [
            r"\bno\s+([a-z][a-z\s\-]+)",       # "no nuts", "no pork"
            r"\bohne\s+([a-z][a-z\s\-]+)",     # "ohne gluten"
        ]
        excludes: Set[str] = set()
        for pat in neg_patterns:
            for m in re.finditer(pat, ql):
                excludes.add(m.group(1).strip())

        # Zutaten-/Protein-Synonyme (erweiterbar, nicht nur Fleisch!)
        protein_map = {
            "meat": ["meat", "beef", "steak", "ground beef", "minced beef", "pork", "ham", "bacon",
                     "sausage", "chicken", "turkey", "lamb", "veal", "mutton", "duck"],
            "fish": ["fish", "tuna", "salmon", "cod", "trout", "shrimp", "prawn", "seafood"],
            "dairy": ["cheese", "milk", "yogurt", "butter", "cream", "feta", "parmesan"],
            "eggs": ["egg", "eggs"],
            "gluten": ["wheat", "barley", "rye", "gluten", "bulgur", "couscous"],
            "nuts": ["nut", "nuts", "almond", "hazelnut", "walnut", "peanut", "cashew", "pistachio"],
        }

        # Diet-Keywords → Flags
        wants = {
            "vegan": any(w in ql for w in [" vegan", "vegan "]),
            "vegetarian": any(w in ql for w in [" vegetarian", "vegetarian "]),
            "meat": any(w in ql for w in [" meat", "beef", "chicken", "pork", "turkey", "lamb", "bacon", "sausage"]),
            "fish": any(w in ql for w in [" fish", "salmon", "tuna", "cod", "shrimp", "seafood"]),
            "gluten_free": "gluten free" in ql or "gluten-free" in ql or "glutenfrei" in ql,
            "lactose_free": "lactose free" in ql or "laktosefrei" in ql,
        }

        # Include-/Exclude-Listen aus Query ableiten (generisch)
        includes: Set[str] = set()
        for _, words in protein_map.items():
            for w in words:
                if w in ql:
                    includes.add(w)

        # explizite Stopps (no/ohne)
        for e in list(excludes):
            # wenn ein exclude selbst in includes steckt → aus includes entfernen
            if e in includes:
                includes.discard(e)

        return {
            "includes": sorted(includes),
            "excludes": sorted(excludes),
            "wants": wants
        }

    # ---------------------------------------
    # 2) BAUE SQL-Filter dynamisch & sicher
    # ---------------------------------------
    def _build_filter_sql(self, intent: Dict[str, Any]) -> Tuple[str, list]:
        where_parts = []
        params = []

        w = intent["wants"]

        # harte Diet-Filter (nur wenn im Query erwähnt)
        if w["vegan"]:
            where_parts.append("r.vegan = TRUE")
        elif w["vegetarian"]:
            where_parts.append("r.vegetarian = TRUE")
        elif w["meat"]:
            # „nicht-vegetarisch“ ist oft näher an „mit Fleisch/Fisch“
            where_parts.append("r.vegetarian = FALSE")

        # gluten-/laktosefrei – falls du solche Flags hast, hier ebenfalls filtern.
        # Beispiel (auskommentiert, wenn Felder fehlen):
        # if w["gluten_free"]:
        #     where_parts.append("COALESCE(r.gluten_free, FALSE) = TRUE")
        # if w["lactose_free"]:
        #     where_parts.append("COALESCE(r.lactose_free, FALSE) = TRUE")

        # Include-Zutaten (EXISTS)
        inc = intent["includes"]
        exc = intent["excludes"]
        if inc:
            where_parts.append(f"""
                EXISTS (
                    SELECT 1
                    FROM {TABLE_LINK} ri
                    JOIN {TABLE_ING} i ON i.ingredient_id = ri.ingredient_id
                    WHERE ri.recipe_id = r.recipe_id
                      AND i.name ILIKE ANY (ARRAY[%s])
                )
            """)
            params.append(tuple(f"%{w}%" for w in inc))

        # EXCLUDES
        if exc:
            where_parts.append(f"""
                NOT EXISTS (
                    SELECT 1
                    FROM {TABLE_LINK} ri
                    JOIN {TABLE_ING} i ON i.ingredient_id = ri.ingredient_id
                    WHERE ri.recipe_id = r.recipe_id
                      AND i.name ILIKE ANY (ARRAY[%s])
                )
            """)
            params.append(tuple(f"%{w}%" for w in exc))

        where_sql = ""
        if where_parts:
            where_sql = "WHERE " + " AND ".join(f"({p.strip()})" for p in where_parts)

        return where_sql, params

    # ---------------------------------------------------------
    # 3) SUCHE: kombiniertes Ranking + optionale Filter nutzen
    # ---------------------------------------------------------
    def search_by_text(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        query_vector = embedding_model.vector_to_literal(embedding_model.embed(query))
        intent = self._parse_intent(query)
        where_sql, where_params = self._build_filter_sql(intent)

        # Ranking: Text + Zutaten (L2-Distanzen) → in "Pseudo-Similarity" umrechnen
        # + kleiner Boost, wenn Zutaten-Keywords matchen; Penalty bei Intent-Konflikt
        sql = f"""
            WITH q AS (SELECT %s::vector AS qv)
            SELECT
                r.recipe_id, r.name, r.description, r.instructions,
                r.diet, r.vegan, r.vegetarian, r.total_time, r.difficulty,
                r.calories, r.protein, r.carbohydrates, r.fat, r.price_per_serving,
                (r.text_embedding <-> q.qv)          AS d_text,
                (r.ingredients_embedding <-> q.qv)   AS d_ing,
                (
                  0.6*(1.0/(1.0 + (r.text_embedding <-> q.qv))) +
                  0.4*(1.0/(1.0 + COALESCE((r.ingredients_embedding <-> q.qv), 1.0)))
                )
                + COALESCE(inc.boost_inc, 0)
                + CASE
                    WHEN %s AND r.vegetarian THEN -0.2
                    WHEN %s AND NOT r.vegan THEN -0.2
                    WHEN %s AND NOT r.vegetarian THEN -0.15
                    ELSE 0
                  END
                AS score
            FROM {TABLE_RECIPES} r
            CROSS JOIN q
            LEFT JOIN (
                SELECT ri.recipe_id, 0.15 AS boost_inc
                FROM {TABLE_LINK} ri
                JOIN {TABLE_ING} i ON i.ingredient_id = ri.ingredient_id
                WHERE %s = TRUE
                  AND i.name ILIKE ANY (ARRAY[%s])
                GROUP BY ri.recipe_id
            ) inc ON inc.recipe_id = r.recipe_id
            {where_sql}
            ORDER BY score DESC
            LIMIT %s
        """

        # die WHERE-Parameter (Arrays) einfügen – Reihenfolge wahren
        # (psycopg kümmert sich um ARRAY-Mapping bei ILIKE ANY)
        # params-Struktur: [qvec, wants_meat, wants_vegan, wants_veg, has_inc, include_terms[], limit]
        # + where_params (kann include/exclude Arrays enthalten)
        params_header = [
            query_vector,                              # %s -> q.qv
            intent["wants"]["meat"],                   # %s
            intent["wants"]["vegan"],                  # %s
            intent["wants"]["vegetarian"],             # %s
            bool(intent["includes"]),                  # %s
            tuple(f"%{w}%" for w in intent["includes"]) if intent["includes"] else tuple(["%__noop__%"]),  # ARRAY[%s]
        ]

        final_params = list(params_header)

        # WHERE-Parameter (kommen aus _build_filter_sql, können Tuples für ARRAY[%s] enthalten)
        for p in where_params:
            final_params.append(p)

        expanded_limit = max(20, int(limit) * 5)
        final_params.append(expanded_limit)  # %s für LIMIT im SQL


        with self.db.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, final_params)

                rows = cur.fetchall()

                seen_titles = set()  # exakt, ohne Normalisierung
                results = []

                for row in rows:
                    recipe_id = row[0]
                    name = row[1] or ""

                    if name in seen_titles:
                        continue  # Duplikat per exakt gleichem Namen überspringen

                    ingredients = self._get_recipe_ingredients(cur, recipe_id)

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
                        "price_per_serving": f"{row[13]}€",
                        "distance_text": float(row[14]),
                        "distance_ingredients": float(row[15]) if row[15] is not None else None,
                        "score": float(row[16]),
                        "distance": float(row[14]),  # Back-compat fürs CLI
                        "ingredients": ingredients
                    })

                    seen_titles.add(name)

                    if len(results) >= limit:
                        break

                return results

    def search_by_ingredients(self, ingredients: List[str], limit: int = 10) -> List[Dict[str, Any]]:
        """
        Sucht nach Rezepten über das Zutaten-Embedding (L2 <->).
        - Erste Zutat wird stärker gewichtet (PRIMARY_WEIGHT).
        - Duplikate (exakt gleicher Name) werden entfernt.
        - Es werden mehr Kandidaten geholt und danach auf `limit` gekürzt.
        - Liefert ein Feld "ingredients" zurück (für CLI-Formatter).
        """
        if not ingredients:
            return []

        # -------- Gewichtung der Zutaten (erste Zutat wichtiger) --------
        PRIMARY_WEIGHT = 2.0   # ggf. 3.0, wenn noch stärker
        DECAY = 1.0            # 1.0 = keine Abwertung; z.B. 0.9 für leichten Abfall

        # Einzelembeddings je Zutat + Gewichte bauen
        single_vecs: List[List[float]] = []
        weights: List[float] = []
        for idx, ing in enumerate(ingredients):
            v = embedding_model.embed(ing)  # -> List[float]
            single_vecs.append(v)
            w = (PRIMARY_WEIGHT if idx == 0 else (DECAY ** idx))
            weights.append(w)

        # Gewichtetes Mittel (komponentenweise)
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

        # Mehr Kandidaten holen (damit nach Dedup noch genug übrig bleiben)
        expanded_limit = max(20, int(limit) * 5)

        with self.db.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    SELECT 
                        r.recipe_id, r.name, r.description, r.instructions,
                        r.diet, r.vegan, r.vegetarian, r.total_time, r.difficulty,
                        r.calories, r.protein, r.carbohydrates, r.fat,
                        r.price_per_serving,
                        (r.ingredients_embedding <-> %s::vector) AS d_ing
                    FROM {TABLE_RECIPES} r
                    ORDER BY r.ingredients_embedding <-> %s::vector
                    LIMIT %s
                    """,
                    (query_vector, query_vector, expanded_limit)
                )

                rows = cur.fetchall()

                # Duplikate anhand EXAKT gleichem Namen entfernen
                seen_titles = set()
                results: List[Dict[str, Any]] = []

                for row in rows:
                    recipe_id = row[0]
                    name = row[1] or ""

                    if name in seen_titles:
                        continue

                    # Zutatenliste für dieses Rezept holen (CLI erwartet "ingredients")
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
                        "price_per_serving": f"{row[13]}€",
                        "distance": float(row[14]),              # Back-compat fürs bestehende CLI
                        "distance_ingredients": float(row[14]),
                        "ingredients": ingredients_list           # <- WICHTIG: für Formatter
                    })

                    seen_titles.add(name)

                    if len(results) >= limit:
                        break

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