from __future__ import annotations

import io
import math
import struct
import wave


PCM_MIN = -32_768
PCM_MAX = 32_767


def _samples(pcm: bytes) -> tuple[int, ...]:
    if len(pcm) % 2:
        raise ValueError("PCM16 desalineado.")
    return struct.unpack(f"<{len(pcm) // 2}h", pcm) if pcm else ()


def resample_pcm16_mono(pcm: bytes, source_rate: int, target_rate: int) -> bytes:
    if source_rate <= 0 or target_rate <= 0:
        raise ValueError("Las frecuencias deben ser positivas.")
    if source_rate == target_rate or not pcm:
        return pcm
    source = _samples(pcm)
    if len(source) == 1:
        return struct.pack("<h", source[0])
    output_count = max(1, round(len(source) * target_rate / source_rate))
    scale = (len(source) - 1) / max(1, output_count - 1)
    output: list[int] = []
    for index in range(output_count):
        position = index * scale
        left = int(math.floor(position))
        right = min(len(source) - 1, left + 1)
        ratio = position - left
        value = round(source[left] * (1.0 - ratio) + source[right] * ratio)
        output.append(max(PCM_MIN, min(PCM_MAX, value)))
    return struct.pack(f"<{len(output)}h", *output)


def wav_to_pcm16_mono(audio: bytes, target_rate: int) -> bytes:
    try:
        with wave.open(io.BytesIO(audio), "rb") as handle:
            channels = handle.getnchannels()
            width = handle.getsampwidth()
            source_rate = handle.getframerate()
            frames = handle.readframes(handle.getnframes())
    except (wave.Error, EOFError) as exc:
        raise ValueError("El TTS devolvió un WAV inválido.") from exc
    if width != 2 or channels not in {1, 2}:
        raise ValueError("Solo se admite WAV PCM16 mono o estéreo.")
    if channels == 2:
        stereo = _samples(frames)
        mono = [round((stereo[index] + stereo[index + 1]) / 2) for index in range(0, len(stereo), 2)]
        frames = struct.pack(f"<{len(mono)}h", *mono)
    return resample_pcm16_mono(frames, source_rate, target_rate)


def iter_pcm_frames(pcm: bytes, sample_rate: int, frame_ms: int = 20):
    if frame_ms <= 0:
        raise ValueError("frame_ms debe ser positivo.")
    frame_bytes = max(2, round(sample_rate * frame_ms / 1000) * 2)
    for offset in range(0, len(pcm), frame_bytes):
        chunk = pcm[offset : offset + frame_bytes]
        if len(chunk) < frame_bytes:
            chunk += b"\x00" * (frame_bytes - len(chunk))
        yield chunk


def pcm_duration_ms(pcm: bytes, sample_rate: int) -> float:
    return len(pcm) * 1000 / max(1, sample_rate * 2)
