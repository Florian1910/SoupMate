# Definiert die Datenstrukturen

from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import uuid

@dataclass
class Nutrition:
    calories: int = 0
    protein: int = 0
    carbohydrates: int = 0
    fat: int = 0
    fiber: int = 0
    sugar: int = 0
    sodium: int = 0
    saturated_fat: int = 0
    cholesterol: int = 0
    potassium: int = 0
    vitamin_a: int = 0
    vitamin_c: int = 0
    vitamin_d: int = 0
    calcium: int = 0
    iron: int = 0

@dataclass
class Price:
    price_per_serving: float = 0.0

@dataclass
class Ingredient:
    name: str
    quantity_text: str = ""
    amount: Optional[float] = None
    unit: Optional[str] = None

@dataclass
class Recipe:
    recipe_id: Optional[uuid.UUID] = None
    name: str = ""
    description: str = ""
    instructions: str = ""
    vegan: bool = False
    vegetarian: bool = False
    difficulty: int = 1
    diet: Optional[str] = None
    image_url: Optional[str] = None
    total_time: int = 0
    servings: int = 1
    ingredients: List[Ingredient] = None
    nutrition: Nutrition = None
    price: Price = None
    text_embedding: List[float] = None
    ingredients_embedding: List[float] = None

    def __post_init__(self):
        if self.ingredients is None:
            self.ingredients = []
        if self.nutrition is None:
            self.nutrition = Nutrition()
        if self.price is None:
            self.price = Price()
