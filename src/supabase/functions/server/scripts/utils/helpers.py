# utils/helpers.py - format_search_results Funktion
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