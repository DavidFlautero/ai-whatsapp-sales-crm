from __future__ import annotations

import asyncio
import logging
import threading
import time
from dataclasses import dataclass, field
from typing import Protocol

from .contracts import TranscriptHypothesis, VoiceRuntimeError
from .telemetry import metrics


logger = logging.getLogger(__name__)


class SpeechToText(Protocol):
    async def transcribe(self, pcm16: bytes, sample_rate: int, language: str | None = None) -> TranscriptHypothesis:
        ...

    @property
    def ready(self) -> bool:
        ...


class FasterWhisperSTT:
    """Lazy, thread-safe faster-whisper adapter with language auto-detection."""

    def __init__(
        self,
        model_name: str,
        *,
        device: str = "auto",
        compute_type: str = "int8",
        cpu_threads: int = 2,
        queue_timeout_seconds: float = 15.0,
    ) -> None:
        self.model_name = model_name
        self.device = device
        self.compute_type = compute_type
        self.cpu_threads = max(1, cpu_threads)
        self.queue_timeout_seconds = max(
            1.0,
            queue_timeout_seconds,
        )
        self._model = None
        self._load_lock = threading.Lock()
        self._decode_lock = threading.Lock()
        self._decode_gate = asyncio.Semaphore(1)
        self._state_lock = threading.Lock()
        self._load_error: str | None = None
        self._queue_depth = 0
        self._active_decodes = 0

    @property
    def ready(self) -> bool:
        return self._model is not None and self._load_error is None

    def status(self) -> dict[str, object]:
        with self._state_lock:
            return {
                "loaded": self.ready,
                "model": self.model_name,
                "device": self.device,
                "compute_type": self.compute_type,
                "cpu_threads": self.cpu_threads,
                "queue_depth": self._queue_depth,
                "active_decodes": self._active_decodes,
                "load_error": self._load_error,
            }

    def _ensure_model(self):
        if self._model is not None:
            return self._model
        with self._load_lock:
            if self._model is not None:
                return self._model
            try:
                from faster_whisper import WhisperModel

                self._model = WhisperModel(
                    self.model_name,
                    device=self.device,
                    compute_type=self.compute_type,
                    cpu_threads=self.cpu_threads,
                    num_workers=1,
                )
                logger.info("stt_model_loaded", extra={"voice_extra": {"model": self.model_name, "device": self.device}})
            except Exception as exc:
                self._load_error = str(exc)
                raise VoiceRuntimeError("STT_MODEL_LOAD", f"No se pudo cargar STT: {exc}", retryable=True) from exc
        return self._model

    def _decode(self, pcm16: bytes, sample_rate: int, language: str | None) -> TranscriptHypothesis:
        if sample_rate != 16_000:
            raise VoiceRuntimeError("STT_SAMPLE_RATE", "Faster-Whisper profesional espera PCM a 16 kHz.")
        try:
            import numpy as np
        except ImportError as exc:
            raise VoiceRuntimeError("STT_NUMPY_MISSING", "Falta numpy para ejecutar STT.") from exc

        model = self._ensure_model()
        waveform = np.frombuffer(pcm16, dtype=np.int16).astype(np.float32) / 32768.0
        started = time.perf_counter()
        with self._decode_lock:
            segments, info = model.transcribe(
                waveform,
                language=language,
                beam_size=3,
                best_of=3,
                condition_on_previous_text=False,
                word_timestamps=True,
                vad_filter=True,
                vad_parameters={"min_silence_duration_ms": 250},
                temperature=0.0,
            )
            materialized = list(segments)
        latency_ms = (time.perf_counter() - started) * 1000
        metrics.observe("stt_latency_ms", latency_ms)

        text = " ".join(segment.text.strip() for segment in materialized if segment.text.strip()).strip()
        if not text:
            raise VoiceRuntimeError("STT_EMPTY", "No se detectó una frase inteligible.", retryable=True)

        words: list[dict[str, object]] = []
        probabilities: list[float] = []
        for segment in materialized:
            for word in segment.words or ():
                probability = float(getattr(word, "probability", 0.0) or 0.0)
                probabilities.append(probability)
                words.append(
                    {
                        "text": word.word.strip(),
                        "start": round(float(word.start), 3),
                        "end": round(float(word.end), 3),
                        "confidence": round(probability, 4),
                    }
                )
        confidence = sum(probabilities) / len(probabilities) if probabilities else 0.5
        detected_language = str(getattr(info, "language", None) or language or "und")
        return TranscriptHypothesis(
            text=text,
            language=detected_language,
            confidence=max(0.0, min(1.0, confidence)),
            is_final=True,
            words=tuple(words),
        )

    async def warmup(self) -> None:
        await asyncio.to_thread(self._ensure_model)

    async def transcribe(
        self,
        pcm16: bytes,
        sample_rate: int,
        language: str | None = None,
    ) -> TranscriptHypothesis:
        if len(pcm16) < sample_rate * 2 * 0.08:
            raise VoiceRuntimeError(
                "STT_AUDIO_TOO_SHORT",
                "El audio es demasiado corto.",
                retryable=True,
            )

        with self._state_lock:
            self._queue_depth += 1
            metrics.gauge(
                "stt_queue_depth",
                self._queue_depth,
            )

        try:
            await asyncio.wait_for(
                self._decode_gate.acquire(),
                timeout=self.queue_timeout_seconds,
            )
        except TimeoutError as exc:
            metrics.increment("stt_queue_timeouts")
            raise VoiceRuntimeError(
                "STT_BUSY",
                "El reconocimiento de voz está ocupado.",
                retryable=True,
            ) from exc
        finally:
            with self._state_lock:
                self._queue_depth = max(
                    0,
                    self._queue_depth - 1,
                )
                metrics.gauge(
                    "stt_queue_depth",
                    self._queue_depth,
                )

        with self._state_lock:
            self._active_decodes += 1
            metrics.gauge(
                "stt_active_decodes",
                self._active_decodes,
            )

        try:
            return await asyncio.to_thread(
                self._decode,
                pcm16,
                sample_rate,
                language,
            )
        finally:
            with self._state_lock:
                self._active_decodes = max(
                    0,
                    self._active_decodes - 1,
                )
                metrics.gauge(
                    "stt_active_decodes",
                    self._active_decodes,
                )

            self._decode_gate.release()


