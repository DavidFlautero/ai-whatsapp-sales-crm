from __future__ import annotations

import math
import struct
from collections import deque
from dataclasses import dataclass, field

from .contracts import AudioFrame, VoiceRuntimeError


PCM16_MIN = -32_768
PCM16_MAX = 32_767


def validate_pcm16(frame: AudioFrame) -> None:
    if frame.channels != 1:
        raise VoiceRuntimeError("AUDIO_CHANNELS", "Solo se admite audio mono.")
    if frame.sample_width != 2:
        raise VoiceRuntimeError("AUDIO_SAMPLE_WIDTH", "Solo se admite PCM signed 16-bit.")
    if len(frame.pcm) % 2:
        raise VoiceRuntimeError("AUDIO_ALIGNMENT", "La trama PCM quedó desalineada.")
    if frame.sample_rate not in {8_000, 16_000, 24_000, 48_000}:
        raise VoiceRuntimeError("AUDIO_SAMPLE_RATE", f"Frecuencia no admitida: {frame.sample_rate}")


def rms_dbfs(pcm: bytes) -> float:
    if not pcm:
        return -96.0
    count = len(pcm) // 2
    if count <= 0:
        return -96.0
    samples = struct.unpack(f"<{count}h", pcm[: count * 2])
    mean_square = sum(float(value) * float(value) for value in samples) / count
    if mean_square <= 0:
        return -96.0
    rms = math.sqrt(mean_square)
    return max(-96.0, 20.0 * math.log10(rms / PCM16_MAX))


def peak_dbfs(pcm: bytes) -> float:
    if not pcm:
        return -96.0
    count = len(pcm) // 2
    samples = struct.unpack(f"<{count}h", pcm[: count * 2])
    peak = max((abs(value) for value in samples), default=0)
    return -96.0 if peak == 0 else 20.0 * math.log10(peak / PCM16_MAX)


def normalize_pcm16(pcm: bytes, target_dbfs: float = -20.0, max_gain_db: float = 18.0) -> bytes:
    current = rms_dbfs(pcm)
    if current <= -90.0:
        return pcm
    gain_db = min(max_gain_db, target_dbfs - current)
    if abs(gain_db) < 0.25:
        return pcm
    factor = 10 ** (gain_db / 20.0)
    count = len(pcm) // 2
    samples = struct.unpack(f"<{count}h", pcm[: count * 2])
    adjusted = (max(PCM16_MIN, min(PCM16_MAX, round(sample * factor))) for sample in samples)
    return struct.pack(f"<{count}h", *adjusted)


@dataclass(slots=True)
class FrameAccumulator:
    sample_rate: int = 16_000
    max_duration_ms: int = 30_000
    _frames: list[bytes] = field(default_factory=list, init=False, repr=False)
    _bytes: int = field(default=0, init=False, repr=False)

    def __post_init__(self) -> None:
        if self.sample_rate <= 0:
            raise ValueError("sample_rate debe ser positivo")

    @property
    def duration_ms(self) -> float:
        return self._bytes * 1000 / (self.sample_rate * 2)

    def append(self, frame: AudioFrame) -> None:
        validate_pcm16(frame)
        if frame.sample_rate != self.sample_rate:
            raise VoiceRuntimeError("AUDIO_RATE_CHANGED", "La frecuencia cambió dentro del turno.")
        self._frames.append(frame.pcm)
        self._bytes += len(frame.pcm)
        if self.duration_ms > self.max_duration_ms:
            raise VoiceRuntimeError("UTTERANCE_TOO_LONG", "El turno superó la duración máxima.")

    def snapshot(self) -> bytes:
        return b"".join(self._frames)

    def clear(self) -> bytes:
        value = self.snapshot()
        self._frames.clear()
        self._bytes = 0
        return value


class JitterBuffer:
    """Reorders a small number of websocket/RTP frames by sequence."""

    def __init__(self, capacity: int = 10) -> None:
        self.capacity = max(2, capacity)
        self._pending: dict[int, AudioFrame] = {}
        self._expected: int | None = None
        self.dropped = 0

    def push(self, frame: AudioFrame) -> list[AudioFrame]:
        if self._expected is None:
            self._expected = frame.sequence
        if frame.sequence < self._expected:
            self.dropped += 1
            return []
        self._pending[frame.sequence] = frame
        ready: list[AudioFrame] = []
        while self._expected in self._pending:
            ready.append(self._pending.pop(self._expected))
            self._expected += 1
        if len(self._pending) > self.capacity:
            next_sequence = min(self._pending)
            self.dropped += max(0, next_sequence - self._expected)
            self._expected = next_sequence
            while self._expected in self._pending:
                ready.append(self._pending.pop(self._expected))
                self._expected += 1
        return ready


class PreRollBuffer:
    def __init__(self, max_frames: int = 12) -> None:
        self._frames: deque[AudioFrame] = deque(maxlen=max_frames)

    def append(self, frame: AudioFrame) -> None:
        self._frames.append(frame)

    def drain(self) -> tuple[AudioFrame, ...]:
        value = tuple(self._frames)
        self._frames.clear()
        return value
