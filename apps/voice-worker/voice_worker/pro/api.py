from __future__ import annotations

import json
import os
import time
import uuid

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from .config import ProVoiceConfig
from .contracts import AudioFrame, EventType, VoiceEvent
from .llm_stream import AnthropicStreamingLLM, DevelopmentEchoLLM
from .memory import SessionMemoryStore
from .orchestrator import ProfessionalVoiceSession
from .stt_stream import FasterWhisperSTT
from .telemetry import metrics
from .tts_stream import ChatterboxHttpTTS, PiperTTS


class ProfessionalRuntime:
    def __init__(self, config: ProVoiceConfig) -> None:
        self.config = config
        self.started_at = time.monotonic()
        self.memories = SessionMemoryStore(
            ttl_seconds=config.memory_ttl_seconds,
            max_messages=config.memory_max_messages,
        )
        self.stt = FasterWhisperSTT(
            config.stt_model,
            device=config.stt_device,
            compute_type=config.stt_compute_type,
            cpu_threads=config.stt_cpu_threads,
            queue_timeout_seconds=(
                config.stt_queue_timeout_seconds
            ),
        )
        if config.llm_provider == "development_echo":
            self.llm = DevelopmentEchoLLM()
        else:
            self.llm = AnthropicStreamingLLM(
                model=config.llm_model,
                max_tokens=config.llm_max_tokens,
                timeout_seconds=config.llm_timeout_seconds,
            )
        if config.tts_provider == "chatterbox_http":
            self.tts = ChatterboxHttpTTS(
                config.tts_gateway_url,
                token=os.getenv("VOICE_TTS_GATEWAY_TOKEN", ""),
            )
        else:
            self.tts = PiperTTS(
                config.piper_binary,
                config.piper_model_path,
            )

    def health(self) -> dict[str, object]:
        return {
            "ok": True,
            "component": "professional-voice-runtime",
            "uptime_seconds": round(
                time.monotonic() - self.started_at,
                3,
            ),
            "config": self.config.public_dict(),
            "stt_loaded": self.stt.ready,
        }


def create_professional_router(
    runtime: ProfessionalRuntime | None = None,
) -> APIRouter:
    runtime = runtime or ProfessionalRuntime(
        ProVoiceConfig.from_env()
    )

    router = APIRouter(
        prefix="/pro",
        tags=["professional-voice"],
    )

    @router.get("/health")
    async def health() -> dict[str, object]:
        value = runtime.health()
        value["memory"] = (
            await runtime.memories.snapshot()
        )
        return value

    @router.get("/metrics")
    async def runtime_metrics() -> dict[str, object]:
        return metrics.snapshot()

    @router.websocket("/ws/{session_id}")
    async def websocket_voice(
        websocket: WebSocket,
        session_id: str,
        company_id: str = Query(default="demo"),
        token: str = Query(default=""),
        contact_phone: str | None = Query(
            default=None
        ),
    ) -> None:
        if (
            runtime.config.websocket_token
            and token
            != runtime.config.websocket_token
        ):
            await websocket.close(
                code=4401,
                reason="Token inválido",
            )
            return

        try:
            parsed_session_id = str(
                uuid.UUID(session_id)
            )
        except ValueError:
            await websocket.close(
                code=4400,
                reason="session_id debe ser UUID",
            )
            return

        company_id = company_id.strip()

        if not company_id or len(company_id) > 80:
            await websocket.close(
                code=4400,
                reason="company_id inválido",
            )
            return

        await websocket.accept()

        async def emit(
            event: VoiceEvent,
        ) -> None:
            try:
                await websocket.send_json(
                    event.to_dict()
                )
            except RuntimeError:
                return

        session = ProfessionalVoiceSession(
            session_id=parsed_session_id,
            company_id=company_id,
            config=runtime.config,
            stt=runtime.stt,
            llm=runtime.llm,
            tts=runtime.tts,
            memories=runtime.memories,
            emit=emit,
            contact_phone=contact_phone,
        )

        sequence = 0

        try:
            await session.start()

            while True:
                message = (
                    await websocket.receive()
                )

                if (
                    message.get("type")
                    == "websocket.disconnect"
                ):
                    break

                raw_bytes = message.get("bytes")
                raw_text = message.get("text")

                if raw_bytes is not None:
                    frame = AudioFrame(
                        pcm=raw_bytes,
                        sequence=sequence,
                        sample_rate=(
                            runtime.config.sample_rate
                        ),
                        received_at_ms=(
                            time.time_ns()
                            // 1_000_000
                        ),
                    )

                    sequence += 1
                    await session.receive(frame)
                    continue

                if raw_text:
                    try:
                        command = json.loads(
                            raw_text
                        )
                    except json.JSONDecodeError:
                        command = {}

                    if (
                        command.get("type")
                        == "ping"
                    ):
                        await emit(
                            VoiceEvent(
                                type=EventType.METRIC,
                                session_id=(
                                    parsed_session_id
                                ),
                                payload={
                                    "pong": True
                                },
                                timestamp_ms=(
                                    time.time_ns()
                                    // 1_000_000
                                ),
                            )
                        )

                    elif (
                        command.get("type")
                        == "interrupt"
                    ):
                        await (
                            session.playback
                            .interrupt()
                        )

        except WebSocketDisconnect:
            pass

        finally:
            try:
                await session.close()
            except RuntimeError:
                pass

    return router
