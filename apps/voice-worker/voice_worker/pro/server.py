from __future__ import annotations

import asyncio
import json
import os
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Header, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from .api import ProfessionalRuntime
from .crm_outbox import CRMOutbox
from .config import ProVoiceConfig
from .contracts import AudioFrame, EventType, VoiceEvent
from .event_bus import DurableEventBus
from .meta_webrtc import MetaWebRtcError, MetaWebRtcManager
from .orchestrator import ProfessionalVoiceSession
from .profiles import VoiceProfileStore
from .readiness import ReadinessMonitor
from .registry import ActiveSessionRegistry, SessionCapacityError
from .storage import VoiceSqliteStore
from .telephony_context import TelephonyContextStore
from .telemetry import configure_logging, metrics


class EnrollmentRequest(BaseModel):
    company_id: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=2, max_length=100)
    language: str = Field(min_length=2, max_length=2)
    audio_base64: str = Field(min_length=100)
    consent_text: str = Field(min_length=20, max_length=2_000)
    consented_by: str = Field(min_length=2, max_length=120)


class TelephonyContextRequest(BaseModel):
    company_id: str = Field(min_length=1, max_length=80)
    contact_phone: str | None = Field(default=None, max_length=40)
    direction: str = Field(default="inbound", min_length=7, max_length=8)
    recording_enabled: bool = False
    recording_consent: str = Field(default="disabled", max_length=500)
    metadata: dict[str, Any] = Field(default_factory=dict)
    ttl_seconds: int = Field(default=300, ge=30, le=3600)


class MetaWebRtcOfferRequest(BaseModel):
    call_id: str = Field(min_length=1, max_length=200)
    company_id: str = Field(default="demo", min_length=1, max_length=80)
    contact_phone: str | None = Field(default=None, max_length=40)
    sdp: str = Field(min_length=20, max_length=200_000)
    sdp_type: str = Field(default="offer", pattern="^offer$")
    metadata: dict[str, Any] = Field(default_factory=dict)


class ManagedProfessionalRuntime:
    def __init__(self) -> None:
        self.config = ProVoiceConfig.from_env()
        self.voice = ProfessionalRuntime(self.config)
        self.started_at = time.monotonic()
        self.store = VoiceSqliteStore(
            os.getenv(
                "VOICE_PRO_DATABASE",
                "/opt/ventas-ia-mayorista/data/voice-pro.sqlite3",
            )
        )
        self.registry = ActiveSessionRegistry(
            max_total=int(os.getenv("VOICE_MAX_SESSIONS", "50")),
            max_per_company=int(os.getenv("VOICE_MAX_SESSIONS_PER_COMPANY", "10")),
        )
        self.profiles = VoiceProfileStore(
            os.getenv(
                "VOICE_PROFILES_DIR",
                "/opt/ventas-ia-mayorista/data/voice-profiles",
            )
        )
        self.telephony_contexts = TelephonyContextStore(self.store.path)
        self.outbox = CRMOutbox(
            self.store.path,
            base_url=os.getenv("VOICE_INTERNAL_API_URL", "http://127.0.0.1:4000"),
            token=os.getenv("VOICE_INTERNAL_API_TOKEN", ""),
        )
        self.meta_webrtc = MetaWebRtcManager(
            config=self.config,
            voice=self.voice,
            registry=self.registry,
            store=self.store,
            outbox=self.outbox,
        )
        self.readiness = ReadinessMonitor(cache_seconds=1.0)
        self._initialized = False
        self._stt_warmup_error: str | None = None
        self._stt_warmup_ms: float | None = None

    async def initialize(self) -> None:
        if self._initialized:
            return
        await self.store.initialize()
        await self.telephony_contexts.initialize()
        await self.outbox.initialize()
        self.profiles.root.mkdir(parents=True, exist_ok=True)
        self.readiness.add("sqlite", self._probe_sqlite)
        self.readiness.add("profile_storage", self._probe_profiles)
        self.readiness.add("stt", self._probe_stt, required=False)
        self.readiness.add("tts", self._probe_tts, required=False)
        self.readiness.add("webrtc", self.meta_webrtc.available, required=False)

        if self.config.stt_preload:
            await self.warmup_stt()

        self._initialized = True

    async def warmup_stt(self) -> dict[str, Any]:
        started = time.perf_counter()

        try:
            await asyncio.wait_for(
                self.voice.stt.warmup(),
                timeout=self.config.stt_warmup_timeout_seconds,
            )
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            self._stt_warmup_error = str(exc)[:300]
            metrics.increment("stt_warmup_failures")
        else:
            self._stt_warmup_error = None
            metrics.increment("stt_warmup_successes")
        finally:
            self._stt_warmup_ms = (
                time.perf_counter()
                - started
            ) * 1000

            metrics.observe(
                "stt_warmup_ms",
                self._stt_warmup_ms,
            )

        return self.stt_status()

    def stt_status(self) -> dict[str, Any]:
        status = self.voice.stt.status()

        return {
            **status,
            "mode": (
                "preloaded"
                if self.config.stt_preload
                else "lazy"
            ),
            "preload": self.config.stt_preload,
            "warmup_ms": self._stt_warmup_ms,
            "warmup_error": self._stt_warmup_error,
        }

    async def _probe_sqlite(self) -> dict[str, Any]:
        return {"ok": True, **await self.store.stats()}

    def _probe_profiles(self) -> dict[str, Any]:
        return {
            "ok": self.profiles.root.is_dir() and os.access(self.profiles.root, os.W_OK),
            "path": str(self.profiles.root),
        }

    def _probe_stt(self) -> dict[str, Any]:
        status = self.stt_status()

        return {
            "ok": bool(status["loaded"]),
            **status,
        }

    def _probe_tts(self) -> dict[str, Any]:
        if self.config.tts_provider == "chatterbox_http":
            return {"ok": bool(self.config.tts_gateway_url), "provider": "chatterbox_http"}
        model = Path(self.config.piper_model_path)
        return {
            "ok": model.is_file(),
            "provider": "piper",
            "model": str(model) if self.config.piper_model_path else None,
        }

    async def health(self) -> dict[str, Any]:
        return {
            "ok": True,
            "component": "ventas-voice-pro",
            "version": "2.0-canary",
            "uptime_seconds": round(time.monotonic() - self.started_at, 3),
            "voice": self.voice.health(),
            "active": await self.registry.snapshot(),
            "webrtc": await self.meta_webrtc.snapshot(),
        }


