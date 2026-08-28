from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable

from .contracts import EventType, VoiceEvent
from .registry import ActiveSessionRegistry
from .storage import VoiceSqliteStore
from .telemetry import metrics


logger = logging.getLogger(__name__)
EventEmitter = Callable[[VoiceEvent], Awaitable[None]]


class DurableEventBus:
    """Persists metadata before delivery while never persisting raw generated audio."""

    def __init__(
        self,
        *,
        company_id: str,
        store: VoiceSqliteStore,
        registry: ActiveSessionRegistry,
        downstream: EventEmitter,
    ) -> None:
        self.company_id = company_id
        self.store = store
        self.registry = registry
        self.downstream = downstream

    async def emit(self, event: VoiceEvent) -> None:
        if event.type == EventType.STATE:
            state = str(event.payload.get("current") or "unknown")
            await self.registry.update_state(event.session_id, state)
        try:
            await self.store.append_event(self.company_id, event)
        except Exception:
            metrics.increment("event_persistence_failures")
            logger.exception("voice_event_persistence_failed")
        try:
            await self.downstream(event)
        except Exception:
            metrics.increment("event_delivery_failures")
            raise


class FanoutEventEmitter:
    def __init__(self, *emitters: EventEmitter) -> None:
        self.emitters = tuple(emitters)

    async def __call__(self, event: VoiceEvent) -> None:
        results = await asyncio.gather(
            *(emitter(event) for emitter in self.emitters),
            return_exceptions=True,
        )
        failures = [result for result in results if isinstance(result, Exception)]
        if failures:
            raise RuntimeError(f"Fallaron {len(failures)} destinos de eventos.") from failures[0]
