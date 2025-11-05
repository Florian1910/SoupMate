import os
import re  # Dies hinzufügen
import requests
import json
from dotenv import load_dotenv
import psycopg2
from sentence_transformers import SentenceTransformer
import logging

# =========================
#   ENV laden & prüfen
# =========================
load_dotenv()  # .env im aktuellen Ordner

# Lade Umgebungsvariablen
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.environ.get("SUPABASE_SECRET_KEY")
SPOONACULAR_API_KEY = os.environ.get("SPOONACULAR_API_KEY")

# Überprüfe, ob die wichtigen Umgebungsvariablen gesetzt sind
if not SUPABASE_URL:
    raise RuntimeError("SUPABASE_URL fehlt in .env")
if not SUPABASE_SECRET_KEY:
    raise RuntimeError("SUPABASE_SECRET_KEY fehlt in .env (Secret/Service Role Key)")
if not SPOONACULAR_API_KEY:
    raise RuntimeError("SPOONACULAR_API_KEY fehlt in .env")

# Debugging-Ausgabe der Umgebungsvariablen
print(f"Using Supabase: {SUPABASE_URL}")

# =========================
#   HTTP-Clients
# =========================
# Supabase REST
SB_HEADERS = {
    "apikey": SUPABASE_SECRET_KEY,
    "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
    "Content-Type": "application/json",
}

def sb_get(table: str, params: dict, timeout=30):
    try:
        r = requests.get(f"{SUPABASE_URL}/rest/v1/{table}", headers=SB_HEADERS, params=params, timeout=timeout)
        r.raise_for_status()
        return r.json()
    except requests.exceptions.RequestException as e:
        logging.error(f"Error fetching from Supabase: {e}")
        raise

def sb_insert(table: str, rows: list, timeout=30):
    try:
        r = requests.post(f"{SUPABASE_URL}/rest/v1/{table}", headers=SB_HEADERS, json=rows, timeout=timeout)
        r.raise_for_status()
        return r.json() if r.text else None
    except requests.exceptions.RequestException as e:
        logging.error(f"Error inserting into Supabase: {e}")
        raise

def sb_upsert(table: str, rows: list, on_conflict: str = None, timeout=30):
    try:
        params = {"on_conflict": on_conflict} if on_conflict else {}
        headers = {**SB_HEADERS, "Prefer": "resolution=merge-duplicates"}
        r = requests.post(f"{SUPABASE_URL}/rest/v1/{table}", headers=headers, params=params, json=rows, timeout=timeout)
        r.raise_for_status()
        return r.json() if r.text else None
    except requests.exceptions.RequestException as e:
        logging.error(f"Error upserting into Supabase: {e}")
        raise

# =========================
#   Helper (Text/Chunks)
# =========================
TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")

def html_to_text(s: str) -> str:
    """ Entfernt HTML-Tags aus dem Text """
    if not s:
        return ""
    s = TAG_RE.sub(" ", s)
    s = WS_RE.sub(" ", s).strip()
    return s

def norm(s: str) -> str:
    """ Normalisiert den Text (entfernt überflüssige Leerzeichen) """
    return " ".join((s or "").strip().lower().split())

def make_embedding(text: str):
    """ Berechnet das Embedding eines Textes """
    try:
        model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
        return model.encode(text).tolist()
    except Exception as e:
        logging.error(f"Error creating embedding: {e}")
        raise

def save_recipe_to_supabase(recipe_data):
    """ Speichert ein Rezept in Supabase """
    try:
        # Extrahiere die vollständige Verbindungsinformation von Supabase
        host = SUPABASE_URL.replace("https://", "").replace(".supabase.co", "")
        database = "postgres"  # Standard-Datenbankname für Supabase
        user = "postgres"      # Standard-Datenbankbenutzer
        password = SUPABASE_SECRET_KEY
        port = 5432            # Standard-Port für PostgreSQL

        print(f"Connecting to database at {host}.supabase.co:{port}")

        # Verbinde mit der Supabase-Datenbank (PostgreSQL)
        conn = psycopg2.connect(
            host=f"{host}.supabase.co",  # Vollständiger Hostname (mit .supabase.co)
            database=database,
            user=user,
            password=password,
            port=port
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
    except psycopg2.Error as e:
        logging.error(f"Error saving recipe to Supabase: {e}")
        raise

def fetch_recipes(query="soup", number=10):
    """ Holt Rezepte von Spoonacular API """
    try:
        url = f"https://api.spoonacular.com/recipes/complexSearch?query={query}&number={number}&apiKey={SPOONACULAR_API_KEY}"
        response = requests.get(url)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        logging.error(f"Error fetching recipes from Spoonacular API: {e}")
        raise

def main():
    """ Hauptfunktion, um Rezepte zu holen und in Supabase zu speichern """
    try:
        recipes = fetch_recipes(query="soup", number=10)  # Holen von 10 Rezepten
        for recipe in recipes["results"]:
            save_recipe_to_supabase(recipe)
    except Exception as e:
        logging.error(f"Error in main function: {e}")

if __name__ == "__main__":
    main()