def _admin_guard(runtime: ManagedProfessionalRuntime, supplied: str | None) -> None:
    expected = os.getenv("VOICE_ADMIN_TOKEN", "").strip()
    if expected and supplied != expected:
        raise HTTPException(status_code=401, detail="Token administrativo inválido.")
    if runtime.config.environment == "production" and not expected:
        raise HTTPException(status_code=503, detail="VOICE_ADMIN_TOKEN no está configurado.")


def _internal_guard(request: Request, supplied: str | None) -> None:
    expected = os.getenv("VOICE_INTERNAL_API_TOKEN", "").strip()
    if expected:
        if supplied != expected:
            raise HTTPException(status_code=401, detail="Token interno inválido.")
        return
    client_host = request.client.host if request.client else ""
    if client_host not in {"127.0.0.1", "::1", "testclient"}:
        raise HTTPException(status_code=403, detail="Endpoint disponible solo localmente.")


def create_app(runtime: ManagedProfessionalRuntime | None = None) -> FastAPI:
    managed = runtime or ManagedProfessionalRuntime()
    configure_logging(os.getenv("VOICE_LOG_LEVEL", "INFO"))

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        await managed.initialize()
        yield
        await managed.meta_webrtc.close_all()
        await managed.registry.begin_drain()
        await managed.registry.wait_empty(timeout_seconds=10)

    app = FastAPI(
        title="Neuromind Professional Voice Runtime",
        version="2.0-canary",
        docs_url="/docs" if managed.config.environment != "production" else None,
        redoc_url=None,
        lifespan=lifespan,
    )
    app.state.voice_runtime = managed

    @app.get("/health")
    async def health() -> dict[str, Any]:
        return await managed.health()

    @app.get("/ready")
    async def ready() -> JSONResponse:
        report = await managed.readiness.check()
        return JSONResponse(report, status_code=200 if report["ready"] else 503)

    @app.get("/metrics")
    async def runtime_metrics() -> dict[str, Any]:
        return metrics.snapshot()

    @app.post("/internal/meta/webrtc/offer")
    async def meta_webrtc_offer(
        payload: MetaWebRtcOfferRequest,
        request: Request,
        x_voice_internal_token: str | None = Header(default=None),
    ) -> dict[str, Any]:
        _internal_guard(request, x_voice_internal_token)
        try:
            return await managed.meta_webrtc.accept_offer(
                call_id=payload.call_id,
                company_id=payload.company_id,
                contact_phone=payload.contact_phone,
                sdp=payload.sdp,
                metadata=payload.metadata,
            )
        except MetaWebRtcError as exc:
            raise HTTPException(
                status_code=exc.status_code,
                detail={"code": exc.code, "message": str(exc)},
            ) from exc

    @app.delete("/internal/meta/webrtc/{call_id}")
    async def close_meta_webrtc(
        call_id: str,
        request: Request,
        x_voice_internal_token: str | None = Header(default=None),
    ) -> dict[str, Any]:
        _internal_guard(request, x_voice_internal_token)
        closed = await managed.meta_webrtc.close(call_id, reason="api_request")
        return {"ok": True, "closed": closed, "call_id": call_id}

    @app.get("/internal/meta/webrtc/active")
    async def active_meta_webrtc(
        request: Request,
        x_voice_internal_token: str | None = Header(default=None),
    ) -> dict[str, Any]:
        _internal_guard(request, x_voice_internal_token)
        return await managed.meta_webrtc.snapshot()

    @app.get("/admin/active")
    async def active_calls(
        company_id: str | None = Query(default=None),
        x_voice_admin_token: str | None = Header(default=None),
    ) -> dict[str, Any]:
        _admin_guard(managed, x_voice_admin_token)
        return await managed.registry.snapshot(company_id)

    @app.get("/admin/stt")
    async def stt_status(
        x_voice_admin_token: str | None = Header(default=None),
    ) -> dict[str, Any]:
        _admin_guard(
            managed,
            x_voice_admin_token,
        )
        return managed.stt_status()

    @app.post("/admin/stt/warmup")
    async def warmup_stt(
        x_voice_admin_token: str | None = Header(default=None),
    ) -> dict[str, Any]:
        _admin_guard(
            managed,
            x_voice_admin_token,
        )
        return await managed.warmup_stt()

    @app.get("/admin/sessions")
    async def list_sessions(
        company_id: str = Query(min_length=1, max_length=80),
        limit: int = Query(default=50, ge=1, le=200),
        x_voice_admin_token: str | None = Header(default=None),
    ) -> list[dict[str, Any]]:
        _admin_guard(managed, x_voice_admin_token)
        return await managed.store.list_sessions(company_id, limit=limit)

    @app.get("/admin/sessions/{session_id}")
    async def session_detail(
        session_id: str,
        company_id: str = Query(min_length=1, max_length=80),
        x_voice_admin_token: str | None = Header(default=None),
    ) -> dict[str, Any]:
        _admin_guard(managed, x_voice_admin_token)
        detail = await managed.store.session_detail(company_id, session_id)
        if detail is None:
            raise HTTPException(status_code=404, detail="Sesión no encontrada.")
        return detail

    @app.post("/admin/profiles", status_code=201)
    async def enroll_profile(
        request: EnrollmentRequest,
        x_voice_admin_token: str | None = Header(default=None),
    ) -> dict[str, Any]:
        _admin_guard(managed, x_voice_admin_token)
        try:
            payload = request.model_dump() if hasattr(request, "model_dump") else request.dict()
            profile = await managed.profiles.enroll_base64(**payload)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        value = {
            "id": profile.id,
            "company_id": profile.company_id,
            "name": profile.name,
            "language": profile.language,
            "duration_ms": profile.duration_ms,
            "active": profile.active,
        }
        return value

    @app.get("/admin/profiles")
    async def list_profiles(
        company_id: str = Query(min_length=1, max_length=80),
        x_voice_admin_token: str | None = Header(default=None),
    ) -> list[dict[str, Any]]:
        _admin_guard(managed, x_voice_admin_token)
        try:
            return await managed.profiles.list(company_id)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    @app.post("/admin/telephony/contexts", status_code=201)
    async def create_telephony_context(
        request: TelephonyContextRequest,
        x_voice_admin_token: str | None = Header(default=None),
    ) -> dict[str, Any]:
        _admin_guard(managed, x_voice_admin_token)
        payload = request.model_dump() if hasattr(request, "model_dump") else request.dict()
        try:
            context = await managed.telephony_contexts.create(**payload)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        return managed.telephony_contexts.public(context)

    @app.get("/admin/outbox")
    async def outbox_stats(
        x_voice_admin_token: str | None = Header(default=None),
    ) -> dict[str, int]:
        _admin_guard(managed, x_voice_admin_token)
        return await managed.outbox.stats()

    @app.post("/admin/outbox/flush")
    async def flush_outbox(
        x_voice_admin_token: str | None = Header(default=None),
    ) -> dict[str, int]:
        _admin_guard(managed, x_voice_admin_token)
        return await managed.outbox.flush_once()

    @app.delete("/admin/profiles/{profile_id}")
    async def deactivate_profile(
        profile_id: str,
        company_id: str = Query(min_length=1, max_length=80),
        x_voice_admin_token: str | None = Header(default=None),
    ) -> dict[str, bool]:
        _admin_guard(managed, x_voice_admin_token)
        try:
            changed = await managed.profiles.deactivate(company_id, profile_id)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        if not changed:
            raise HTTPException(status_code=404, detail="Perfil no encontrado.")
        return {"ok": True}

    @app.get("/demo/", include_in_schema=False)
    async def demo() -> FileResponse:
        path = Path(__file__).with_name("demo_pro.html")
        if not path.is_file():
            raise HTTPException(status_code=404, detail="Demo profesional no instalada.")
        return FileResponse(path)

    @app.websocket("/ws/{session_id}")
    async def websocket_voice(
        websocket: WebSocket,
        session_id: str,
        company_id: str = Query(default="demo"),
        token: str = Query(default=""),
        contact_phone: str | None = Query(default=None),
    ) -> None:
        if managed.config.websocket_token and token != managed.config.websocket_token:
            await websocket.close(code=4401, reason="Token inválido")
            return
        try:
            parsed_session_id = str(uuid.UUID(session_id))
        except ValueError:
            await websocket.close(code=4400, reason="session_id debe ser UUID")
            return
        company_id = company_id.strip()
        if not company_id or len(company_id) > 80:
            await websocket.close(code=4400, reason="company_id inválido")
            return
        try:
            await managed.registry.register(parsed_session_id, company_id, contact_phone)
        except SessionCapacityError as exc:
            await websocket.close(code=4429, reason=str(exc))
            return
        await managed.store.start_session(
            parsed_session_id,
            company_id,
            contact_phone=contact_phone,
            metadata={"transport": "websocket", "runtime": "pro-canary"},
        )
        await websocket.accept()

        async def send(event: VoiceEvent) -> None:
            await websocket.send_json(event.to_dict())

        bus = DurableEventBus(
            company_id=company_id,
            store=managed.store,
            registry=managed.registry,
            downstream=send,
        )
        session = ProfessionalVoiceSession(
            session_id=parsed_session_id,
            company_id=company_id,
            config=managed.config,
            stt=managed.voice.stt,
            llm=managed.voice.llm,
            tts=managed.voice.tts,
            memories=managed.voice.memories,
            emit=bus.emit,
            contact_phone=contact_phone,
        )
        sequence = 0
        close_reason = "client_disconnect"
        try:
            await session.start()
            while True:
                message = await websocket.receive()
                if message.get("type") == "websocket.disconnect":
                    break
                raw_bytes = message.get("bytes")
                raw_text = message.get("text")
                if raw_bytes is not None:
                    await session.receive(
                        AudioFrame(
                            pcm=raw_bytes,
                            sequence=sequence,
                            sample_rate=managed.config.sample_rate,
                            received_at_ms=time.time_ns() // 1_000_000,
                        )
                    )
                    sequence += 1
                elif raw_text:
                    try:
                        command = json.loads(raw_text)
                    except json.JSONDecodeError:
                        command = {}
                    if command.get("type") == "ping":
                        await bus.emit(
                            VoiceEvent(
                                type=EventType.METRIC,
                                session_id=parsed_session_id,
                                payload={"pong": True},
                                timestamp_ms=time.time_ns() // 1_000_000,
                            )
                        )
                    elif command.get("type") == "interrupt":
                        await session.playback.interrupt()
        except WebSocketDisconnect:
            pass
        except Exception:
            close_reason = "runtime_error"
            metrics.increment("websocket_runtime_errors")
            raise
        finally:
            try:
                await session.close()
            except Exception:
                pass
            await managed.registry.unregister(parsed_session_id)
            await managed.store.close_session(company_id, parsed_session_id, close_reason)

    return app


app = create_app()
