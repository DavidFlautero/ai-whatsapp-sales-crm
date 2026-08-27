from __future__ import annotations

from dataclasses import asdict, dataclass, field
from enum import StrEnum
from typing import Any, Literal


class SessionState(StrEnum):
    CONNECTING = "connecting"
    LISTENING = "listening"
    THINKING = "thinking"
    SPEAKING = "speaking"
    TRANSFERRING = "transferring"
    CLOSED = "closed"
    FAILED = "failed"


class Participant(StrEnum):
    CUSTOMER = "customer"
    ASSISTANT = "assistant"
    OPERATOR = "operator"
    SYSTEM = "system"


class EventType(StrEnum):
    READY = "ready"
    STATE = "state"
    SPEECH_STARTED = "speech_started"
    SPEECH_ENDED = "speech_ended"
    TRANSCRIPT_PARTIAL = "transcript_partial"
    TRANSCRIPT_FINAL = "transcript_final"
    REPLY_PARTIAL = "reply_partial"
    AUDIO_CHUNK = "audio_chunk"
    AUDIO_STOP = "audio_stop"
    TOOL_STARTED = "tool_started"
    TOOL_FINISHED = "tool_finished"
    METRIC = "metric"
    ERROR = "error"


@dataclass(slots=True, frozen=True)
class AudioFrame:
    pcm: bytes
    sequence: int
    sample_rate: int = 16_000
    channels: int = 1
    sample_width: int = 2
    received_at_ms: int = 0

    @property
    def duration_ms(self) -> float:
        denominator = self.sample_rate * self.channels * self.sample_width
        return 0.0 if denominator <= 0 else len(self.pcm) * 1000 / denominator


@dataclass(slots=True, frozen=True)
class TranscriptHypothesis:
    text: str
    language: str
    confidence: float
    is_final: bool
    started_at_ms: int | None = None
    ended_at_ms: int | None = None
    words: tuple[dict[str, Any], ...] = ()


@dataclass(slots=True, frozen=True)
class AudioChunk:
    audio: bytes
    sequence: int
    mime_type: str
    sample_rate: int
    is_final: bool = False


@dataclass(slots=True)
class VoiceEvent:
    type: EventType
    session_id: str
    payload: dict[str, Any] = field(default_factory=dict)
    timestamp_ms: int = 0

    def to_dict(self) -> dict[str, Any]:
        value = asdict(self)
        value["type"] = self.type.value
        return value


MessageRole = Literal["system", "user", "assistant", "tool"]


@dataclass(slots=True, frozen=True)
class ConversationMessage:
    role: MessageRole
    content: str
    created_at_ms: int
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True, frozen=True)
class ToolResult:
    name: str
    ok: bool
    content: dict[str, Any]
    latency_ms: float
    error: str | None = None


class VoiceRuntimeError(RuntimeError):
    def __init__(self, code: str, message: str, *, retryable: bool = False):
        super().__init__(message)
        self.code = code
        self.retryable = retryable
