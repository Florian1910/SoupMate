import json
import logging
from typing import Dict, Any, List

def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s"
    )

def print_json(data: Any):
    print(json.dumps(data, indent=2, ensure_ascii=False))

def format_recipe_details(recipe_data: Dict[str, Any]) -> str:
    """Formatiert Rezept-Details für die Konsolenausgabe"""
    recipe = recipe_data["recipe"]
    nutrition = recipe_data["nutrition"]
    ingredients = recipe_data["ingredients"]

    output = []
    output.append("=== REZEPT DETAILS ===")
    output.append(f"Name: {recipe['name']}")
    output.append(f"Beschreibung: {recipe['description'][:200]}...")
    output.append(f"Vegetarisch: {recipe['vegetarian']}, Vegan: {recipe['vegan']}")
    output.append(f"Schwierigkeit: {recipe['difficulty']}/5, Diät: {recipe['diet']}")
    output.append(f"Zeit: {recipe['total_time']}min, Portionen: {recipe['servings']}")

    output.append("\n=== ZUBEREITUNG ===")
    instructions = recipe['instructions'].strip()
    if instructions:
        # Kürze die Anleitung für die Übersicht
        if len(instructions) > 500:
            output.append(f"{instructions[:500]}...")
        else:
            output.append(instructions)
    else:
        output.append("Keine Zubereitungsanleitung verfügbar")

    output.append("\n=== PREIS ===")
    output.append(f"Preis pro Portion: {recipe['price_per_serving']}€")

    output.append("\n=== NÄHRWERTE (pro Portion) ===")
    output.append(f"Kalorien: {recipe['calories']} kcal")
    output.append(f"Protein: {recipe['protein']}g")
    output.append(f"Kohlenhydrate: {recipe['carbohydrates']}g")
    output.append(f"Fett: {recipe['fat']}g")
    output.append(f"Ballaststoffe: {recipe['fiber']}g")
    output.append(f"Zucker: {recipe['sugar']}g")
    output.append(f"Natrium: {recipe['sodium']}mg")

    if nutrition:
        output.append(f"Gesättigte Fettsäuren: {nutrition[4]}g")
        output.append(f"Cholesterin: {nutrition[8]}mg")
        output.append(f"Kalium: {nutrition[9]}mg")
        output.append(f"Vitamin A: {nutrition[10]}IU")
        output.append(f"Vitamin C: {nutrition[11]}mg")
        output.append(f"Kalzium: {nutrition[12]}mg")
        output.append(f"Eisen: {nutrition[13]}mg")

    output.append("\n=== ZUTATEN ===")
    for ing in ingredients:
        if ing['quantity_text']:
            output.append(f"- {ing['name']}: {ing['quantity_text']}")
        else:
            output.append(f"- {ing['name']}")

    return "\n".join(output)

def format_search_results(results: List[Dict[str, Any]]) -> str:
    """Formatiert Suchergebnisse für die Konsolenausgabe"""
    output = []

    for i, result in enumerate(results, 1):
        output.append(f"\n{'='*50}")
        output.append(f"ERGEBNIS {i}: {result['name']}")
        output.append(f"{'='*50}")

        output.append(f"📝 Beschreibung: {result['description'][:150]}...")
        output.append(f"🥗 Diät: {result['diet'] or 'Keine'} | 🥬 Vegan: {result['vegan']} | 🌱 Vegetarisch: {result['vegetarian']}")
        output.append(f"⏱️  Zeit: {result['total_time']}min | 🎯 Schwierigkeit: {result['difficulty']}/5")
        output.append(f"💰 Preis: {result['price_per_serving']} | 📏 Ähnlichkeit: {result['distance']:.4f}")

        output.append(f"\n📋 ZUTATEN ({len(result['ingredients'])}):")
        for ing in result['ingredients'][:8]:  # Zeige max. 8 Zutaten
            if ing['quantity_text']:
                output.append(f"  • {ing['name']}: {ing['quantity_text']}")
            else:
                output.append(f"  • {ing['name']}")

        if len(result['ingredients']) > 8:
            output.append(f"  ... und {len(result['ingredients']) - 8} weitere Zutaten")

        output.append(f"\n📖 ZUBEREITUNG:")
        instructions = result['instructions'].strip()
        if instructions:
            if len(instructions) > 200:
                output.append(f"  {instructions[:200]}...")
            else:
                output.append(f"  {instructions}")
        else:
            output.append("  Keine Zubereitungsanleitung verfügbar")

        output.append(f"\n🔗 Recipe ID: {result['recipe_id']}")

    return "\n".join(output)