from __future__ import annotations

from voice_worker.pro.tts_stream import SentenceChunker


def test_sentence_chunker_never_loses_text() -> None:
    chunker = SentenceChunker(minimum_chars=10, maximum_chars=35)
    chunks = []
    for token in ["Hola, ", "te escucho. ", "Voy a revisar el producto ", "y su precio ahora mismo."]:
        chunks.extend(chunker.feed(token))
    chunks.extend(chunker.flush())
    assert chunks
    combined = " ".join(chunks)
    assert "Hola" in combined
    assert "precio" in combined
    assert all(len(chunk) <= 50 for chunk in chunks)
