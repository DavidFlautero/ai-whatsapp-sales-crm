from __future__ import annotations

import struct

from voice_worker.pro.audio import FrameAccumulator, JitterBuffer, normalize_pcm16, rms_dbfs
from voice_worker.pro.contracts import AudioFrame, EventType, VoiceEvent


def frame(sequence: int, value: int = 1000, samples: int = 320) -> AudioFrame:
    return AudioFrame(pcm=struct.pack(f"<{samples}h", *([value] * samples)), sequence=sequence)


def test_audio_frame_duration_and_event_serialization() -> None:
    value = frame(1)
    assert value.duration_ms == 20
    event = VoiceEvent(EventType.READY, "session", {"ok": True}, 123)
    assert event.to_dict()["type"] == "ready"


def test_jitter_buffer_reorders_frames() -> None:
    jitter = JitterBuffer(capacity=3)
    assert [value.sequence for value in jitter.push(frame(10))] == [10]
    assert jitter.push(frame(12)) == []
    assert [value.sequence for value in jitter.push(frame(11))] == [11, 12]


def test_accumulator_and_normalizer() -> None:
    accumulator = FrameAccumulator()
    accumulator.append(frame(1))
    accumulator.append(frame(2))
    assert accumulator.duration_ms == 40
    audio = accumulator.clear()
    assert len(audio) == 1280
    assert accumulator.duration_ms == 0
    assert rms_dbfs(normalize_pcm16(audio)) > rms_dbfs(audio)
