from __future__ import annotations

import asyncio
import json
import sqlite3
import time
import uuid
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


@dataclass(slots=True, frozen=True)
class TelephonyContext:
    session_id: str
    company_id: str
    contact_phone: str | None
    direction: str
    recording_enabled: bool
    recording_consent: str
    metadata: dict[str, Any]
    expires_at_ms: int


class TelephonyContextStore:
    def __init__(self, database: str | Path) -> None:
        self.database = Path(database)
        self._lock = asyncio.Lock()
        self._initialized = False

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database, timeout=8)
        connection.row_factory = sqlite3.Row
        connection.execute("pragma journal_mode=wal")
        connection.execute("pragma busy_timeout=8000")
        return connection

    async def initialize(self) -> None:
        async with self._lock:
            if self._initialized:
                return
            self.database.parent.mkdir(parents=True, exist_ok=True)
            await asyncio.to_thread(self._initialize_sync)
            self._initialized = True

    def _initialize_sync(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                create table if not exists telephony_contexts (
                    session_id text primary key,
                    company_id text not null,
                    contact_phone text,
                    direction text not null,
                    recording_enabled integer not null,
                    recording_consent text not null,
                    metadata_json text not null,
                    expires_at_ms integer not null,
                    consumed_at_ms integer
                )
                """
            )

    async def put(self, context: TelephonyContext) -> None:
        uuid.UUID(context.session_id)
        if context.direction not in {"inbound", "outbound"}:
            raise ValueError("direction debe ser inbound u outbound.")
        await self.initialize()
        async with self._lock:
            await asyncio.to_thread(self._put_sync, context)

    def _put_sync(self, context: TelephonyContext) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                insert into telephony_contexts (
                    session_id, company_id, contact_phone, direction,
                    recording_enabled, recording_consent,
                    metadata_json, expires_at_ms, consumed_at_ms
                ) values (?, ?, ?, ?, ?, ?, ?, ?, null)
                on conflict(session_id) do update set
                    company_id=excluded.company_id,
                    contact_phone=excluded.contact_phone,
                    direction=excluded.direction,
                    recording_enabled=excluded.recording_enabled,
                    recording_consent=excluded.recording_consent,
                    metadata_json=excluded.metadata_json,
                    expires_at_ms=excluded.expires_at_ms,
                    consumed_at_ms=null
                """,
                (
                    context.session_id,
                    context.company_id,
                    context.contact_phone,
                    context.direction,
                    int(context.recording_enabled),
                    context.recording_consent,
                    json.dumps(context.metadata, ensure_ascii=False, separators=(",", ":")),
                    context.expires_at_ms,
                ),
            )

    async def consume(self, session_id: str) -> TelephonyContext | None:
        uuid.UUID(session_id)
        await self.initialize()
        async with self._lock:
            return await asyncio.to_thread(self._consume_sync, session_id)

    def _consume_sync(self, session_id: str) -> TelephonyContext | None:
        now = time.time_ns() // 1_000_000
        with self._connect() as connection:
            row = connection.execute(
                """
                select * from telephony_contexts
                where session_id=? and expires_at_ms>=? and consumed_at_ms is null
                """,
                (session_id, now),
            ).fetchone()
            if row is None:
                return None
            connection.execute(
                "update telephony_contexts set consumed_at_ms=? where session_id=?",
                (now, session_id),
            )
            return TelephonyContext(
                session_id=row["session_id"],
                company_id=row["company_id"],
                contact_phone=row["contact_phone"],
                direction=row["direction"],
                recording_enabled=bool(row["recording_enabled"]),
                recording_consent=row["recording_consent"],
                metadata=json.loads(row["metadata_json"]),
                expires_at_ms=row["expires_at_ms"],
            )

    async def create(
        self,
        *,
        company_id: str,
        contact_phone: str | None,
        direction: str,
        recording_enabled: bool,
        recording_consent: str,
        metadata: dict[str, Any] | None = None,
        ttl_seconds: int = 300,
    ) -> TelephonyContext:
        now = time.time_ns() // 1_000_000
        context = TelephonyContext(
            session_id=str(uuid.uuid4()),
            company_id=company_id.strip(),
            contact_phone=contact_phone,
            direction=direction,
            recording_enabled=recording_enabled,
            recording_consent=recording_consent.strip()[:500],
            metadata=metadata or {},
            expires_at_ms=now + min(3600, max(30, ttl_seconds)) * 1000,
        )
        if not context.company_id or len(context.company_id) > 80:
            raise ValueError("company_id inválido.")
        if recording_enabled and len(context.recording_consent) < 10:
            raise ValueError("La grabación requiere una base de consentimiento.")
        await self.put(context)
        return context

    @staticmethod
    def public(context: TelephonyContext) -> dict[str, Any]:
        value = asdict(context)
        value.pop("recording_consent", None)
        return value
