import os
import re
import json
import uuid
import argparse
import logging
from typing import List, Dict, Any, Optional, Tuple

import requests
import psycopg2
from psycopg2 import sql
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
load_dotenv()

SUPABASE_DB_URL     = os.environ["SUPABASE_DB_URL"]
SPOONACULAR_API_KEY = os.environ["SPOONACULAR_API_KEY"]
TABLE_RECIPES       = os.environ.get("TABLE_NAME") or "test_recipes"
TABLE_ING           = "test_ingredients"
TABLE_LINK          = "test_recipe_ingredients"
TABLE_NUTRITION     = "test_recipe_nutrition"

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
EMB_DIM    = 384

TAG_RE = re.compile(r"<[^>]+>")
WS_RE  = re.compile(r"\s+")

def html_to_text(s: Optional[str]) -> str:
    if not s: return ""
    s = TAG_RE.sub(" ", s)
    s = WS_RE.sub(" ", s).strip()
    return s

logging.info(f"Lade Embedding-Modell: {MODEL_NAME}")
MODEL = SentenceTransformer(MODEL_NAME)

def embed(text: str) -> List[float]:
    vec = MODEL.encode(text or "").tolist()
    if len(vec) != EMB_DIM:
        raise RuntimeError(f"Embedding-Dimension unerwartet: {len(vec)} != {EMB_DIM}")
    return vec

def vec_literal(vec: List[float]) -> str:
    return "[" + ",".join(f"{x:.8f}" for x in vec) + "]"

def conn():
    return psycopg2.connect(SUPABASE_DB_URL)

def calculate_difficulty(sp: Dict[str, Any]) -> int:
    """Berechnet Schwierigkeitsgrad 1-5"""
    total_time = sp.get("readyInMinutes", 0)
    ingredient_count = len(sp.get("extendedIngredients", []))

    step_count = 0
    for instruction in sp.get("analyzedInstructions", []):
        step_count += len(instruction.get("steps", []))

    score = 0
    if total_time > 90: score += 2
    elif total_time > 45: score += 1

    if ingredient_count > 12: score += 2
    elif ingredient_count > 6: score += 1

    if step_count > 8: score += 1

    difficulty = min(max(round(score + 1), 1), 5)
    logging.info(f"Schwierigkeit: {difficulty}/5 (Zeit: {total_time}min, Zutaten: {ingredient_count}, Schritte: {step_count})")
    return difficulty

def extract_nutrition(sp: Dict[str, Any]) -> Dict[str, Any]:
    """Extrahiert Nährwerte aus der Spoonacular API-Antwort"""
    nutrition = sp.get("nutrition", {})
    nutrients = nutrition.get("nutrients", [])

    # Default Werte
    nutrition_data = {
        "calories": 0,
        "protein": 0,
        "carbohydrates": 0,
        "fat": 0,
        "fiber": 0,
        "sugar": 0,
        "sodium": 0,
        "saturated_fat": 0,
        "unsaturated_fat": 0,
        "cholesterol": 0,
        "potassium": 0,
        "vitamin_a": 0,
        "vitamin_c": 0,
        "vitamin_d": 0,
        "calcium": 0,
        "iron": 0
    }

    # Mapping von Nährstoffnamen zu unseren Feldern
    nutrient_mapping = {
        "Calories": "calories",
        "Protein": "protein",
        "Carbohydrates": "carbohydrates",
        "Fat": "fat",
        "Fiber": "fiber",
        "Sugar": "sugar",
        "Sodium": "sodium",
        "Saturated Fat": "saturated_fat",
        "Trans Fat": "trans_fat",
        "Cholesterol": "cholesterol",
        "Potassium": "potassium",
        "Vitamin A": "vitamin_a",
        "Vitamin C": "vitamin_c",
        "Vitamin D": "vitamin_d",
        "Calcium": "calcium",
        "Iron": "iron"
    }

    # Extrahiere Nährwerte
    for nutrient in nutrients:
        name = nutrient.get("name", "")
        amount = nutrient.get("amount", 0)

        if name in nutrient_mapping:
            field_name = nutrient_mapping[name]
            nutrition_data[field_name] = int(amount)

    logging.info(f"Extrahiert Nährwerte: {nutrition_data['calories']} kcal, {nutrition_data['protein']}g Protein")
    return nutrition_data

