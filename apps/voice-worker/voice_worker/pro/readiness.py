from __future__ import annotations

import asyncio
import inspect
import time
from collections.abc import Awaitable, Callable
from dataclasses import asdict, dataclass
from typing import Any


Probe = Callable[[], bool | dict[str, Any] | Awaitable[bool | dict[str, Any]]]


@dataclass(slots=True, frozen=True)
class ProbeResult:
    name: str
    ok: bool
    required: bool
    latency_ms: float
    detail: dict[str, Any]


class ReadinessMonitor:
    def __init__(self, *, cache_seconds: float = 1.0) -> None:
        self.cache_seconds = max(0.0, cache_seconds)
        self._probes: dict[str, tuple[Probe, bool]] = {}
        self._cache: tuple[float, dict[str, Any]] | None = None
        self._lock = asyncio.Lock()

    def add(self, name: str, probe: Probe, *, required: bool = True) -> None:
        if not name or name in self._probes:
            raise ValueError(f"Probe inválido o duplicado: {name!r}")
        self._probes[name] = (probe, required)
        self._cache = None

    async def check(self, *, force: bool = False) -> dict[str, Any]:
        now = time.monotonic()
        async with self._lock:
            if not force and self._cache and now - self._cache[0] <= self.cache_seconds:
                return self._cache[1]
            results = await asyncio.gather(
                *(self._run(name, probe, required) for name, (probe, required) in self._probes.items())
            )
            ready = all(item.ok for item in results if item.required)
            report = {
                "ready": ready,
                "checked_at_ms": time.time_ns() // 1_000_000,
                "components": {item.name: asdict(item) for item in results},
            }
            self._cache = (now, report)
            return report

    async def _run(self, name: str, probe: Probe, required: bool) -> ProbeResult:
        started = time.perf_counter()
        try:
            value = probe()
            if inspect.isawaitable(value):
                value = await value
            if isinstance(value, dict):
                detail = dict(value)
                ok = bool(detail.pop("ok", True))
            else:
                ok = bool(value)
                detail = {}
        except Exception as exc:
            ok = False
            detail = {"error": f"{type(exc).__name__}: {exc}"}
        return ProbeResult(
            name=name,
            ok=ok,
            required=required,
            latency_ms=round((time.perf_counter() - started) * 1000, 3),
            detail=detail,
        )
