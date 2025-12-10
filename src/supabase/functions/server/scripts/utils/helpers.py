# utils/helpers.py


def format_recipe_details(details):
    """Format recipe details for display"""
    recipe = details.get("recipe", {})
    nutrition = details.get("nutrition")
    ingredients = details.get("ingredients", [])

    output = f"""
==================================================
RECIPE: {recipe.get('name', 'Unknown')}
==================================================

📝 Description:
{recipe.get('description', 'No description')}

🏷️  Tags:
  Vegan: {recipe.get('vegan', False)} | Vegetarian: {recipe.get('vegetarian', False)}
  Diet: {recipe.get('diet', 'None')} | Difficulty: {recipe.get('difficulty', 1)}/5

⏱️  Time: {recipe.get('total_time', 0)} minutes
👥 Servings: {recipe.get('servings', 1)}
💰 Price per serving: {recipe.get('price_per_serving', 'N/A')}

📊 Nutrition (per serving):
  Calories: {recipe.get('calories', 0)} kcal
  Protein: {recipe.get('protein', 0)}g
  Carbs: {recipe.get('carbohydrates', 0)}g
  Fat: {recipe.get('fat', 0)}g
  Fiber: {recipe.get('fiber', 0)}g
  Sugar: {recipe.get('sugar', 0)}g
  Sodium: {recipe.get('sodium', 0)}mg

📋 Ingredients ({len(ingredients)}):
"""
    for ing in ingredients:
        amount = f"{ing.get('amount', '')} {ing.get('unit', '')}".strip()
        if amount:
            output += f"  • {ing['name']}: {amount}\n"
        else:
            output += f"  • {ing['name']}\n"

    output += f"""
📖 Instructions:
{recipe.get('instructions', 'No instructions available')[:500]}...

🖼️  Image URL: {recipe.get('image_url', 'Not available')}
"""
    return output

def format_search_results(results):
    formatted = []
    for i, recipe in enumerate(results, 1):
        recipe_text = f"""
==================================================
ERGEBNIS {i}: {recipe['name']}
==================================================
📝 Beschreibung: {recipe['description'][:100]}...
🥗 Diät: {recipe['diet']} | 🥬 Vegan: {recipe['vegan']} | 🌱 Vegetarisch: {recipe['vegetarian']}
⏱️  Zeit: {recipe['total_time']}min | 🎯 Schwierigkeit: {recipe['difficulty']}/5
💰 Preis: {recipe['price_per_serving']} | 🏆 FINAL SCORE: {recipe['score']:.4f}
🖼️  Bild: {recipe.get('image_url', 'Kein Bild verfügbar')}

📋 ZUTATEN ({len(recipe['ingredients'])}):
"""
        for ing in recipe['ingredients'][:5]:
            quantity = ing.get('quantity_text', '')
            recipe_text += f"  • {ing['name']}: {quantity}\n"

        if len(recipe['ingredients']) > 5:
            recipe_text += f"  ... und {len(recipe['ingredients']) - 5} weitere Zutaten\n"

        recipe_text += f"""
📖 ZUBEREITUNG:
{recipe['instructions'][:200]}...

🔗 Recipe ID: {recipe['recipe_id']}
"""
        formatted.append(recipe_text)

    return "\n".join(formatted)