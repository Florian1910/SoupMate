# api.py - Korrigierte Version
from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os

# Füge das parent directory zum Python-Pfad hinzu
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Jetzt importieren
from services.search_service import EmbeddingService
import json
from decimal import Decimal

app = Flask(__name__)
CORS(app)

embedding_service = EmbeddingService()

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)

@app.route('/api/search/text', methods=['POST'])
def search_text():
    try:
        data = request.json
        query = data.get('query', '')
        limit = data.get('limit', 10)
        filters = data.get('filters', {})

        print(f"[API] Suche nach: '{query}', Limit: {limit}")

        results = embedding_service.search_by_text(query, limit)

        filtered_results = []
        for recipe in results:
            diet_type = filters.get('dietType', 'alle')
            if diet_type == 'vegan' and not recipe['vegan']:
                continue
            if diet_type == 'vegetarisch' and not recipe['vegetarian']:
                continue

            difficulty = filters.get('difficulty', 0)
            if difficulty > 0 and recipe['difficulty'] != difficulty:
                continue

            total_time = filters.get('totalTime', [0, 240])
            if isinstance(total_time, list) and len(total_time) == 2:
                if recipe['total_time'] < total_time[0] or recipe['total_time'] > total_time[1]:
                    continue

            filtered_results.append(recipe)

        return jsonify({
            'success': True,
            'query': query,
            'recipes': filtered_results[:limit],
            'count': len(filtered_results),
            'strategy': 'semantic_embedding'
        })

    except Exception as e:
        print(f"[API] Fehler: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/search/ingredients', methods=['POST'])
def search_ingredients():
    try:
        data = request.json
        ingredients = data.get('ingredients', [])
        limit = data.get('limit', 10)

        results = embedding_service.search_by_ingredients(ingredients, limit)

        return jsonify({
            'success': True,
            'ingredients': ingredients,
            'recipes': results,
            'count': len(results),
            'strategy': 'semantic_ingredients'
        })

    except Exception as e:
        print(f"[API] Fehler: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'ok': True,
        'service': 'semantic-search-api'
    })

if __name__ == '__main__':
    print("🚀 Starting Flask API for semantic search...")
    print("📡 Endpoint: http://localhost:5000/api/search/text")
    print("📁 Current dir:", os.getcwd())
    app.run(host='0.0.0.0', port=5000, debug=True)