def extract_price_info(sp: Dict[str, Any]) -> Dict[str, Any]:
    """Extrahiert Preisinformationen aus der Spoonacular API-Antwort und konvertiert zu EUR"""
    price_per_serving = sp.get("pricePerServing", 0)

    # Spoonacular gibt Preis in US-Cent zurück, also umrechnen zu EUR
    if price_per_serving > 0:
        # Annahme: Spoonacular gibt Preis in US-Cent zurück
        price_per_serving_usd = price_per_serving / 100

        # USD zu EUR Umrechnung (aktueller Wechselkurs, kann angepasst werden)
        # Beispiel: 1 USD = 0.92 EUR (Stand 2024)
        usd_to_eur_rate = 0.92

        price_per_serving_eur = price_per_serving_usd * usd_to_eur_rate
    else:
        price_per_serving_eur = 0

    price_data = {
        "price_per_serving": round(price_per_serving_eur, 2)
    }

    logging.info(f"Extrahiert Preis: {price_data['price_per_serving']}€ pro Portion")
    return price_data

def fetch_recipes(query="", number=20) -> List[Dict[str, Any]]:
    """Holt Rezepte von Spoonacular API mit Nährwert- und Preis-Informationen"""
    url = (
        "https://api.spoonacular.com/recipes/complexSearch"
        f"?number={number}"
        f"&addRecipeInformation=true"
        f"&addRecipeInstructions=true"
        f"&instructionsRequired=true"
        f"&fillIngredients=true"
        f"&addRecipeNutrition=true"  # Nährwerte hinzufügen
        f"&dishType=soup"
    )

    if query and query.strip():
        url += f"&query={query.strip()}"

    url += f"&apiKey={SPOONACULAR_API_KEY}"

    logging.info(f"Spoonacular API: dishType=soup, query='{query}', number={number}")
    r = requests.get(url, timeout=60)
    r.raise_for_status()
    data = r.json() or {}

    recipes = data.get("results", [])
    logging.info(f"API Antwort: {len(recipes)} Rezepte mit dishType=soup")
    return recipes

def normalize(sp: Dict[str, Any]) -> Dict[str, Any]:
    title = sp.get("title") or ""
    description = html_to_text(sp.get("summary") or "")

    # Zubereitungsschritte extrahieren
    analyzed_instructions = sp.get("analyzedInstructions", [])
    instructions = []
    for instruction in analyzed_instructions:
        for step in instruction.get("steps", []):
            instructions.append(step.get("step", ""))
    instructions_text = " ".join(instructions)

    # Verwende extendedIngredients direkt von Spoonacular
    extended_ingredients = sp.get("extendedIngredients", [])
    logging.info(f"Extended Ingredients für {title}: {len(extended_ingredients)} Zutaten")

    # Extrahiere Nährwerte und Preisinformationen
    nutrition_data = extract_nutrition(sp)
    price_data = extract_price_info(sp)

    vegan = bool(sp.get("vegan", False))
    vegetarian = bool(sp.get("vegetarian", False))
    difficulty = calculate_difficulty(sp)
    total_time = sp.get("readyInMinutes") or 0
    servings = sp.get("servings", 1)
    diets = sp.get("diets") or []
    diet = diets[0] if diets else None
    image_url = sp.get("image")

    # Embeddings
    text_for_embedding = " ".join([title, description, instructions_text]).strip()
    ing_for_embedding = " ".join([ing.get("name", "") for ing in extended_ingredients]).strip()

    text_vec = embed(text_for_embedding)
    ing_vec = embed(ing_for_embedding)

    return {
        "name": title,
        "description": description,
        "instructions": instructions_text,
        "vegan": vegan,
        "vegetarian": vegetarian,
        "difficulty": difficulty,
        "diet": diet,
        "image_url": image_url,
        "total_time": total_time,
        "servings": servings,
        "ingredients_data": extended_ingredients,
        "nutrition_data": nutrition_data,
        "price_data": price_data,
        "text_embedding": text_vec,
        "ingredients_embedding": ing_vec
    }

