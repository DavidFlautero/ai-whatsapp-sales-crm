from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from dataclasses import field
from typing import Any

from .advanced_config import AdvancedSettings
from .turn_detector import StreamingTurnDetector
from .turn_detector import TurnUpdate


@dataclass(slots=True)
class AdvancedVoiceSession:
    company_id: str
    call_id: str
    language: str
    settings: AdvancedSettings
    created_at: float = field(
        default_factory=time.monotonic
    )
    last_seen_at: float = field(
        default_factory=time.monotonic
    )
    sequence: int = 0
    closed: bool = False
    history: list[dict[str, Any]] = field(
        default_factory=list
    )
    active_generation: asyncio.Task[None] | None = None
    detector: StreamingTurnDetector = field(
        init=False
    )

    def __post_init__(self) -> None:
        self.detector = StreamingTurnDetector(
            self.settings
        )

    def touch(self) -> None:
        self.last_seen_at = time.monotonic()

    def idle_for(self) -> float:
        return (
            time.monotonic()
            - self.last_seen_at
        )

    def feed_audio(
        self,
        chunk: bytes,
    ) -> list[TurnUpdate]:
        if self.closed:
            return []

        self.touch()

        return self.detector.feed(chunk)

    def next_sequence(self) -> int:
        self.sequence += 1

        return self.sequence

    def append_history(
        self,
        role: str,
        content: str,
    ) -> None:
        content = content.strip()

        if not content:
            return

        self.history.append(
            {
                "role": role,
                "content": content,
            }
        )

        if len(self.history) > 16:
            self.history[:] = self.history[-16:]

    async def cancel_generation(
        self,
    ) -> bool:
        task = self.active_generation

        if task is None or task.done():
            return False

        task.cancel()

        try:
            await task
        except asyncio.CancelledError:
            pass
        finally:
            self.active_generation = None
            self.detector.set_assistant_speaking(
                False
            )

        return True

    async def close(self) -> None:
        self.closed = True
        await self.cancel_generation()
        self.detector.reset()
        self.history.clear()
