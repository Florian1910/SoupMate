import os
import sys
import json
import faiss
import numpy as np
import requests
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_SECRET_KEY = os.environ["SUPABASE_SECRET_KEY"]

SB_HEADERS = {
    "apikey": SUPABASE_SECRET_KEY,
    "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
}

def parse_embedding(value):
    """
    Supabase kann embedding als list oder als string "[...]" liefern.
    Wir machen es hier immer zu list[float].
    """
    if value is None:
        return None
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except Exception:
            v = value.strip().lstrip("[").rstrip("]")
            return [float(x) for x in v.split(",") if x.strip()]
    return None

def load_vectors(limit=300):
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/recipe_chunk",
        headers=SB_HEADERS,
        params={
            "select": "id,recipe_id,content,embedding",
            "embedding": "not.is.null",
            "limit": limit,
        },
        timeout=30,
    )
    r.raise_for_status()
    data = r.json()

    vectors = []
    meta = []

    for row in data:
        emb = parse_embedding(row.get("embedding"))
        if not emb:
            continue
        vectors.append(emb)
        meta.append(
            {
                "chunk_id": row["id"],
                "recipe_id": row["recipe_id"],
                "content": row["content"],
            }
        )

    return vectors, meta

def build_index(vectors):
    if not vectors:
        raise RuntimeError("no vectors loaded from supabase")
    dim = len(vectors[0])
    index = faiss.IndexFlatL2(dim)
    index.add(np.array(vectors, dtype="float32"))
    return index, dim

def adjust_query_dim(query_vec, dim):
    """
    Wenn die Query kürzer ist als der Index:
      → mit Nullen auffüllen
    Wenn sie länger ist:
      → abschneiden
    """
    if len(query_vec) == dim:
        return query_vec
    if len(query_vec) < dim:
        # pad with zeros
        return query_vec + [0.0] * (dim - len(query_vec))
    # len(query_vec) > dim
    return query_vec[:dim]

def main():
    # 1) Query-Embedding aus stdin lesen
    raw = sys.stdin.read()
    payload = json.loads(raw)
    query_vec = payload["embedding"]

    # 2) Vektoren aus Supabase holen
    vectors, meta = load_vectors()
    if not vectors:
      print(json.dumps({"results": [], "error": "no vectors in db"}))
      return

    # 3) Index bauen
    index, dim = build_index(vectors)

    # 4) Query auf richtige Länge bringen
    query_vec = adjust_query_dim(query_vec, dim)

    # 5) Suche
    D, I = index.search(np.array([query_vec], dtype="float32"), k=5)

    results = []
    for dist, idx in zip(D[0].tolist(), I[0].tolist()):
        m = meta[idx]
        results.append(
            {
                "chunk_id": m["chunk_id"],
                "recipe_id": m["recipe_id"],
                "content": m["content"],
                "distance": dist,
            }
        )

    print(json.dumps({"results": results}))

if __name__ == "__main__":
    main()
