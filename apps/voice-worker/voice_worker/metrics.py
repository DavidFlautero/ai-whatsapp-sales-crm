from __future__ import annotations

import asyncio
import time
from collections import defaultdict
from contextlib import asynccontextmanager
from dataclasses import dataclass
from dataclasses import field
from typing import AsyncIterator


@dataclass(slots=True)
class MetricsRegistry:
    counters: dict[str, float] = field(
        default_factory=lambda: defaultdict(float)
    )
    gauges: dict[str, float] = field(
        default_factory=lambda: defaultdict(float)
    )
    sums: dict[str, float] = field(
        default_factory=lambda: defaultdict(float)
    )
    observations: dict[str, int] = field(
        default_factory=lambda: defaultdict(int)
    )
    lock: asyncio.Lock = field(
        default_factory=asyncio.Lock
    )

    async def increment(
        self,
        name: str,
        amount: float = 1,
    ) -> None:
        async with self.lock:
            self.counters[name] += amount

    async def set_gauge(
        self,
        name: str,
        value: float,
    ) -> None:
        async with self.lock:
            self.gauges[name] = value

    async def observe(
        self,
        name: str,
        value: float,
    ) -> None:
        async with self.lock:
            self.sums[name] += value
            self.observations[name] += 1

    @asynccontextmanager
    async def timer(
        self,
        name: str,
    ) -> AsyncIterator[None]:
        started = time.perf_counter()

        try:
            yield
        finally:
            await self.observe(
                name,
                time.perf_counter() - started,
            )

    async def render_prometheus(
        self,
    ) -> str:
        async with self.lock:
            lines: list[str] = []

            for name, value in sorted(
                self.counters.items()
            ):
                lines.append(
                    f"voice_{name}_total {value}"
                )

            for name, value in sorted(
                self.gauges.items()
            ):
                lines.append(
                    f"voice_{name} {value}"
                )

            for name, value in sorted(
                self.sums.items()
            ):
                lines.append(
                    f"voice_{name}_seconds_sum {value}"
                )
                lines.append(
                    f"voice_{name}_seconds_count "
                    f"{self.observations[name]}"
                )

            return "\n".join(lines) + "\n"


metrics = MetricsRegistry()
