#!/usr/bin/env python3
import sys
import json
import os

print(f"🔍 CLEAN SEARCH: Starte mit Query: {sys.argv[1] if len(sys.argv) > 1 else 'keine'}", file=sys.stderr)

# Korrekter Pfad
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(current_dir))
sys.path.append(project_root)

try:
    from services.search_service import EmbeddingService

    service = EmbeddingService()

    if len(sys.argv) > 1:
        query = sys.argv[1]
    else:
        query = ""

    limit = 10

    print(f"🔍 Führe COMBINED Search aus für: '{query}'", file=sys.stderr)

    # WICHTIG: Hier muss search_combined() aufgerufen werden!
    results = service.search_combined(query, limit)

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