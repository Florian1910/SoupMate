import re
import logging
from typing import List
from sentence_transformers import SentenceTransformer
from config import MODEL_NAME, EMB_DIM

# Regex-Patterns vorkompilieren für bessere Performance
# TAG_RE findet HTML-Tags, WS_RE findet Whitespaces (Tabs, Newlines)
TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")

class EmbeddingModel:
    # Initialisiert die Klasse und lädt das Modell einmalig in den Speicher
    def __init__(self):
        logging.info(f"Lade Embedding-Modell: {MODEL_NAME}")
        self.model = SentenceTransformer(MODEL_NAME)

    # Entfernt HTML-Tags aus dem String und normalisiert Leerzeichen/Umbrüche
    def html_to_text(self, s: str) -> str:
        if not s: return ""
        s = TAG_RE.sub(" ", s)
        s = WS_RE.sub(" ", s).strip()
        return s

    # Wandelt den Text in einen Vektor um
    def embed(self, text: str) -> List[float]:
        vec = self.model.encode(text or "").tolist()
        if len(vec) != EMB_DIM:
            raise RuntimeError(f"Embedding-Dimension unerwartet: {len(vec)} != {EMB_DIM}")
        return vec

    # Formatiert den Vektor als String
    def vector_to_literal(self, vec: List[float]) -> str:
        return "[" + ",".join(f"{x:.8f}" for x in vec) + "]"

# Erstellt eine globale Instanz, damit das Modell nicht bei jedem Request neu geladen wird
embedding_model = EmbeddingModel()