def upsert_ingredient(cur, name: str) -> uuid.UUID:
    """Fügt Zutat ein oder gibt vorhandene ID zurück"""
    cur.execute(
        sql.SQL("SELECT ingredient_id FROM {} WHERE name = %s").format(sql.Identifier(TABLE_ING)),
        (name,)
    )
    row = cur.fetchone()
    if row:
        return row[0]

    iid = uuid.uuid4()
    ing_embedding = vec_literal(embed(name))

    cur.execute(
        sql.SQL("INSERT INTO {} (ingredient_id, name, name_embedding) VALUES (%s, %s, %s::vector) RETURNING ingredient_id")
        .format(sql.Identifier(TABLE_ING)),
        (str(iid), name, ing_embedding)
    )
    return cur.fetchone()[0]

def link_ingredient_to_recipe(cur, rid: uuid.UUID, ingredients: List[Dict[str, Any]]):
    """Verknüpft Rezept mit Zutaten"""
    for ing in ingredients:
        name = ing.get("name", "").strip()
        if not name:
            continue

        quantity_text = ing.get("original", "")
        amount = ing.get("amount")
        unit = ing.get("unit")

        iid = upsert_ingredient(cur, name)

        logging.info(f"Zutat: {name} → {amount} {unit} (Original: '{quantity_text}')")

        cur.execute(
            sql.SQL("""
                    INSERT INTO {} (recipe_id, ingredient_id, quantity_text, amount, unit)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (recipe_id, ingredient_id) DO UPDATE SET
                        quantity_text = EXCLUDED.quantity_text,
                                                                  amount = EXCLUDED.amount,
                                                                  unit = EXCLUDED.unit
                    """).format(sql.Identifier(TABLE_LINK)),
            (str(rid), str(iid), quantity_text, amount, unit)
        )

def insert_recipe_nutrition(cur, rid: uuid.UUID, nutrition_data: Dict[str, Any]):
    """Fügt Nährwerte für ein Rezept ein"""
    cur.execute(
        sql.SQL(f"""
            INSERT INTO {TABLE_NUTRITION} (
                recipe_id, calories, protein, carbohydrates, fat, fiber, sugar, sodium,
                saturated_fat, cholesterol, potassium, vitamin_a, vitamin_c, vitamin_d, calcium, iron
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s
            )
        """),
        (
            str(rid),
            nutrition_data.get("calories", 0),
            nutrition_data.get("protein", 0),
            nutrition_data.get("carbohydrates", 0),
            nutrition_data.get("fat", 0),
            nutrition_data.get("fiber", 0),
            nutrition_data.get("sugar", 0),
            nutrition_data.get("sodium", 0),
            nutrition_data.get("saturated_fat", 0),
            nutrition_data.get("cholesterol", 0),
            nutrition_data.get("potassium", 0),
            nutrition_data.get("vitamin_a", 0),
            nutrition_data.get("vitamin_c", 0),
            nutrition_data.get("vitamin_d", 0),
            nutrition_data.get("calcium", 0),
            nutrition_data.get("iron", 0)
        )
    )

def insert_recipe(cur, R: Dict[str, Any]) -> uuid.UUID:
    rid = uuid.uuid4()

    # Extrahiere grundlegende Nährwerte und Preisinformationen
    nutrition = R.get("nutrition_data", {})
    price = R.get("price_data", {})

    cur.execute(
        sql.SQL(f"""
            INSERT INTO {TABLE_RECIPES} (
                recipe_id, name, description, instructions,
                vegan, vegetarian, difficulty, diet, image_url,
                total_time, servings,
                price_per_serving,
                calories, protein, carbohydrates, fat, fiber, sugar, sodium,
                text_embedding, ingredients_embedding, created_at, updated_at
            ) VALUES (
                %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s,
                %s,
                %s, %s, %s, %s, %s, %s, %s,
                %s::vector, %s::vector, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
            RETURNING recipe_id
        """),
        (
            str(rid),
            R["name"], R["description"], R["instructions"],
            R["vegan"], R["vegetarian"], R["difficulty"], R["diet"], R["image_url"],
            R["total_time"], R["servings"],
            price.get("price_per_serving", 0),
            nutrition.get("calories", 0),
            nutrition.get("protein", 0),
            nutrition.get("carbohydrates", 0),
            nutrition.get("fat", 0),
            nutrition.get("fiber", 0),
            nutrition.get("sugar", 0),
            nutrition.get("sodium", 0),
            vec_literal(R["text_embedding"]), vec_literal(R["ingredients_embedding"])
        )
    )

    recipe_id = cur.fetchone()[0]

    # Füge detaillierte Nährwerte in separate Tabelle ein
    insert_recipe_nutrition(cur, recipe_id, nutrition)

    return recipe_id

