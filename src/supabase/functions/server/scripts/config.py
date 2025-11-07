import os
from dotenv import load_dotenv

load_dotenv()

# Konfiguration
SUPABASE_DB_URL = os.environ["SUPABASE_DB_URL"]
SPOONACULAR_API_KEY = os.environ["SPOONACULAR_API_KEY"]
TABLE_RECIPES = os.environ.get("TABLE_NAME") or "test_recipes"
TABLE_ING = "test_ingredients"
TABLE_LINK = "test_recipe_ingredients"
TABLE_NUTRITION = "test_recipe_nutrition"

# Model-Konfiguration
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
EMB_DIM = 384