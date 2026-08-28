from __future__ import annotations

import asyncio
import io
import re
import shutil
import tempfile
import wave
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Protocol

import httpx

from .contracts import AudioChunk, VoiceRuntimeError
from .telemetry import metrics


class TextToSpeech(Protocol):
    async def synthesize(self, text: str, *, language: str, voice_id: str) -> bytes:
        ...

    @property
    def mime_type(self) -> str:
        ...

    @property
    def sample_rate(self) -> int:
        ...


class SentenceChunker:
    """Turns streaming LLM tokens into pronounceable clauses without cutting words."""

    _boundary = re.compile(r"(?<=[.!?;:])\s+|(?<=,)\s+")

    def __init__(self, minimum_chars: int = 28, maximum_chars: int = 150) -> None:
        self.minimum_chars = minimum_chars
        self.maximum_chars = maximum_chars
        self._buffer = ""

    @staticmethod
    def clean(text: str) -> str:
        text = re.sub(r"```.*?```", " ", text, flags=re.DOTALL)
        text = re.sub(r"[*_#>`~]", "", text)
        text = re.sub(r"https?://\S+", "enlace", text)
        return re.sub(r"\s+", " ", text).strip()

    def feed(self, token: str) -> list[str]:
        self._buffer += token
        chunks: list[str] = []
        while True:
            candidates = list(self._boundary.finditer(self._buffer))
            chosen_end = None
            for match in candidates:
                if match.end() >= self.minimum_chars:
                    chosen_end = match.end()
                    break
            if chosen_end is None and len(self._buffer) > self.maximum_chars:
                split = self._buffer.rfind(" ", self.minimum_chars, self.maximum_chars + 1)
                chosen_end = split + 1 if split >= self.minimum_chars else self.maximum_chars
            if chosen_end is None:
                break
            chunk = self.clean(self._buffer[:chosen_end])
            self._buffer = self._buffer[chosen_end:]
            if chunk:
                chunks.append(chunk)
        return chunks

    def flush(self) -> list[str]:
        chunk = self.clean(self._buffer)
        self._buffer = ""
        return [chunk] if chunk else []


class PiperTTS:
    def __init__(self, binary: str, model_path: str) -> None:
        self.binary = binary
        self.model_path = model_path

    @property
    def mime_type(self) -> str:
        return "audio/wav"

    @property
    def sample_rate(self) -> int:
        return 22_050

    async def synthesize(self, text: str, *, language: str, voice_id: str) -> bytes:
        del language, voice_id
        binary = shutil.which(self.binary) or self.binary
        if not self.model_path or not Path(self.model_path).is_file():
            raise VoiceRuntimeError("PIPER_MODEL_MISSING", "No se encontró PIPER_MODEL_PATH.")
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as output:
            output_path = Path(output.name)
        try:
            process = await asyncio.create_subprocess_exec(
                binary,
                "--model",
                self.model_path,
                "--output_file",
                str(output_path),
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await asyncio.wait_for(process.communicate(text.encode("utf-8")), timeout=20)
            if process.returncode != 0:
                raise VoiceRuntimeError(
                    "PIPER_FAILED",
                    stderr.decode("utf-8", errors="replace")[-500:] or "Piper falló.",
                    retryable=True,
                )
            return await asyncio.to_thread(output_path.read_bytes)
        except asyncio.TimeoutError as exc:
            raise VoiceRuntimeError("PIPER_TIMEOUT", "Piper superó el tiempo máximo.", retryable=True) from exc
        finally:
            output_path.unlink(missing_ok=True)


class ChatterboxHttpTTS:
    """Client for a dedicated GPU voice gateway; keeps GPU code outside the CRM VPS."""

    def __init__(self, gateway_url: str, *, token: str = "", output_sample_rate: int = 24_000) -> None:
        self.gateway_url = gateway_url.rstrip("/")
        self.token = token
        self._sample_rate = output_sample_rate

    @property
    def mime_type(self) -> str:
        return "audio/wav"

    @property
    def sample_rate(self) -> int:
        return self._sample_rate

    async def synthesize(self, text: str, *, language: str, voice_id: str) -> bytes:
        headers = {"accept": "audio/wav"}
        if self.token:
            headers["authorization"] = f"Bearer {self.token}"
        payload = {
            "text": text,
            "language": language,
            "voice_id": voice_id,
            "format": "wav",
            "stream": False,
        }
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(25, connect=5)) as client:
                response = await client.post(f"{self.gateway_url}/v1/speech", headers=headers, json=payload)
            if response.status_code >= 400:
                raise VoiceRuntimeError(
                    "TTS_GATEWAY_HTTP",
                    f"Gateway de voz respondió {response.status_code}: {response.text[:300]}",
                    retryable=response.status_code >= 500 or response.status_code == 429,
                )
            if not response.content:
                raise VoiceRuntimeError("TTS_EMPTY", "El gateway de voz devolvió audio vacío.", retryable=True)
            return response.content
        except httpx.HTTPError as exc:
            raise VoiceRuntimeError("TTS_GATEWAY_NETWORK", f"Falló el gateway de voz: {exc}", retryable=True) from exc


def wav_duration_ms(audio: bytes) -> float:
    try:
        with wave.open(io.BytesIO(audio), "rb") as handle:
            return handle.getnframes() * 1000 / handle.getframerate()
    except (wave.Error, EOFError, ZeroDivisionError):
        return 0.0


async def stream_speech(
    tokens: AsyncIterator[str],
    engine: TextToSpeech,
    *,
    language: str,
    voice_id: str,
    minimum_chars: int = 28,
    maximum_chars: int = 150,
) -> AsyncIterator[AudioChunk]:
    chunker = SentenceChunker(minimum_chars, maximum_chars)
    sequence = 0
    first = True

    async def produce(text: str) -> AudioChunk:
        nonlocal sequence, first
        with metrics.timer("tts_chunk_latency_ms"):
            audio = await engine.synthesize(text, language=language, voice_id=voice_id)
        if first:
            metrics.increment("tts_first_chunk")
            first = False
        chunk = AudioChunk(
            audio=audio,
            sequence=sequence,
            mime_type=engine.mime_type,
            sample_rate=engine.sample_rate,
            is_final=False,
        )
        sequence += 1
        return chunk

    async for token in tokens:
        for phrase in chunker.feed(token):
            yield await produce(phrase)
    tail = chunker.flush()
    for index, phrase in enumerate(tail):
        chunk = await produce(phrase)
        yield AudioChunk(
            audio=chunk.audio,
            sequence=chunk.sequence,
            mime_type=chunk.mime_type,
            sample_rate=chunk.sample_rate,
            is_final=index == len(tail) - 1,
        )