def ingest(query: str, number: int):
    items = fetch_recipes(query=query, number=number)
    if not items:
        logging.warning("Keine Rezepte von Spoonacular erhalten.")
        return

    with conn() as c:
        with c.cursor() as cur:
            saved = 0
            for sp in items:
                try:
                    R = normalize(sp)
                    rid = insert_recipe(cur, R)

                    # Zutaten zu Rezepten verknüpfen
                    link_ingredient_to_recipe(cur, rid, R["ingredients_data"])

                    saved += 1
                    nutrition = R.get("nutrition_data", {})
                    price = R.get("price_data", {})
                    logging.info(f"({saved}/{len(items)}) gespeichert: {R['name']} - {nutrition.get('calories', 0)} kcal, {price.get('price_per_serving', 0)}€/Portion, Schwierigkeit: {R['difficulty']}/5")

                except Exception as e:
                    logging.error(f"Fehler beim Verarbeiten von Rezept '{sp.get('title', 'Unbekannt')}': {e}")
                    continue

        c.commit()
    logging.info(f"Ingest fertig ✅ - {saved} Rezepte gespeichert")

def search_by_text(q: str, k: int):
    qv = vec_literal(embed(q))
    with conn() as c:
        with c.cursor() as cur:
            cur.execute(
                sql.SQL(f"""
                    SELECT recipe_id, name, diet, vegan, vegetarian, total_time, difficulty,
                           calories, protein, carbohydrates, fat,
                           price_per_serving,
                           (text_embedding <-> %s::vector) distance
                    FROM {TABLE_RECIPES}
                    ORDER BY text_embedding <-> %s::vector
                    LIMIT %s
                """),
                (qv, qv, k)
            )
            for r in cur.fetchall():
                print({
                    "recipe_id": r[0],
                    "name": r[1],
                    "diet": r[2],
                    "vegan": r[3],
                    "vegetarian": r[4],
                    "total_time": r[5],
                    "difficulty": r[6],
                    "calories": r[7],
                    "protein": r[8],
                    "carbohydrates": r[9],
                    "fat": r[10],
                    "price_per_serving": f"{r[11]}€",
                    "distance": float(r[12])
                })

def search_by_ing(ings: List[str], k: int):
    qv = vec_literal(embed(" ".join(ings)))
    with conn() as c:
        with c.cursor() as cur:
            cur.execute(
                sql.SQL(f"""
                    SELECT recipe_id, name, diet, vegan, vegetarian, total_time, difficulty,
                           calories, protein, carbohydrates, fat,
                           price_per_serving,
                           (ingredients_embedding <-> %s::vector) distance
                    FROM {TABLE_RECIPES}
                    ORDER BY ingredients_embedding <-> %s::vector
                    LIMIT %s
                """),
                (qv, qv, k)
            )
            for r in cur.fetchall():
                print({
                    "recipe_id": r[0],
                    "name": r[1],
                    "diet": r[2],
                    "vegan": r[3],
                    "vegetarian": r[4],
                    "total_time": r[5],
                    "difficulty": r[6],
                    "calories": r[7],
                    "protein": r[8],
                    "carbohydrates": r[9],
                    "fat": r[10],
                    "price_per_serving": f"{r[11]}€",
                    "distance": float(r[12])
                })

