from __future__ import annotations

import asyncio
import json
import sqlite3
import time
import uuid
from pathlib import Path
from typing import Any

import httpx


class CRMOutbox:
    """At-least-once CRM delivery with exponential retry and tenant headers."""

    def __init__(
        self,
        database: str | Path,
        *,
        base_url: str,
        token: str = "",
        batch_size: int = 20,
    ) -> None:
        self.database = Path(database)
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.batch_size = min(100, max(1, batch_size))
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
                create table if not exists crm_voice_outbox (
                    id text primary key,
                    company_id text not null,
                    event_type text not null,
                    payload_json text not null,
                    created_at_ms integer not null,
                    next_attempt_ms integer not null,
                    attempts integer not null default 0,
                    delivered_at_ms integer,
                    last_error text
                )
                """
            )
            connection.execute(
                "create index if not exists idx_crm_voice_outbox_pending on crm_voice_outbox(delivered_at_ms, next_attempt_ms)"
            )

    async def enqueue(self, company_id: str, event_type: str, payload: dict[str, Any]) -> str:
        await self.initialize()
        event_id = str(uuid.uuid4())
        now = time.time_ns() // 1_000_000
        encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        async with self._lock:
            await asyncio.to_thread(self._enqueue_sync, event_id, company_id, event_type, encoded, now)
        return event_id

    def _enqueue_sync(self, event_id: str, company_id: str, event_type: str, payload: str, now: int) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                insert into crm_voice_outbox (
                    id, company_id, event_type, payload_json,
                    created_at_ms, next_attempt_ms
                ) values (?, ?, ?, ?, ?, ?)
                """,
                (event_id, company_id, event_type, payload, now, now),
            )

    async def flush_once(self) -> dict[str, int]:
        await self.initialize()
        now = time.time_ns() // 1_000_000
        async with self._lock:
            rows = await asyncio.to_thread(self._pending_sync, now)
        delivered = failed = 0
        for row in rows:
            try:
                await self._deliver(row)
                async with self._lock:
                    await asyncio.to_thread(self._mark_delivered_sync, row["id"])
                delivered += 1
            except Exception as exc:
                async with self._lock:
                    await asyncio.to_thread(
                        self._mark_failed_sync,
                        row["id"],
                        int(row["attempts"]),
                        f"{type(exc).__name__}: {exc}"[:500],
                    )
                failed += 1
        return {"selected": len(rows), "delivered": delivered, "failed": failed}

    def _pending_sync(self, now: int) -> list[sqlite3.Row]:
        with self._connect() as connection:
            return connection.execute(
                """
                select * from crm_voice_outbox
                where delivered_at_ms is null and next_attempt_ms<=?
                order by created_at_ms limit ?
                """,
                (now, self.batch_size),
            ).fetchall()

    async def _deliver(self, row: sqlite3.Row) -> None:
        if not self.base_url:
            raise RuntimeError("VOICE_INTERNAL_API_URL no está configurada.")
        headers = {
            "content-type": "application/json",
            "x-company-id": row["company_id"],
            "x-idempotency-key": row["id"],
        }
        if self.token:
            headers["authorization"] = f"Bearer {self.token}"
        body = {
            "event_id": row["id"],
            "event_type": row["event_type"],
            "payload": json.loads(row["payload_json"]),
        }
        async with httpx.AsyncClient(timeout=httpx.Timeout(8, connect=3)) as client:
            response = await client.post(f"{self.base_url}/internal/voice/events", headers=headers, json=body)
        if response.status_code == 404:
            raise RuntimeError("El CRM todavía no expone POST /internal/voice/events.")
        response.raise_for_status()

    def _mark_delivered_sync(self, event_id: str) -> None:
        now = time.time_ns() // 1_000_000
        with self._connect() as connection:
            connection.execute(
                "update crm_voice_outbox set delivered_at_ms=?, last_error=null where id=?",
                (now, event_id),
            )

    def _mark_failed_sync(self, event_id: str, attempts: int, error: str) -> None:
        now = time.time_ns() // 1_000_000
        next_attempt = now + min(300_000, 1_000 * (2 ** min(8, attempts)))
        with self._connect() as connection:
            connection.execute(
                """
                update crm_voice_outbox
                set attempts=attempts+1, next_attempt_ms=?, last_error=?
                where id=?
                """,
                (next_attempt, error, event_id),
            )

    async def stats(self) -> dict[str, int]:
        await self.initialize()
        async with self._lock:
            return await asyncio.to_thread(self._stats_sync)

    def _stats_sync(self) -> dict[str, int]:
        with self._connect() as connection:
            row = connection.execute(
                """
                select count(*) total,
                       sum(case when delivered_at_ms is null then 1 else 0 end) pending,
                       sum(case when delivered_at_ms is not null then 1 else 0 end) delivered
                from crm_voice_outbox
                """
            ).fetchone()
            return {"total": row["total"] or 0, "pending": row["pending"] or 0, "delivered": row["delivered"] or 0}