@dataclass(slots=True)
class StreamingRecognizer:
    engine: SpeechToText
    sample_rate: int = 16_000
    partial_interval_ms: int = 700
    minimum_partial_ms: int = 900
    _buffer: bytearray = field(default_factory=bytearray, init=False, repr=False)
    _last_partial_size: int = field(default=0, init=False, repr=False)
    _partial_lock: asyncio.Lock = field(default_factory=asyncio.Lock, init=False, repr=False)

    def __post_init__(self) -> None:
        if self.sample_rate <= 0:
            raise ValueError("sample_rate debe ser positivo")

    @property
    def duration_ms(self) -> float:
        return len(self._buffer) * 1000 / (self.sample_rate * 2)

    def append(self, pcm: bytes) -> None:
        self._buffer.extend(pcm)

    async def maybe_partial(self, language: str | None = None) -> TranscriptHypothesis | None:
        bytes_per_interval = round(self.sample_rate * 2 * self.partial_interval_ms / 1000)
        if self.duration_ms < self.minimum_partial_ms:
            return None
        if len(self._buffer) - self._last_partial_size < bytes_per_interval:
            return None
        if self._partial_lock.locked():
            return None
        async with self._partial_lock:
            snapshot = bytes(self._buffer)
            self._last_partial_size = len(snapshot)
            try:
                result = await self.engine.transcribe(snapshot, self.sample_rate, language)
            except VoiceRuntimeError:
                return None
            return TranscriptHypothesis(
                text=result.text,
                language=result.language,
                confidence=result.confidence,
                is_final=False,
                words=result.words,
            )

    async def finalize(self, language: str | None = None) -> TranscriptHypothesis:
        snapshot = bytes(self._buffer)
        self.reset()
        return await self.engine.transcribe(snapshot, self.sample_rate, language)

    def reset(self) -> None:
        self._buffer.clear()
        self._last_partial_size = 0
