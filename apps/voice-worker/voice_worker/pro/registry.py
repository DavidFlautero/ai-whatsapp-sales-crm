from __future__ import annotations

import asyncio
import time
from dataclasses import asdict, dataclass
from typing import Any


@dataclass(slots=True)
class ActiveVoiceSession:
    session_id: str
    company_id: str
    contact_phone: str | None
    state: str
    connected_at_ms: int
    updated_at_ms: int


class SessionCapacityError(RuntimeError):
    pass


class ActiveSessionRegistry:
    def __init__(self, *, max_total: int = 100, max_per_company: int = 20) -> None:
        if max_total < 1 or max_per_company < 1:
            raise ValueError("Los límites de sesiones deben ser positivos.")
        self.max_total = max_total
        self.max_per_company = min(max_total, max_per_company)
        self._sessions: dict[str, ActiveVoiceSession] = {}
        self._draining = False
        self._condition = asyncio.Condition()

    async def register(
        self,
        session_id: str,
        company_id: str,
        contact_phone: str | None = None,
    ) -> ActiveVoiceSession:
        now = time.time_ns() // 1_000_000
        async with self._condition:
            if self._draining:
                raise SessionCapacityError("El runtime está drenando llamadas.")
            if session_id in self._sessions:
                raise SessionCapacityError("La sesión ya está conectada.")
            company_count = sum(1 for item in self._sessions.values() if item.company_id == company_id)
            if len(self._sessions) >= self.max_total:
                raise SessionCapacityError("Se alcanzó la capacidad total de llamadas.")
            if company_count >= self.max_per_company:
                raise SessionCapacityError("La empresa alcanzó su capacidad de llamadas.")
            item = ActiveVoiceSession(
                session_id=session_id,
                company_id=company_id,
                contact_phone=contact_phone,
                state="connecting",
                connected_at_ms=now,
                updated_at_ms=now,
            )
            self._sessions[session_id] = item
            self._condition.notify_all()
            return item

    async def update_state(self, session_id: str, state: str) -> None:
        async with self._condition:
            item = self._sessions.get(session_id)
            if item is not None:
                item.state = state
                item.updated_at_ms = time.time_ns() // 1_000_000
                self._condition.notify_all()

    async def unregister(self, session_id: str) -> ActiveVoiceSession | None:
        async with self._condition:
            item = self._sessions.pop(session_id, None)
            self._condition.notify_all()
            return item

    async def begin_drain(self) -> None:
        async with self._condition:
            self._draining = True
            self._condition.notify_all()

    async def wait_empty(self, timeout_seconds: float = 20.0) -> bool:
        async with self._condition:
            if not self._sessions:
                return True
            try:
                await asyncio.wait_for(
                    self._condition.wait_for(lambda: not self._sessions),
                    timeout=timeout_seconds,
                )
                return True
            except TimeoutError:
                return False

    async def snapshot(self, company_id: str | None = None) -> dict[str, Any]:
        async with self._condition:
            values = [
                asdict(item)
                for item in self._sessions.values()
                if company_id is None or item.company_id == company_id
            ]
            values.sort(key=lambda item: item["connected_at_ms"])
            return {
                "draining": self._draining,
                "active": len(values),
                "capacity": self.max_total,
                "per_company_capacity": self.max_per_company,
                "sessions": values,
            }
