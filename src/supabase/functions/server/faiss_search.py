# faiss_search.py
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

SUPABASE_DB_URL     = os.environ["SUPABASE_DB_URL"]  # Pooler 6543
SPOONACULAR_API_KEY = os.environ["SPOONACULAR_API_KEY"]
TABLE_RECIPES       = os.environ.get("TABLE_NAME") or "test_recipes"
TABLE_ING           = "test_ingredients"
TABLE_LINK          = "test_recipe_ingredients"

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"  # 384d
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

def fetch_recipes(query="soup", number=20) -> List[Dict[str, Any]]:
    # explizit nur Suppen holen
    url = (
        "https://api.spoonacular.com/recipes/complexSearch"
        f"?query={query}&type=soup"
        f"&number={number}"
        f"&addRecipeInformation=true"
        f"&instructionsRequired=true"
        f"&apiKey={SPOONACULAR_API_KEY}"
    )
    logging.info(f"Spoonacular: query='{query}', type=soup, number={number}")
    r = requests.get(url, timeout=60)
    r.raise_for_status()
    data = r.json() or {}
    return data.get("results", [])

def normalize(sp: Dict[str, Any]) -> Dict[str, Any]:
    title        = sp.get("title") or ""
    description  = html_to_text(sp.get("summary") or "")
    instructions = html_to_text(sp.get("instructions") or "")
    vegan        = bool(sp.get("vegan", False))
    vegetarian   = bool(sp.get("vegetarian", False))
    prep_time    = sp.get("preparationMinutes")
    cook_time    = sp.get("cookingMinutes")
    total_time   = sp.get("readyInMinutes")
    servings     = sp.get("servings")
    diets        = sp.get("diets") or []
    diet         = diets[0] if diets else None
    image_url    = sp.get("image")

    names = []
    for it in (sp.get("extendedIngredients") or []):
        n = (it.get("name") or "").strip()
        if n: names.append(n)

    text_vec = embed(" ".join([title, description, instructions]).strip())
    ing_vec  = embed(" ".join(names).strip())

    return {
        "name": title, "description": description, "instructions": instructions,
        "vegan": vegan, "vegetarian": vegetarian, "difficulty": None, "diet": diet,
        "image_url": image_url, "prep_time": prep_time, "cook_time": cook_time,
        "total_time": total_time, "servings": servings,
        "ingredients_names": names,
        "text_embedding": text_vec, "ingredients_embedding": ing_vec,
        "extendedIngredients": sp.get("extendedIngredients") or []
    }

def upsert_ingredient(cur, name: str) -> uuid.UUID:
    cur.execute(sql.SQL("select ingredient_id from {} where name = %s").format(sql.Identifier(TABLE_ING)), (name,))
    row = cur.fetchone()
    if row: return row[0]
    iid = uuid.uuid4()
    cur.execute(
        sql.SQL("insert into {} (ingredient_id, name, name_embedding) values (%s, %s, %s::vector) returning ingredient_id")
        .format(sql.Identifier(TABLE_ING)),
        (str(iid), name, vec_literal(embed(name)))
    )
    return cur.fetchone()[0]

def insert_recipe(cur, R: Dict[str, Any]) -> uuid.UUID:
    rid = uuid.uuid4()
    cur.execute(
        sql.SQL(f"""
            insert into {TABLE_RECIPES} (
                recipe_id, name, description, instructions,
                vegan, vegetarian, difficulty, diet, image_url,
                prep_time, cook_time, total_time, servings,
                text_embedding, ingredients_embedding
            ) values (
                %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s::vector, %s::vector
            )
            returning recipe_id
        """),
        (
            str(rid),
            R["name"], R["description"], R["instructions"],
            R["vegan"], R["vegetarian"], R["difficulty"], R["diet"], R["image_url"],
            R["prep_time"], R["cook_time"], R["total_time"], R["servings"],
            vec_literal(R["text_embedding"]), vec_literal(R["ingredients_embedding"])
        )
    )
    return cur.fetchone()[0]

def link(cur, rid: uuid.UUID, iid: uuid.UUID, qty: Optional[str]):
    cur.execute(
        sql.SQL("insert into {} (recipe_id, ingredient_id, quantity) values (%s, %s, %s) on conflict (recipe_id, ingredient_id) do update set quantity = excluded.quantity")
        .format(sql.Identifier(TABLE_LINK)),
        (str(rid), str(iid), qty)
    )

def ingest(query: str, number: int):
    items = fetch_recipes(query=query, number=number)
    if not items:
        logging.warning("Keine Rezepte von Spoonacular erhalten.")
        return

    with conn() as c:
        with c.cursor() as cur:
            saved = 0
            for sp in items:
                R = normalize(sp)
                rid = insert_recipe(cur, R)
                for it in (R["extendedIngredients"] or []):
                    name = (it.get("name") or "").strip()
                    if not name: continue
                    qty = it.get("original") or it.get("originalName")
                    iid = upsert_ingredient(cur, name)
                    link(cur, rid, iid, qty)
                saved += 1
                logging.info(f"({saved}/{len(items)}) gespeichert: {R['name']}")
        c.commit()
    logging.info("Ingest fertig ✅")

def search_by_text(q: str, k: int):
    qv = vec_literal(embed(q))
    with conn() as c:
        with c.cursor() as cur:
            cur.execute(
                sql.SQL(f"""
                    select recipe_id, name, diet, vegan, vegetarian, total_time,
                           (text_embedding <-> %s::vector) distance
                    from {TABLE_RECIPES}
                    order by text_embedding <-> %s::vector
                    limit %s
                """),
                (qv, qv, k)
            )
            for r in cur.fetchall():
                print({"recipe_id": r[0], "name": r[1], "diet": r[2], "vegan": r[3], "vegetarian": r[4], "total_time": r[5], "distance": float(r[6])})

def search_by_ing(ings: List[str], k: int):
    qv = vec_literal(embed(" ".join(ings)))
    with conn() as c:
        with c.cursor() as cur:
            cur.execute(
                sql.SQL(f"""
                    select recipe_id, name, diet, vegan, vegetarian, total_time,
                           (ingredients_embedding <-> %s::vector) distance
                    from {TABLE_RECIPES}
                    order by ingredients_embedding <-> %s::vector
                    limit %s
                """),
                (qv, qv, k)
            )
            for r in cur.fetchall():
                print({"recipe_id": r[0], "name": r[1], "diet": r[2], "vegan": r[3], "vegetarian": r[4], "total_time": r[5], "distance": float(r[6])})

def main():
    parser = argparse.ArgumentParser(description="SoupMate – Ingest & semantische Suche (pgvector 384d)")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_ing = sub.add_parser("ingest")
    p_ing.add_argument("--query", default="soup")
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
