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

def fetch_recipes(query="", number=20) -> List[Dict[str, Any]]:
    """Holt Rezepte von Spoonacular API mit dishType Filter für Suppen"""
    url = (
        "https://api.spoonacular.com/recipes/complexSearch"
        f"?number={number}"
        f"&addRecipeInformation=true"
        f"&addRecipeInstructions=true"
        f"&instructionsRequired=true"
        f"&fillIngredients=true"  # Wichtig für extendedIngredients
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

    # Zeige die strukturierten Daten der ersten Zutat als Beispiel
    if extended_ingredients:
        first_ing = extended_ingredients[0]
        logging.info(f"Beispiel Zutat: {first_ing.get('name')} - Amount: {first_ing.get('amount')} {first_ing.get('unit')}")

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
        "ingredients_data": extended_ingredients,  # Verwende die originalen extendedIngredients
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
    """Verknüpft Rezept mit Zutaten unter Verwendung von Spoonacular's strukturierten Daten"""
    for ing in ingredients:
        name = ing.get("name", "").strip()
        if not name:
            continue

        # Verwende Spoonacular's strukturierte Daten direkt
        amount = ing.get("amount")
        unit = ing.get("unit")
        original_text = ing.get("original", "")

        iid = upsert_ingredient(cur, name)

        logging.info(f"Zutat: {name} → {amount} {unit} (Original: '{original_text}')")

        # Verknüpfe mit strukturierten Daten
        cur.execute(
            sql.SQL("""
                    INSERT INTO {} (recipe_id, ingredient_id, quantity_text, amount, unit)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (recipe_id, ingredient_id) DO UPDATE SET
                        quantity_text = EXCLUDED.quantity_text,
                                                                  amount = EXCLUDED.amount,
                                                                  unit = EXCLUDED.unit
                    """).format(sql.Identifier(TABLE_LINK)),
            (str(rid), str(iid), original_text, amount, unit)
        )

def insert_recipe(cur, R: Dict[str, Any]) -> uuid.UUID:
    rid = uuid.uuid4()

    cur.execute(
        sql.SQL(f"""
            INSERT INTO {TABLE_RECIPES} (
                recipe_id, name, description, instructions,
                vegan, vegetarian, difficulty, diet, image_url,
                total_time, servings,
                text_embedding, ingredients_embedding, created_at, updated_at
            ) VALUES (
                %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s,
                %s::vector, %s::vector, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
            RETURNING recipe_id
        """),
        (
            str(rid),
            R["name"], R["description"], R["instructions"],
            R["vegan"], R["vegetarian"], R["difficulty"], R["diet"], R["image_url"],
            R["total_time"], R["servings"],
            vec_literal(R["text_embedding"]), vec_literal(R["ingredients_embedding"])
        )
    )
    return cur.fetchone()[0]

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

                    # Zutaten zu Rezepten verknüpfen - verwende die originalen extendedIngredients
                    link_ingredient_to_recipe(cur, rid, R["ingredients_data"])

                    saved += 1
                    logging.info(f"({saved}/{len(items)}) gespeichert: {R['name']} (Schwierigkeit: {R['difficulty']}/5)")

                except Exception as e:
                    logging.error(f"Fehler beim Verarbeiten von Rezept '{sp.get('title', 'Unbekannt')}': {e}")
                    continue

        c.commit()
    logging.info(f"Ingest fertig ✅ - {saved} Rezepte gespeichert")

# ... (search_by_text und search_by_ing Funktionen bleiben gleich)

def main():
    parser = argparse.ArgumentParser(description="SoupMate – Ingest & semantische Suche")
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

    args = parser.parse_args()
    if args.cmd == "ingest":
        ingest(args.query, args.number)
    elif args.cmd == "search-text":
        search_by_text(args.q, args.k)
    elif args.cmd == "search-ingredients":
        search_by_ing(args.ing, args.k)

if __name__ == "__main__":
    main()