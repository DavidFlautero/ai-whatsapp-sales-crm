from __future__ import annotations

import contextvars
import json
import logging
import math
import time
from collections import defaultdict, deque
from contextlib import contextmanager
from dataclasses import dataclass
from threading import Lock
from typing import Iterator


session_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("voice_session_id", default="-")
company_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("voice_company_id", default="-")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": round(time.time(), 3),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "session_id": session_id_var.get(),
            "company_id": company_id_var.get(),
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        extra = getattr(record, "voice_extra", None)
        if isinstance(extra, dict):
            payload.update(extra)
        return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def configure_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level.upper())


@dataclass(slots=True, frozen=True)
class HistogramSummary:
    count: int
    minimum: float
    maximum: float
    average: float
    p50: float
    p95: float


class RuntimeMetrics:
    """Small in-process metrics backend with bounded memory."""

    def __init__(self, max_samples: int = 2_000) -> None:
        self._max_samples = max_samples
        self._counters: dict[str, int] = defaultdict(int)
        self._gauges: dict[str, float] = {}
        self._histograms: dict[str, deque[float]] = defaultdict(lambda: deque(maxlen=max_samples))
        self._lock = Lock()

    def increment(self, name: str, amount: int = 1) -> None:
        with self._lock:
            self._counters[name] += amount

    def gauge(self, name: str, value: float) -> None:
        with self._lock:
            self._gauges[name] = value

    def observe(self, name: str, value: float) -> None:
        if math.isfinite(value):
            with self._lock:
                self._histograms[name].append(value)

    @contextmanager
    def timer(self, name: str) -> Iterator[None]:
        started = time.perf_counter()
        try:
            yield
        finally:
            self.observe(name, (time.perf_counter() - started) * 1000)

    @staticmethod
    def _percentile(values: list[float], ratio: float) -> float:
        if not values:
            return 0.0
        index = min(len(values) - 1, max(0, round((len(values) - 1) * ratio)))
        return values[index]

    def snapshot(self) -> dict[str, object]:
        with self._lock:
            counters = dict(self._counters)
            gauges = dict(self._gauges)
            samples = {name: list(values) for name, values in self._histograms.items()}
        histograms: dict[str, dict[str, float | int]] = {}
        for name, values in samples.items():
            ordered = sorted(values)
            if not ordered:
                continue
            summary = HistogramSummary(
                count=len(ordered),
                minimum=ordered[0],
                maximum=ordered[-1],
                average=sum(ordered) / len(ordered),
                p50=self._percentile(ordered, 0.50),
                p95=self._percentile(ordered, 0.95),
            )
            histograms[name] = {
                "count": summary.count,
                "min": round(summary.minimum, 3),
                "max": round(summary.maximum, 3),
                "avg": round(summary.average, 3),
                "p50": round(summary.p50, 3),
                "p95": round(summary.p95, 3),
            }
        return {"counters": counters, "gauges": gauges, "histograms": histograms}


metrics = RuntimeMetrics()
