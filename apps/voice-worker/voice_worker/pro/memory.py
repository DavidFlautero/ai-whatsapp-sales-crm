from __future__ import annotations

import asyncio
import time
from collections import OrderedDict
from dataclasses import dataclass, field
from typing import Any

from .contracts import ConversationMessage


def now_ms() -> int:
    return time.time_ns() // 1_000_000


@dataclass(slots=True)
class ConversationMemory:
    session_id: str
    company_id: str
    contact_phone: str | None = None
    language: str = "es"
    customer: dict[str, Any] = field(default_factory=dict)
    commerce: dict[str, Any] = field(default_factory=dict)
    messages: list[ConversationMessage] = field(default_factory=list)
    summary: str = ""
    created_at_ms: int = field(default_factory=now_ms)
    updated_at_ms: int = field(default_factory=now_ms)

    def add(self, role: str, content: str, **metadata: Any) -> None:
        cleaned = " ".join(content.split()).strip()
        if not cleaned:
            return
        self.messages.append(
            ConversationMessage(
                role=role,  # type: ignore[arg-type]
                content=cleaned,
                created_at_ms=now_ms(),
                metadata=metadata,
            )
        )
        self.updated_at_ms = now_ms()

    def trim(self, maximum: int) -> None:
        if len(self.messages) <= maximum:
            return
        system = [message for message in self.messages if message.role == "system"][:1]
        tail_count = max(1, maximum - len(system))
        self.messages = system + self.messages[-tail_count:]

    def anthropic_messages(self) -> list[dict[str, str]]:
        result: list[dict[str, str]] = []
        for message in self.messages:
            if message.role not in {"user", "assistant"}:
                continue
            if result and result[-1]["role"] == message.role:
                result[-1]["content"] += "\n" + message.content
            else:
                result.append({"role": message.role, "content": message.content})
        return result


class SessionMemoryStore:
    def __init__(self, *, ttl_seconds: int = 3600, max_sessions: int = 1_000, max_messages: int = 40) -> None:
        self.ttl_ms = ttl_seconds * 1000
        self.max_sessions = max_sessions
        self.max_messages = max_messages
        self._sessions: OrderedDict[str, ConversationMemory] = OrderedDict()
        self._lock = asyncio.Lock()

    async def get_or_create(
        self,
        session_id: str,
        company_id: str,
        *,
        contact_phone: str | None = None,
        language: str = "es",
    ) -> ConversationMemory:
        async with self._lock:
            self._purge_expired_locked()
            memory = self._sessions.get(session_id)
            if memory is None:
                memory = ConversationMemory(
                    session_id=session_id,
                    company_id=company_id,
                    contact_phone=contact_phone,
                    language=language,
                )
                self._sessions[session_id] = memory
            elif memory.company_id != company_id:
                raise PermissionError("La sesión pertenece a otra empresa.")
            self._sessions.move_to_end(session_id)
            while len(self._sessions) > self.max_sessions:
                self._sessions.popitem(last=False)
            return memory

    async def append(self, session_id: str, role: str, content: str, **metadata: Any) -> None:
        async with self._lock:
            memory = self._sessions[session_id]
            memory.add(role, content, **metadata)
            memory.trim(self.max_messages)
            self._sessions.move_to_end(session_id)

    async def delete(self, session_id: str) -> None:
        async with self._lock:
            self._sessions.pop(session_id, None)

    async def snapshot(self) -> dict[str, object]:
        async with self._lock:
            self._purge_expired_locked()
            return {
                "sessions": len(self._sessions),
                "oldest_updated_at_ms": min((value.updated_at_ms for value in self._sessions.values()), default=None),
            }

    def _purge_expired_locked(self) -> None:
        cutoff = now_ms() - self.ttl_ms
        expired = [key for key, value in self._sessions.items() if value.updated_at_ms < cutoff]
        for key in expired:
            self._sessions.pop(key, None)
