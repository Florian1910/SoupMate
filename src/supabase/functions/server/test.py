import os
import re
import json
import logging
from typing import List, Dict, Any

import requests
from dotenv import load_dotenv

# DB
import psycopg2
from psycopg2 import sql, OperationalError

# Embeddings
from sentence_transformers import SentenceTransformer

# -----------------------------------------------------------------------------
# Logging
# -----------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")

# -----------------------------------------------------------------------------
# ENV
# -----------------------------------------------------------------------------
load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.environ.get("SUPABASE_SECRET_KEY")
SPOONACULAR_API_KEY = os.environ.get("SPOONACULAR_API_KEY")

SAVE_MODE = (os.environ.get("SAVE_MODE") or "db").strip().lower()  # "db" oder "rest"
TABLE_NAME = os.environ.get("TABLE_NAME") or "test_recipes"

# DB-Verbindungsoptionen (beliebige Variante nutzbar)
SUPABASE_DB_URL = os.environ.get("SUPABASE_DB_URL")  # kompletter Connection-String
SUPABASE_DB_HOST = os.environ.get("SUPABASE_DB_HOST")  # z.B. aws-0-xxx.pooler.supabase.com
SUPABASE_DB_PORT = int(os.environ.get("SUPABASE_DB_PORT") or 5432)
SUPABASE_DB_USER = os.environ.get("SUPABASE_DB_USER") or "postgres"
SUPABASE_DB_PASSWORD = os.environ.get("SUPABASE_DB_PASSWORD")
SUPABASE_DB_NAME = os.environ.get("SUPABASE_DB_NAME") or "postgres"

if not SUPABASE_URL:
    raise RuntimeError("SUPABASE_URL fehlt in .env")
if not SUPABASE_SECRET_KEY:
    raise RuntimeError("SUPABASE_SECRET_KEY fehlt in .env")
if not SPOONACULAR_API_KEY:
    raise RuntimeError("SPOONACULAR_API_KEY fehlt in .env")

PROJECT_REF = SUPABASE_URL.replace("https://", "").replace(".supabase.co", "")

logging.info(f"Using Supabase Project: {PROJECT_REF}")
logging.info(f"Save mode: {SAVE_MODE}  |  Table: {TABLE_NAME}")

# -----------------------------------------------------------------------------
# Supabase REST
# -----------------------------------------------------------------------------
SB_HEADERS = {
    "apikey": SUPABASE_SECRET_KEY,
    "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
    "Content-Type": "application/json",
}

def sb_insert(table: str, rows: List[dict], timeout=30):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    r = requests.post(url, headers=SB_HEADERS, json=rows, timeout=timeout)
    r.raise_for_status()
    return r.json() if r.text else None

# -----------------------------------------------------------------------------
# HTML/Text Helpers
# -----------------------------------------------------------------------------
TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")

def html_to_text(s: str) -> str:
    if not s:
        return ""
    s = TAG_RE.sub(" ", s)
    s = WS_RE.sub(" ", s).strip()
    return s

# -----------------------------------------------------------------------------
# Embeddings (einmalig laden)
# -----------------------------------------------------------------------------
logging.info("Loading embedding model (sentence-transformers/all-MiniLM-L6-v2)...")
MODEL = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

def make_embedding(text: str) -> List[float]:
    return MODEL.encode(text or "").tolist()

# -----------------------------------------------------------------------------
# DB-Verbindung
# -----------------------------------------------------------------------------
def get_db_conn():
    """
    Baut eine DB-Verbindung auf:
      1) Wenn SUPABASE_DB_URL gesetzt ist, diese verwenden.
      2) Sonst SUPABASE_DB_HOST, sonst db.<project-ref>.supabase.co
    Immer mit sslmode=require.
    """
    if SUPABASE_DB_URL:
        logging.info("Connecting via SUPABASE_DB_URL (Connection String)")
        return psycopg2.connect(SUPABASE_DB_URL)

    host = SUPABASE_DB_HOST or f"db.{PROJECT_REF}.supabase.co"
    logging.info(f"Connecting to database at {host}:{SUPABASE_DB_PORT} (sslmode=require)")

    if not SUPABASE_DB_PASSWORD:
        raise RuntimeError("SUPABASE_DB_PASSWORD fehlt in .env (oder Connection-String SUPABASE_DB_URL verwenden).")

    return psycopg2.connect(
        host=host,
        port=SUPABASE_DB_PORT,
        database=SUPABASE_DB_NAME,
        user=SUPABASE_DB_USER,
        password=SUPABASE_DB_PASSWORD,
        sslmode="require",
    )

