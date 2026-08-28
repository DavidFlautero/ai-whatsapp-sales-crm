from __future__ import annotations

import struct

from voice_worker.pro.contracts import AudioFrame
from voice_worker.pro.turns import AdaptiveTurnDetector, TurnSignal


def make_frame(sequence: int, amplitude: int) -> AudioFrame:
    return AudioFrame(
        pcm=struct.pack("<320h", *([amplitude] * 320)),
        sequence=sequence,
    )


def test_turn_detector_starts_and_ends() -> None:
    detector = AdaptiveTurnDetector(start_frames=2, end_silence_ms=60, min_speech_ms=40)
    signals = []
    sequence = 0
    for _ in range(4):
        signals.append(detector.accept(make_frame(sequence, 0)).signal)
        sequence += 1
    for _ in range(5):
        signals.append(detector.accept(make_frame(sequence, 8000)).signal)
        sequence += 1
    for _ in range(4):
        signals.append(detector.accept(make_frame(sequence, 0)).signal)
        sequence += 1
    assert TurnSignal.SPEECH_STARTED in signals
    assert TurnSignal.SPEECH_ENDED in signals
