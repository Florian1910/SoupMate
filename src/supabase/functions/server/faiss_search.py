import faiss
import numpy as np
import sys
import json

# Funktion zum Erstellen eines FAISS-Index
def create_faiss_index(vectors, dim):
    index = faiss.IndexFlatL2(dim)  # L2-Abstand verwenden
    index.add(np.array(vectors, dtype='float32'))  # Vektoren zum Index hinzufügen
    return index

# Funktion zur Suche nach ähnlichen Vektoren
def search_in_faiss(query_vector, index, k=5):
    D, I = index.search(np.array([query_vector], dtype='float32'), k)  # Top k Vektoren suchen
    return I[0].tolist(), D[0].tolist()  # Rückgabe der IDs und Distanzen

# Beispiel: Vektoren (könnten Embeddings aus deinem Frontend sein)
vectors = [
    [0.1, 0.2, 0.3],
    [0.4, 0.5, 0.6],
    [0.7, 0.8, 0.9]
]
dim = 3  # Vektor-Dimension

# Erstelle den FAISS-Index
index = create_faiss_index(vectors, dim)

# Beispiel: Abfragevektor (z.B. vom Benutzer eingegebene Anfrage)
query_vector = [0.2, 0.3, 0.4]

# Suche nach ähnlichen Vektoren
ids, distances = search_in_faiss(query_vector, index)

# Ausgabe im JSON-Format
result = {
    'ids': ids,
    'distances': distances
}

# Ergebnis zurückgeben
print(json.dumps(result))