# -----------------------------------------------------------------------------
# Spoonacular
# -----------------------------------------------------------------------------
def fetch_recipes(query="soup", number=10) -> List[Dict[str, Any]]:
    url = (
        "https://api.spoonacular.com/recipes/complexSearch"
        f"?query={query}&number={number}&addRecipeInformation=true&instructionsRequired=true"
        f"&apiKey={SPOONACULAR_API_KEY}"
    )
    logging.info(f"Fetching recipes from Spoonacular: query='{query}', number={number}")
    r = requests.get(url, timeout=45)
    r.raise_for_status()
    data = r.json() or {}
    return data.get("results", [])

# -----------------------------------------------------------------------------
# Normalisierung + Save
# -----------------------------------------------------------------------------
def normalize_recipe_for_insert(recipe: Dict[str, Any]) -> Dict[str, Any]:
    title = recipe.get("title", "") or ""
    description = html_to_text(recipe.get("summary", "") or "")
    instructions = html_to_text(recipe.get("instructions", "") or "")

    ingredients_list = []
    for it in recipe.get("extendedIngredients", []) or []:
        name = (it.get("name") or "").strip()
        if name:
            ingredients_list.append(name)

    ingredients_joined = " ".join(ingredients_list)
    text_for_embedding = " ".join([title, description, instructions]).strip()

    text_embedding = make_embedding(text_for_embedding)
    ingredients_embedding = make_embedding(ingredients_joined)

    return {
        "name": title,
        "description": description,
        "instructions": instructions,
        # Embeddings als JSON-Array (jsonb in DB)
        "text_embedding": text_embedding,
        "ingredients_embedding": ingredients_embedding,
    }

def save_recipe_db(conn, table: str, row: Dict[str, Any]):
    with conn.cursor() as cur:
        query = sql.SQL("""
                        INSERT INTO {table} (name, description, instructions, text_embedding, ingredients_embedding)
                        VALUES (%s, %s, %s, %s, %s)
                        """).format(table=sql.Identifier(table))
        cur.execute(
            query,
            (
                row["name"],
                row["description"],
                row["instructions"],
                json.dumps(row["text_embedding"]),
                json.dumps(row["ingredients_embedding"]),
            )
        )
    conn.commit()

def save_recipe_rest(table: str, row: Dict[str, Any]):
    payload = [{
        "name": row["name"],
        "description": row["description"],
        "instructions": row["instructions"],
        "text_embedding": row["text_embedding"],
        "ingredients_embedding": row["ingredients_embedding"],
    }]
    return sb_insert(table, payload)

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
def main():
    try:
        recipes = fetch_recipes(query="soup", number=10)
        if not recipes:
            logging.warning("Keine Rezepte erhalten.")
            return

        use_rest = False

        if SAVE_MODE == "db":
            try:
                conn = get_db_conn()
            except OperationalError as e:
                # Typische DNS/Netz-Themen -> automatisch auf REST wechseln
                logging.error(f"DB-Verbindung fehlgeschlagen ({e}). Wechsle auf REST-Speicherung.")
                use_rest = True
                conn = None
            except Exception as e:
                logging.error(f"DB-Setup-Fehler: {e}. Wechsle auf REST-Speicherung.")
                use_rest = True
                conn = None
        else:
            use_rest = True
            conn = None

        if not use_rest and conn:
            try:
                for i, r in enumerate(recipes, start=1):
                    row = normalize_recipe_for_insert(r)
                    save_recipe_db(conn, TABLE_NAME, row)
                    logging.info(f"[DB] ({i}/{len(recipes)}) gespeichert: {row['name']}")
            finally:
                conn.close()
        else:
            for i, r in enumerate(recipes, start=1):
                row = normalize_recipe_for_insert(r)
                save_recipe_rest(TABLE_NAME, row)
                logging.info(f"[REST] ({i}/{len(recipes)}) gespeichert: {row['name']}")

        logging.info("Fertig ✅")

    except requests.HTTPError as e:
        logging.exception(f"HTTP Error: {getattr(e, 'response', None).text if getattr(e, 'response', None) else e}")
    except Exception as e:
        logging.exception(f"Unbehandelter Fehler: {e}")

if __name__ == "__main__":
    main()
