import os
import re
import time
import hashlib
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import requests
from dotenv import load_dotenv
import psycopg2
from sentence_transformers import SentenceTransformer
import json

# =========================
#   ENV laden & prüfen
# =========================
load_dotenv()  # .env im aktuellen Ordner
SUPABASE_URL        = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
SUPABASE_SECRET_KEY = os.environ.get("SUPABASE_SECRET_KEY")
SPOONACULAR_API_KEY = os.environ.get("SPOONACULAR_API_KEY")

if not SUPABASE_URL:
    raise RuntimeError("SUPABASE_URL fehlt in .env")
if not SUPABASE_SECRET_KEY:
    raise RuntimeError("SUPABASE_SECRET_KEY fehlt in .env (Secret/Service Role Key)")
if not SPOONACULAR_API_KEY:
    raise RuntimeError("SPOONACULAR_API_KEY fehlt in .env")

print("Using Supabase:", SUPABASE_URL)

# =========================
#   HTTP-Clients
# =========================
# Supabase REST
SB_HEADERS = {
    "apikey": SUPABASE_SECRET_KEY,
    "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
    "Content-Type": "application/json",
}

def sb_get(table: str, params: Dict[str, Any], timeout=30):
    r = requests.get(f"{SUPABASE_URL}/rest/v1/{table}", headers=SB_HEADERS, params=params, timeout=timeout)
    r.raise_for_status()
    return r.json()

def sb_insert(table: str, rows: List[Dict[str, Any]], timeout=30):
    r = requests.post(f"{SUPABASE_URL}/rest/v1/{table}", headers=SB_HEADERS, json=rows, timeout=timeout)
    r.raise_for_status()
    return r.json() if r.text else None

def sb_upsert(table: str, rows: List[Dict[str, Any]], on_conflict: Optional[str] = None, timeout=30):
    params = {}
    if on_conflict:
        params["on_conflict"] = on_conflict
    headers = {**SB_HEADERS, "Prefer": "resolution=merge-duplicates"}
    r = requests.post(f"{SUPABASE_URL}/rest/v1/{table}", headers=headers, params=params, json=rows, timeout=timeout)
    r.raise_for_status()
    return r.json() if r.text else None

# Spoonacular API
BASE = "https://api.spoonacular.com"

def spoonacular_get(path: str, params: Dict[str, Any], timeout=30):
    params = dict(params or {})
    headers = {"x-api-key": SPOONACULAR_API_KEY}  # stabiler als ?apiKey=
    r = requests.get(f"{BASE}{path}", params=params, headers=headers, timeout=timeout)
    # Fehlerbehandlung
    if r.status_code == 402:
        raise RuntimeError("Spoonacular: Payment Required / Quota exceeded.")
    if r.status_code == 401:
        raise RuntimeError("Spoonacular: 401 Unauthorized – API Key prüfen.")
    if r.status_code == 429:
        # Rate-Limit: klein pausieren und nochmal versuchen
        time.sleep(3)
        r = requests.get(f"{BASE}{path}", params=params, headers=headers, timeout=timeout)
    r.raise_for_status()
    return r.json()

# =========================
#   Helper (Text/Chunks)
# =========================
TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")

def html_to_text(s: Optional[str]) -> str:
    if not s:
        return ""
    s = TAG_RE.sub(" ", s)
    s = WS_RE.sub(" ", s).strip()
    return s

def norm(s: str) -> str:
    return " ".join((s or "").strip().lower().split())

def make_embedding(text: str):
    """
    Berechnet das Embedding eines Textes
    """
    model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    return model.encode(text).tolist()

def save_recipe_to_supabase(recipe_data):
    """
    Speichert ein Rezept (inkl. Embedding) in Supabase
    """
    # Extrahiere die vollständige Verbindungsinformation von Supabase
    host = SUPABASE_URL.replace("https://", "").replace(".supabase.co", "")
    database = "postgres"  # Standard-Datenbankname für Supabase
    user = "postgres"      # Standard-Datenbankbenutzer
    password = SUPABASE_SECRET_KEY
    port = 5432            # Standard-Port für PostgreSQL

    # Verbinde mit der Supabase-Datenbank (PostgreSQL)
    conn = psycopg2.connect(
        host=f"{host}.supabase.co",  # Vollständiger Hostname (mit .supabase.co)
        database=database,
        user=user,
        password=password,
        port=port  # Port hinzufügen
    )

    cursor = conn.cursor()

    title = recipe_data["title"]
    description = recipe_data["description"]
    instructions = recipe_data["instructions"]
    ingredients = " ".join([ingredient["name"] for ingredient in recipe_data["ingredients"]])

    # Berechne Embeddings für Text (Titel + Beschreibung + Anweisungen)
    text_embedding = make_embedding(title + " " + description + " " + instructions)

    # Berechne Embedding für Zutaten (aggregiert)
    ingredients_embedding = make_embedding(ingredients)

    # Speichern der Daten in der Supabase-Datenbank
    cursor.execute("""
        INSERT INTO test_recipes (name, description, instructions, text_embedding, ingredients_embedding)
        VALUES (%s, %s, %s, %s, %s)
    """, (title, description, instructions, json.dumps(text_embedding), json.dumps(ingredients_embedding)))

    conn.commit()
    cursor.close()

def fetch_recipes(query="soup", number=10):
    """
    Holt Rezepte von Spoonacular API
    """
    url = f"https://api.spoonacular.com/recipes/complexSearch?query={query}&number={number}&apiKey={SPOONACULAR_API_KEY}"
    response = requests.get(url)
    return response.json()


def main():
    """
    Hauptfunktion, um Rezepte zu holen und in Supabase zu speichern
    """
    recipes = fetch_recipes(query="soup", number=10)  # z. B. 10 Rezepte holen

    for recipe in recipes["results"]:
        save_recipe_to_supabase(recipe)

if __name__ == "__main__":
    main()
