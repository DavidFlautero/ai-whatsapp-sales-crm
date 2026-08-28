from __future__ import annotations

from collections import deque
from dataclasses import dataclass

from .advanced_config import AdvancedSettings
from .audio import pcm16_to_float32
from .vad import SpeechDetector


@dataclass(frozen=True, slots=True)
class TurnUpdate:
    speech_started: bool = False
    speech_ended: bool = False
    barge_in: bool = False
    audio: bytes | None = None
    probability: float = 0


class StreamingTurnDetector:
    frame_samples = 512
    sample_width = 2

    def __init__(
        self,
        settings: AdvancedSettings,
    ) -> None:
        self.settings = settings
        self.vad = SpeechDetector(
            settings.sample_rate
        )
        self.pending = bytearray()
        self.preroll: deque[bytes] = deque(
            maxlen=settings.vad_preroll_frames
        )
        self.speech = bytearray()
        self.started_frames = 0
        self.silence_frames = 0
        self.speaking = False
        self.assistant_speaking = False
        self.maximum_bytes = (
            settings.sample_rate
            * self.sample_width
            * settings.vad_max_turn_seconds
        )

    def set_assistant_speaking(
        self,
        value: bool,
    ) -> None:
        self.assistant_speaking = value

    def reset(self) -> None:
        self.pending.clear()
        self.preroll.clear()
        self.speech.clear()
        self.started_frames = 0
        self.silence_frames = 0
        self.speaking = False
        self.assistant_speaking = False
        self.vad.reset()

    def feed(
        self,
        chunk: bytes,
    ) -> list[TurnUpdate]:
        self.pending.extend(chunk)

        updates: list[TurnUpdate] = []
        frame_bytes = (
            self.frame_samples
            * self.sample_width
        )

        while len(self.pending) >= frame_bytes:
            frame = bytes(
                self.pending[:frame_bytes]
            )

            del self.pending[:frame_bytes]

            update = self.process_frame(frame)

            if update is not None:
                updates.append(update)

        return updates

    def flush(self) -> TurnUpdate | None:
        if not self.speech:
            return None

        audio = bytes(self.speech)
        self.finish_turn()

        return TurnUpdate(
            speech_ended=True,
            audio=audio,
        )

    def process_frame(
        self,
        frame: bytes,
    ) -> TurnUpdate | None:
        samples = pcm16_to_float32(frame)

        probability = float(
            self.vad.probability(samples)
        )

        if not self.speaking:
            self.preroll.append(frame)

            if (
                probability
                >= self.settings.vad_start_threshold
            ):
                self.started_frames += 1
            else:
                self.started_frames = 0

            if (
                self.started_frames
                < self.settings.vad_start_frames
            ):
                return None

            self.speaking = True
            self.speech.extend(
                b"".join(self.preroll)
            )
            self.preroll.clear()

            return TurnUpdate(
                speech_started=True,
                barge_in=self.assistant_speaking,
                probability=probability,
            )

        self.speech.extend(frame)

        if (
            probability
            <= self.settings.vad_end_threshold
        ):
            self.silence_frames += 1
        else:
            self.silence_frames = 0

        ended_by_silence = (
            self.silence_frames
            >= self.settings.vad_silence_frames
        )

        ended_by_limit = (
            len(self.speech)
            >= self.maximum_bytes
        )

        if not (
            ended_by_silence
            or ended_by_limit
        ):
            return None

        audio = bytes(self.speech)
        self.finish_turn()

        return TurnUpdate(
            speech_ended=True,
            audio=audio,
            probability=probability,
        )

    def finish_turn(self) -> None:
        self.speech.clear()
        self.preroll.clear()
        self.started_frames = 0
        self.silence_frames = 0
        self.speaking = False
