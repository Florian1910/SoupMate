import re
import logging
from typing import List
from sentence_transformers import SentenceTransformer
from config import MODEL_NAME, EMB_DIM

# Regex für HTML Cleaning
TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")

class EmbeddingModel:
    def __init__(self):
        logging.info(f"Lade Embedding-Modell: {MODEL_NAME}")
        self.model = SentenceTransformer(MODEL_NAME)

    def html_to_text(self, s: str) -> str:
        if not s: return ""
        s = TAG_RE.sub(" ", s)
        s = WS_RE.sub(" ", s).strip()
        return s

    def embed(self, text: str) -> List[float]:
        vec = self.model.encode(text or "").tolist()
        if len(vec) != EMB_DIM:
            raise RuntimeError(f"Embedding-Dimension unerwartet: {len(vec)} != {EMB_DIM}")
        return vec

    def vector_to_literal(self, vec: List[float]) -> str:
        return "[" + ",".join(f"{x:.8f}" for x in vec) + "]"

# Global instance
embedding_model = EmbeddingModel()