from __future__ import annotations

import asyncio
import json
import sqlite3
import time
from pathlib import Path
from typing import Any

from .contracts import EventType, VoiceEvent


def _now_ms() -> int:
    return time.time_ns() // 1_000_000


class VoiceSqliteStore:
    """Durable, tenant-scoped event store for the canary voice runtime."""

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self._lock = asyncio.Lock()
        self._initialized = False

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=8.0)
        connection.row_factory = sqlite3.Row
        connection.execute("pragma journal_mode = wal")
        connection.execute("pragma synchronous = normal")
        connection.execute("pragma foreign_keys = on")
        connection.execute("pragma busy_timeout = 8000")
        return connection

    async def initialize(self) -> None:
        async with self._lock:
            if self._initialized:
                return
            self.path.parent.mkdir(parents=True, exist_ok=True)
            await asyncio.to_thread(self._initialize_sync)
            self._initialized = True

    def _initialize_sync(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                create table if not exists voice_sessions (
                    id text primary key,
                    company_id text not null,
                    contact_phone text,
                    status text not null,
                    language text,
                    started_at_ms integer not null,
                    updated_at_ms integer not null,
                    ended_at_ms integer,
                    close_reason text,
                    metadata_json text not null default '{}'
                );
                create index if not exists idx_voice_sessions_company_updated
                    on voice_sessions(company_id, updated_at_ms desc);

                create table if not exists voice_events (
                    id integer primary key autoincrement,
                    session_id text not null references voice_sessions(id) on delete cascade,
                    company_id text not null,
                    event_type text not null,
                    timestamp_ms integer not null,
                    payload_json text not null,
                    created_at_ms integer not null
                );
                create index if not exists idx_voice_events_session
                    on voice_events(session_id, id);

                create table if not exists voice_transcripts (
                    id integer primary key autoincrement,
                    session_id text not null references voice_sessions(id) on delete cascade,
                    company_id text not null,
                    speaker text not null,
                    text text not null,
                    language text,
                    confidence real,
                    timestamp_ms integer not null
                );
                create index if not exists idx_voice_transcripts_session
                    on voice_transcripts(session_id, id);
                """
            )

    async def start_session(
        self,
        session_id: str,
        company_id: str,
        *,
        contact_phone: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        await self.initialize()
        now = _now_ms()
        async with self._lock:
            await asyncio.to_thread(
                self._start_session_sync,
                session_id,
                company_id,
                contact_phone,
                now,
                json.dumps(metadata or {}, ensure_ascii=False, separators=(",", ":")),
            )

    def _start_session_sync(
        self,
        session_id: str,
        company_id: str,
        contact_phone: str | None,
        now: int,
        metadata_json: str,
    ) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                insert into voice_sessions (
                    id, company_id, contact_phone, status,
                    started_at_ms, updated_at_ms, metadata_json
                ) values (?, ?, ?, 'connecting', ?, ?, ?)
                on conflict(id) do update set
                    updated_at_ms = excluded.updated_at_ms,
                    contact_phone = coalesce(excluded.contact_phone, voice_sessions.contact_phone)
                where voice_sessions.company_id = excluded.company_id
                """,
                (session_id, company_id, contact_phone, now, now, metadata_json),
            )

    async def append_event(self, company_id: str, event: VoiceEvent) -> None:
        await self.initialize()
        payload = self._sanitized_payload(event.payload)
        async with self._lock:
            await asyncio.to_thread(
                self._append_event_sync,
                company_id,
                event,
                json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
            )

    @staticmethod
    def _sanitized_payload(payload: dict[str, Any]) -> dict[str, Any]:
        clean = dict(payload)
        audio = clean.pop("audio_base64", None)
        if isinstance(audio, str):
            clean["audio_bytes"] = len(audio) * 3 // 4
        return clean

    def _append_event_sync(self, company_id: str, event: VoiceEvent, payload_json: str) -> None:
        timestamp = event.timestamp_ms or _now_ms()
        current_state = event.payload.get("current") if event.type == EventType.STATE else None
        with self._connect() as connection:
            exists = connection.execute(
                "select 1 from voice_sessions where id = ? and company_id = ?",
                (event.session_id, company_id),
            ).fetchone()
            if not exists:
                raise LookupError("La sesión no existe o pertenece a otra empresa.")
            connection.execute(
                """
                insert into voice_events (
                    session_id, company_id, event_type,
                    timestamp_ms, payload_json, created_at_ms
                ) values (?, ?, ?, ?, ?, ?)
                """,
                (event.session_id, company_id, event.type.value, timestamp, payload_json, _now_ms()),
            )
            if current_state:
                connection.execute(
                    "update voice_sessions set status = ?, updated_at_ms = ? where id = ? and company_id = ?",
                    (str(current_state), timestamp, event.session_id, company_id),
                )
            if event.type == EventType.TRANSCRIPT_FINAL:
                text = str(event.payload.get("text") or "").strip()
                if text:
                    connection.execute(
                        """
                        insert into voice_transcripts (
                            session_id, company_id, speaker, text,
                            language, confidence, timestamp_ms
                        ) values (?, ?, 'customer', ?, ?, ?, ?)
                        """,
                        (
                            event.session_id,
                            company_id,
                            text,
                            event.payload.get("language"),
                            event.payload.get("confidence"),
                            timestamp,
                        ),
                    )

    async def close_session(self, company_id: str, session_id: str, reason: str) -> None:
        await self.initialize()
        now = _now_ms()
        async with self._lock:
            await asyncio.to_thread(self._close_session_sync, company_id, session_id, reason, now)

    def _close_session_sync(self, company_id: str, session_id: str, reason: str, now: int) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                update voice_sessions
                set status = 'closed', updated_at_ms = ?, ended_at_ms = ?, close_reason = ?
                where id = ? and company_id = ?
                """,
                (now, now, reason[:200], session_id, company_id),
            )

    async def session_detail(self, company_id: str, session_id: str) -> dict[str, Any] | None:
        await self.initialize()
        async with self._lock:
            return await asyncio.to_thread(self._session_detail_sync, company_id, session_id)

    def _session_detail_sync(self, company_id: str, session_id: str) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                "select * from voice_sessions where id = ? and company_id = ?",
                (session_id, company_id),
            ).fetchone()
            if row is None:
                return None
            events = connection.execute(
                "select event_type, timestamp_ms, payload_json from voice_events where session_id = ? order by id",
                (session_id,),
            ).fetchall()
            result = dict(row)
            result["metadata"] = json.loads(result.pop("metadata_json"))
            result["events"] = [
                {
                    "type": event["event_type"],
                    "timestamp_ms": event["timestamp_ms"],
                    "payload": json.loads(event["payload_json"]),
                }
                for event in events
            ]
            return result

    async def list_sessions(self, company_id: str, *, limit: int = 50) -> list[dict[str, Any]]:
        await self.initialize()
        safe_limit = min(200, max(1, int(limit)))
        async with self._lock:
            return await asyncio.to_thread(self._list_sessions_sync, company_id, safe_limit)

    def _list_sessions_sync(self, company_id: str, limit: int) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                select id, company_id, contact_phone, status, language,
                       started_at_ms, updated_at_ms, ended_at_ms, close_reason
                from voice_sessions where company_id = ?
                order by updated_at_ms desc limit ?
                """,
                (company_id, limit),
            ).fetchall()
            return [dict(row) for row in rows]

    async def stats(self) -> dict[str, Any]:
        await self.initialize()
        async with self._lock:
            return await asyncio.to_thread(self._stats_sync)

    def _stats_sync(self) -> dict[str, Any]:
        with self._connect() as connection:
            sessions = connection.execute("select count(*) from voice_sessions").fetchone()[0]
            active = connection.execute(
                "select count(*) from voice_sessions where status not in ('closed', 'failed')"
            ).fetchone()[0]
            events = connection.execute("select count(*) from voice_events").fetchone()[0]
            return {
                "sessions": sessions,
                "active": active,
                "events": events,
                "database_bytes": self.path.stat().st_size if self.path.exists() else 0,
            }
