"""Professional real-time voice runtime.

This package is intentionally isolated from the legacy demo pipeline.  It can be
compiled and tested before it is mounted in the production FastAPI process.
"""

from .config import ProVoiceConfig
from .contracts import AudioFrame, TranscriptHypothesis, VoiceEvent

__all__ = [
    "AudioFrame",
    "ProVoiceConfig",
    "TranscriptHypothesis",
    "VoiceEvent",
]
