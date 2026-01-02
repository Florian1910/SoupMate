#!/usr/bin/env python3
import sys
import json
import os

query = sys.argv[1] if len(sys.argv) > 1 else ""
ingredients_query = sys.argv[2] if len(sys.argv) > 2 else ""

print(f"🔍 CLEAN SEARCH: Query: '{query}'", file=sys.stderr)
if ingredients_query:
    print(f"🥕 Ingredients Query (from LLM): '{ingredients_query}'", file=sys.stderr)
else:
    print(f"⚠️  No ingredients query provided, using full query for ingredients similarity", file=sys.stderr)

# Korrekter Pfad
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(current_dir))
sys.path.append(project_root)

try:
    from services.search_service import EmbeddingService

    service = EmbeddingService()

    limit = 10

    print(f"🔍 Führe COMBINED Search aus für: '{query}'", file=sys.stderr)
    if ingredients_query:
        print(f"🥕 Verwende extrahierte Zutaten für Ingredients-Similarity: '{ingredients_query}'", file=sys.stderr)

    # WICHTIG: Hier muss search_combined() aufgerufen werden!
    # Wenn ingredients_query vorhanden, verwende es für Ingredients-Similarity
    results = service.search_combined(query, limit, ingredients_query=ingredients_query if ingredients_query else None)

    print(f"✅ COMBINED Search abgeschlossen: {len(results)} Ergebnisse", file=sys.stderr)

    # Zeige Score-Details für Debugging
    for i, recipe in enumerate(results[:3]):
        print(f"   Recipe {i+1}: {recipe.get('name', 'N/A')[:30]}...", file=sys.stderr)
        print(f"      Score: {recipe.get('score', 0):.4f}", file=sys.stderr)
        print(f"      Combined Score: {recipe.get('combined_score', 0):.4f}", file=sys.stderr)
        print(f"      Text Score: {recipe.get('text_score', 0):.4f}", file=sys.stderr)
        print(f"      Ingredients Score: {recipe.get('ingredients_score', 0):.4f}", file=sys.stderr)

    # WICHTIG: NUR JSON nach stdout
    output = json.dumps(results, ensure_ascii=False, default=str)

    sys.stdout.write(output)
    sys.stdout.flush()

except Exception as e:
    print(f"❌ Fehler in clean_search.py: {e}", file=sys.stderr)
    import traceback
    traceback.print_exc(file=sys.stderr)
    sys.stdout.write(json.dumps([]))
    sys.stdout.flush()