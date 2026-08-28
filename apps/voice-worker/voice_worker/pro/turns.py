from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from .audio import rms_dbfs
from .contracts import AudioFrame


class TurnSignal(StrEnum):
    NONE = "none"
    SPEECH_STARTED = "speech_started"
    SPEECH_ENDED = "speech_ended"
    MAX_DURATION = "max_duration"


@dataclass(slots=True, frozen=True)
class TurnDecision:
    signal: TurnSignal
    speech: bool
    dbfs: float
    threshold_dbfs: float
    speech_ms: float
    silence_ms: float


class AdaptiveTurnDetector:
    """Energy endpointing with an adaptive noise floor and hysteresis."""

    def __init__(
        self,
        *,
        start_frames: int = 3,
        end_silence_ms: int = 420,
        min_speech_ms: int = 180,
        max_utterance_ms: int = 30_000,
        margin_db: float = 11.0,
    ) -> None:
        self.start_frames = start_frames
        self.end_silence_ms = end_silence_ms
        self.min_speech_ms = min_speech_ms
        self.max_utterance_ms = max_utterance_ms
        self.margin_db = margin_db
        self.noise_floor_dbfs = -56.0
        self.in_speech = False
        self._candidate_frames = 0
        self._speech_ms = 0.0
        self._silence_ms = 0.0

    def reset(self) -> None:
        self.in_speech = False
        self._candidate_frames = 0
        self._speech_ms = 0.0
        self._silence_ms = 0.0

    def accept(self, frame: AudioFrame) -> TurnDecision:
        level = rms_dbfs(frame.pcm)
        duration = frame.duration_ms
        threshold = min(-28.0, self.noise_floor_dbfs + self.margin_db)
        voiced = level >= threshold

        if not self.in_speech and not voiced:
            # Slow adaptation protects speech onsets; never raise the floor above -38 dBFS.
            self.noise_floor_dbfs = min(-38.0, self.noise_floor_dbfs * 0.97 + level * 0.03)

        signal = TurnSignal.NONE
        if not self.in_speech:
            self._candidate_frames = self._candidate_frames + 1 if voiced else 0
            if self._candidate_frames >= self.start_frames:
                self.in_speech = True
                self._speech_ms = duration * self._candidate_frames
                self._silence_ms = 0.0
                signal = TurnSignal.SPEECH_STARTED
        else:
            self._speech_ms += duration
            if voiced:
                self._silence_ms = 0.0
            else:
                self._silence_ms += duration

            if self._speech_ms >= self.max_utterance_ms:
                signal = TurnSignal.MAX_DURATION
                self.reset()
            elif self._speech_ms >= self.min_speech_ms and self._silence_ms >= self.end_silence_ms:
                signal = TurnSignal.SPEECH_ENDED
                self.reset()

        return TurnDecision(
            signal=signal,
            speech=self.in_speech or signal in {TurnSignal.SPEECH_STARTED, TurnSignal.SPEECH_ENDED},
            dbfs=level,
            threshold_dbfs=threshold,
            speech_ms=self._speech_ms,
            silence_ms=self._silence_ms,
        )