def get_recipe_details(recipe_id: str):
    """Zeigt detaillierte Informationen einschließlich Nährwerte und Preis für ein Rezept"""
    with conn() as c:
        with c.cursor() as cur:
            # Grundlegende Rezeptinformationen
            cur.execute(
                sql.SQL(f"""
                    SELECT r.name, r.description, r.instructions, r.vegan, r.vegetarian, 
                           r.difficulty, r.diet, r.image_url, r.total_time, r.servings,
                           r.calories, r.protein, r.carbohydrates, r.fat, r.fiber, r.sugar, r.sodium,
                           r.price_per_serving
                    FROM {TABLE_RECIPES} r
                    WHERE r.recipe_id = %s
                """),
                (recipe_id,)
            )
            recipe = cur.fetchone()

            if not recipe:
                print("Rezept nicht gefunden")
                return

            # Detaillierte Nährwerte
            cur.execute(
                sql.SQL(f"""
                    SELECT calories, protein, carbohydrates, fat, saturated_fat, fiber, sugar,
                           sodium, cholesterol, potassium, vitamin_a, vitamin_c, calcium, iron
                    FROM {TABLE_NUTRITION}
                    WHERE recipe_id = %s
                """),
                (recipe_id,)
            )
            nutrition = cur.fetchone()

            # Zutaten
            cur.execute(
                sql.SQL(f"""
                    SELECT i.name, ri.quantity_text, ri.amount, ri.unit
                    FROM {TABLE_LINK} ri
                    JOIN {TABLE_ING} i ON ri.ingredient_id = i.ingredient_id
                    WHERE ri.recipe_id = %s
                """),
                (recipe_id,)
            )
            ingredients = cur.fetchall()

            # Ausgabe
            print("=== REZEPT DETAILS ===")
            print(f"Name: {recipe[0]}")
            print(f"Beschreibung: {recipe[1][:200]}...")
            print(f"Vegetarisch: {recipe[4]}, Vegan: {recipe[3]}")
            print(f"Schwierigkeit: {recipe[5]}/5, Diät: {recipe[6]}")
            print(f"Zeit: {recipe[8]}min, Portionen: {recipe[9]}")

            print(f"\n=== PREIS ===")
            print(f"Preis pro Portion: {recipe[17]}€")

            print("\n=== NÄHRWERTE (pro Portion) ===")
            print(f"Kalorien: {recipe[10]} kcal")
            print(f"Protein: {recipe[11]}g")
            print(f"Kohlenhydrate: {recipe[12]}g")
            print(f"Fett: {recipe[13]}g")
            print(f"Ballaststoffe: {recipe[14]}g")
            print(f"Zucker: {recipe[15]}g")
            print(f"Natrium: {recipe[16]}mg")

            if nutrition:
                print(f"Gesättigte Fettsäuren: {nutrition[4]}g")
                print(f"Cholesterin: {nutrition[8]}mg")
                print(f"Kalium: {nutrition[9]}mg")
                print(f"Vitamin A: {nutrition[10]}IU")
                print(f"Vitamin C: {nutrition[11]}mg")
                print(f"Kalzium: {nutrition[12]}mg")
                print(f"Eisen: {nutrition[13]}mg")

            print("\n=== ZUTATEN ===")
            for ing in ingredients:
                print(f"- {ing[0]}: {ing[1]}")

def main():
    parser = argparse.ArgumentParser(description="SoupMate – Ingest & semantische Suche mit Nährwerten und Preisen in EUR")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_ing = sub.add_parser("ingest")
    p_ing.add_argument("--query", default="", help="Optional: Spezifische Suchanfrage")
    p_ing.add_argument("--number", type=int, default=20)

    p_s1 = sub.add_parser("search-text")
    p_s1.add_argument("--q", required=True)
    p_s1.add_argument("--k", type=int, default=10)

    p_s2 = sub.add_parser("search-ingredients")
    p_s2.add_argument("--ing", nargs="+", required=True)
    p_s2.add_argument("--k", type=int, default=10)

    p_details = sub.add_parser("details")
    p_details.add_argument("--recipe-id", required=True, help="Recipe ID für Details")

    args = parser.parse_args()
    if args.cmd == "ingest":
        ingest(args.query, args.number)
    elif args.cmd == "search-text":
        search_by_text(args.q, args.k)
    elif args.cmd == "search-ingredients":
        search_by_ing(args.ing, args.k)
    elif args.cmd == "details":
        get_recipe_details(args.recipe_id)

if __name__ == "__main__":
    main()