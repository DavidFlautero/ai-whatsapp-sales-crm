from __future__ import annotations

import io
import struct
import wave

from voice_worker.pro.telephony_audio import iter_pcm_frames, resample_pcm16_mono, wav_to_pcm16_mono


def test_resample_8k_to_16k_preserves_duration() -> None:
    pcm = struct.pack("<800h", *range(800))
    converted = resample_pcm16_mono(pcm, 8_000, 16_000)
    assert len(converted) == 3_200


def test_phone_frames_are_20ms() -> None:
    pcm = b"\x00\x00" * 800
    frames = list(iter_pcm_frames(pcm, 8_000, 20))
    assert len(frames) == 5
    assert all(len(frame) == 320 for frame in frames)


def test_wav_to_phone_pcm() -> None:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(16_000)
        handle.writeframes(b"\x00\x00" * 16_000)
    assert len(wav_to_pcm16_mono(buffer.getvalue(), 8_000)) == 16_000
