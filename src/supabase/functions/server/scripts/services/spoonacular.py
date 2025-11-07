import requests
import logging
from typing import List, Dict, Any
from config import SPOONACULAR_API_KEY
from models.recipe import Recipe, Nutrition, Price, Ingredient
from models.embedding import embedding_model

class SpoonacularService:
    def __init__(self):
        self.api_key = SPOONACULAR_API_KEY

    def fetch_recipes(self, query: str = "", number: int = 20) -> List[Dict[str, Any]]:
        url = (
            "https://api.spoonacular.com/recipes/complexSearch"
            f"?number={number}"
            f"&addRecipeInformation=true"
            f"&addRecipeInstructions=true"
            f"&instructionsRequired=true"
            f"&fillIngredients=true"
            f"&addRecipeNutrition=true"
            f"&dishType=soup"
        )

        if query and query.strip():
            url += f"&query={query.strip()}"

        url += f"&apiKey={self.api_key}"

        logging.info(f"Spoonacular API: dishType=soup, query='{query}', number={number}")
        response = requests.get(url, timeout=60)
        response.raise_for_status()
        data = response.json() or {}

        recipes = data.get("results", [])
        logging.info(f"API Antwort: {len(recipes)} Rezepte mit dishType=soup")
        return recipes

    def calculate_difficulty(self, recipe_data: Dict[str, Any]) -> int:
        total_time = recipe_data.get("readyInMinutes", 0)
        ingredient_count = len(recipe_data.get("extendedIngredients", []))

        step_count = 0
        for instruction in recipe_data.get("analyzedInstructions", []):
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

    def extract_nutrition(self, recipe_data: Dict[str, Any]) -> Nutrition:
        nutrition_data = recipe_data.get("nutrition", {})
        nutrients = nutrition_data.get("nutrients", [])

        nutrition = Nutrition()
        nutrient_mapping = {
            "Calories": "calories",
            "Protein": "protein",
            "Carbohydrates": "carbohydrates",
            "Fat": "fat",
            "Fiber": "fiber",
            "Sugar": "sugar",
            "Sodium": "sodium",
            "Saturated Fat": "saturated_fat",
            "Cholesterol": "cholesterol",
            "Potassium": "potassium",
            "Vitamin A": "vitamin_a",
            "Vitamin C": "vitamin_c",
            "Vitamin D": "vitamin_d",
            "Calcium": "calcium",
            "Iron": "iron"
        }

        for nutrient in nutrients:
            name = nutrient.get("name", "")
            amount = nutrient.get("amount", 0)

            if name in nutrient_mapping:
                field_name = nutrient_mapping[name]
                setattr(nutrition, field_name, int(amount))

        logging.info(f"Extrahiert Nährwerte: {nutrition.calories} kcal, {nutrition.protein}g Protein")
        return nutrition

    def extract_price_info(self, recipe_data: Dict[str, Any]) -> Price:
        price_per_serving = recipe_data.get("pricePerServing", 0)

        if price_per_serving > 0:
            price_per_serving_usd = price_per_serving / 100
            usd_to_eur_rate = 0.92
            price_per_serving_eur = price_per_serving_usd * usd_to_eur_rate
        else:
            price_per_serving_eur = 0

        price = Price(price_per_serving=round(price_per_serving_eur, 2))
        logging.info(f"Extrahiert Preis: {price.price_per_serving}€ pro Portion")
        return price

    def normalize_recipe(self, recipe_data: Dict[str, Any]) -> Recipe:
        title = recipe_data.get("title") or ""
        description = embedding_model.html_to_text(recipe_data.get("summary") or "")

        # Zubereitungsschritte extrahieren
        analyzed_instructions = recipe_data.get("analyzedInstructions", [])
        instructions = []
        for instruction in analyzed_instructions:
            for step in instruction.get("steps", []):
                instructions.append(step.get("step", ""))
        instructions_text = " ".join(instructions)

        # Zutaten extrahieren
        extended_ingredients = recipe_data.get("extendedIngredients", [])
        ingredients = [
            Ingredient(
                name=ing.get("name", ""),
                quantity_text=ing.get("original", ""),
                amount=ing.get("amount"),
                unit=ing.get("unit")
            )
            for ing in extended_ingredients
        ]

        logging.info(f"Extended Ingredients für {title}: {len(ingredients)} Zutaten")

        # Embeddings generieren
        text_for_embedding = " ".join([title, description, instructions_text]).strip()
        ing_for_embedding = " ".join([ing.name for ing in ingredients]).strip()

        text_vec = embedding_model.embed(text_for_embedding)
        ing_vec = embedding_model.embed(ing_for_embedding)

        return Recipe(
            name=title,
            description=description,
            instructions=instructions_text,
            vegan=bool(recipe_data.get("vegan", False)),
            vegetarian=bool(recipe_data.get("vegetarian", False)),
            difficulty=self.calculate_difficulty(recipe_data),
            diet=recipe_data.get("diets", [""])[0] if recipe_data.get("diets") else None,
            image_url=recipe_data.get("image"),
            total_time=recipe_data.get("readyInMinutes") or 0,
            servings=recipe_data.get("servings", 1),
            ingredients=ingredients,
            nutrition=self.extract_nutrition(recipe_data),
            price=self.extract_price_info(recipe_data),
            text_embedding=text_vec,
            ingredients_embedding=ing_vec
        )