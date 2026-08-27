from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass


StopCallback = Callable[[int], Awaitable[None]]


@dataclass(slots=True, frozen=True)
class PlaybackLease:
    generation: int


class PlaybackController:
    """Owns one playback generation and makes stale audio impossible to emit."""

    def __init__(self, on_stop: StopCallback | None = None) -> None:
        self._generation = 0
        self._task: asyncio.Task[None] | None = None
        self._lock = asyncio.Lock()
        self._on_stop = on_stop

    @property
    def speaking(self) -> bool:
        return self._task is not None and not self._task.done()

    async def acquire(self) -> PlaybackLease:
        async with self._lock:
            await self._cancel_locked()
            self._generation += 1
            return PlaybackLease(self._generation)

    def is_current(self, lease: PlaybackLease) -> bool:
        return lease.generation == self._generation

    async def attach(self, lease: PlaybackLease, task: asyncio.Task[None]) -> None:
        async with self._lock:
            if not self.is_current(lease):
                task.cancel()
                return
            self._task = task

    async def interrupt(self) -> bool:
        async with self._lock:
            had_active = self.speaking
            await self._cancel_locked()
            self._generation += 1
            generation = self._generation
        if had_active and self._on_stop is not None:
            await self._on_stop(generation)
        return had_active

    async def _cancel_locked(self) -> None:
        task = self._task
        self._task = None
        if task is None or task.done() or task is asyncio.current_task():
            return
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    async def close(self) -> None:
        await self.interrupt()
