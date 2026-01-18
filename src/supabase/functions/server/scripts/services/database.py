# Verwaltet Datenbankverbindungen und speichert Rezepte in Supabase

import uuid
import logging
import psycopg2
from psycopg2 import sql
from typing import List
from config import SUPABASE_DB_URL, TABLE_RECIPES, TABLE_ING, TABLE_LINK, TABLE_NUTRITION
from models.recipe import Recipe, Ingredient
from models.embedding import embedding_model

class DatabaseService:
    def __init__(self):
        self.connection_string = SUPABASE_DB_URL

    def get_connection(self):
        return psycopg2.connect(self.connection_string)

    # Prüft, ob eine Zutat existiert
    def upsert_ingredient(self, cur, name: str) -> uuid.UUID:
        # Existiert die Zutat bereits
        cur.execute(
            sql.SQL("SELECT ingredient_id FROM {} WHERE name = %s").format(sql.Identifier(TABLE_ING)),
            (name,)
        )
        row = cur.fetchone()
        # JA: ID zurück geben
        if row:
            return row[0]

        # Nein: Neu anlegen & einfügen
        iid = uuid.uuid4()
        ing_embedding = embedding_model.vector_to_literal(embedding_model.embed(name))

        cur.execute(
            sql.SQL("INSERT INTO {} (ingredient_id, name, name_embedding) VALUES (%s, %s, %s::vector) RETURNING ingredient_id")
            .format(sql.Identifier(TABLE_ING)),
            (str(iid), name, ing_embedding)
        )
        return cur.fetchone()[0]

    # Assoziationsklasse: test_recipe_ingredients
    def link_ingredients_to_recipe(self, cur, recipe_id: uuid.UUID, ingredients: List[Ingredient]):
        for ingredient in ingredients:
            if not ingredient.name.strip():
                continue

            ingredient_id = self.upsert_ingredient(cur, ingredient.name)
            logging.info(f"Zutat: {ingredient.name} → {ingredient.amount} {ingredient.unit}")

            cur.execute(
                sql.SQL("""
                        INSERT INTO {} (recipe_id, ingredient_id, quantity_text, amount, unit)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (recipe_id, ingredient_id) DO UPDATE SET
                            quantity_text = EXCLUDED.quantity_text,
                                                                      amount = EXCLUDED.amount,
                                                                      unit = EXCLUDED.unit
                        """).format(sql.Identifier(TABLE_LINK)),
                (str(recipe_id), str(ingredient_id), ingredient.quantity_text, ingredient.amount, ingredient.unit)
            )

    # Speichert Nährwerte in DB
    def insert_recipe_nutrition(self, cur, recipe_id: uuid.UUID, nutrition):
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
                str(recipe_id),
                nutrition.calories, nutrition.protein, nutrition.carbohydrates, nutrition.fat,
                nutrition.fiber, nutrition.sugar, nutrition.sodium, nutrition.saturated_fat,
                nutrition.cholesterol, nutrition.potassium, nutrition.vitamin_a, nutrition.vitamin_c,
                nutrition.vitamin_d, nutrition.calcium, nutrition.iron
            )
        )

    def insert_recipe(self, cur, recipe: Recipe) -> uuid.UUID:
        recipe_id = uuid.uuid4() if not recipe.recipe_id else recipe.recipe_id

        # Rezept
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
                str(recipe_id),
                recipe.name, recipe.description, recipe.instructions,
                recipe.vegan, recipe.vegetarian, recipe.difficulty, recipe.diet, recipe.image_url,
                recipe.total_time, recipe.servings,
                recipe.price.price_per_serving,
                recipe.nutrition.calories, recipe.nutrition.protein, recipe.nutrition.carbohydrates,
                recipe.nutrition.fat, recipe.nutrition.fiber, recipe.nutrition.sugar, recipe.nutrition.sodium,
                embedding_model.vector_to_literal(recipe.text_embedding),
                embedding_model.vector_to_literal(recipe.ingredients_embedding)
            )
        )

        inserted_id = cur.fetchone()[0]

        # Nährwert-Insert
        self.insert_recipe_nutrition(cur, inserted_id, recipe.nutrition)

        return inserted_id

    # Speichert  Rezept inkl. aller Verknüpfungen
    def save_recipe(self, recipe: Recipe) -> uuid.UUID:
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                recipe_id = self.insert_recipe(cur, recipe) # Rezept inkl. Nährwerte
                self.link_ingredients_to_recipe(cur, recipe_id, recipe.ingredients) # Assoziationsklasse
                conn.commit()
                return recipe_id
