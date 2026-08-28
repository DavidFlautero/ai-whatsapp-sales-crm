from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import secrets
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi import Response
from fastapi import WebSocket
from fastapi import WebSocketDisconnect
from fastapi.staticfiles import StaticFiles

from .advanced_config import settings
from .advanced_session import AdvancedVoiceSession
from .callbacks import CallbackClient
from .callbacks import VoiceCallback
from .metrics import metrics
from .runtime import VoiceRuntime
from .security import VoiceIdentity
from .security import VoiceTokenError
from .security import VoiceTokenSigner


logging.basicConfig(
    level=logging.INFO,
    format=(
        "%(asctime)s %(levelname)s "
        "%(name)s %(message)s"
    ),
)

logger = logging.getLogger(
    "voice.server"
)

settings.validate()

runtime = VoiceRuntime(settings)
callbacks = CallbackClient(settings)
signer = VoiceTokenSigner(
    settings.worker_secret,
    settings.token_ttl_seconds,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await callbacks.start()

    warmup = asyncio.create_task(
        runtime.warmup()
    )

    try:
        yield
    finally:
        if not warmup.done():
            warmup.cancel()

        with contextlib.suppress(
            Exception,
            asyncio.CancelledError,
        ):
            await warmup

        await callbacks.close()


app = FastAPI(
    title="Neuromind Voice Runtime",
    version="0.2.0",
    lifespan=lifespan,
)

demo_directory = (
    Path(__file__).resolve().parents[1]
    / "demo"
)

if demo_directory.is_dir():
    app.mount(
        "/demo",
        StaticFiles(
            directory=demo_directory,
            html=True,
        ),
        name="voice-demo",
    )


@app.get("/health")
async def health() -> dict[str, object]:
    return {
        "ok": True,
        "component": "voice-runtime",
        "ready": runtime.ready,
    }


@app.get("/ready")
async def readiness() -> Response:
    return Response(
        content=json.dumps(
            {
                "ready": runtime.ready,
                "error": runtime.load_error,
            }
        ),
        status_code=(
            200
            if runtime.ready
            else 503
        ),
        media_type="application/json",
    )


@app.get("/metrics")
async def prometheus() -> Response:
    return Response(
        await metrics.render_prometheus(),
        media_type="text/plain",
    )


def authenticate(
    websocket: WebSocket,
) -> VoiceIdentity:
    token = websocket.query_params.get(
        "token",
        "",
    )

    if (
        settings.allow_unsafe_demo
        and token == "unsafe-demo"
    ):
        return VoiceIdentity(
            company_id=websocket.query_params.get(
                "company_id",
                "demo",
            ),
            call_id=websocket.query_params.get(
                "call_id",
                secrets.token_urlsafe(12),
            ),
            language=websocket.query_params.get(
                "language",
                "es",
            ),
            expires_at=2 ** 31,
        )

    return signer.verify(token)


async def emit(
    session: AdvancedVoiceSession,
    kind: str,
    payload: dict[str, object],
) -> None:
    await callbacks.emit(
        VoiceCallback(
            kind=kind,
            company_id=session.company_id,
            call_id=session.call_id,
            sequence=session.next_sequence(),
            payload=payload,
        )
    )


async def process_turn(
    websocket: WebSocket,
    session: AdvancedVoiceSession,
    pcm16: bytes,
) -> None:
    session.detector.set_assistant_speaking(
        True
    )

    await websocket.send_json(
        {
            "type": "processing",
            "bytes": len(pcm16),
        }
    )

    try:
        result = await runtime.process(
            pcm16,
            session.language,
            session.company_id,
        )

        session.append_history(
            "user",
            result.transcript,
        )

        session.append_history(
            "assistant",
            result.reply,
        )

        await websocket.send_json(
            {
                "type": "result",
                "transcript": result.transcript,
                "reply": result.reply,
                "mime_type": result.mime_type,
                "latency_seconds": round(
                    result.elapsed_seconds,
                    3,
                ),
                "audio_bytes": len(result.audio),
            }
        )

        await websocket.send_bytes(
            result.audio
        )

        await emit(
            session,
            "voice.turn.completed",
            {
                "transcript": result.transcript,
                "reply": result.reply,
                "latency_seconds": (
                    result.elapsed_seconds
                ),
            },
        )
    except asyncio.CancelledError:
        await websocket.send_json(
            {
                "type": "interrupted",
            }
        )

        await emit(
            session,
            "voice.turn.interrupted",
            {},
        )

        raise
    except Exception as error:
        logger.exception(
            "turn_failed call_id=%s",
            session.call_id,
        )

        await websocket.send_json(
            {
                "type": "error",
                "message": str(error),
            }
        )
    finally:
        session.detector.set_assistant_speaking(
            False
        )


@app.websocket("/v1/voice/stream")
async def voice_stream(
    websocket: WebSocket,
) -> None:
    try:
        identity = authenticate(websocket)
    except VoiceTokenError:
        await websocket.close(
            code=4401,
            reason="Token inválido",
        )
        return

    await websocket.accept()

    session = AdvancedVoiceSession(
        company_id=identity.company_id,
        call_id=identity.call_id,
        language=identity.language,
        settings=settings,
    )

    await metrics.increment("connections")

    await websocket.send_json(
        {
            "type": "ready",
            "call_id": session.call_id,
            "sample_rate": settings.sample_rate,
            "encoding": "pcm_s16le",
        }
    )

    await emit(
        session,
        "voice.call.connected",
        {},
    )

    try:
        while True:
            message = await asyncio.wait_for(
                websocket.receive(),
                timeout=(
                    settings.idle_timeout_seconds
                ),
            )

            if (
                message.get("type")
                == "websocket.disconnect"
            ):
                break

            binary = message.get("bytes")

            if binary:
                updates = session.feed_audio(
                    binary
                )

                for update in updates:
                    if update.speech_started:
                        await websocket.send_json(
                            {
                                "type": (
                                    "speech_started"
                                ),
                                "probability": (
                                    update.probability
                                ),
                            }
                        )

                        if update.barge_in:
                            await session.cancel_generation()

                    if (
                        update.speech_ended
                        and update.audio
                    ):
                        await session.cancel_generation()

                        task = asyncio.create_task(
                            process_turn(
                                websocket,
                                session,
                                update.audio,
                            )
                        )

                        session.active_generation = task

                continue

            text = message.get("text")

            if not text:
                continue

            control = json.loads(text)
            command = control.get("type")

            if command == "ping":
                await websocket.send_json(
                    {
                        "type": "pong",
                    }
                )

            elif command == "interrupt":
                interrupted = (
                    await session.cancel_generation()
                )

                await websocket.send_json(
                    {
                        "type": "interrupt_ack",
                        "interrupted": interrupted,
                    }
                )

            elif command == "commit":
                update = session.detector.flush()

                if update and update.audio:
                    await session.cancel_generation()

                    session.active_generation = (
                        asyncio.create_task(
                            process_turn(
                                websocket,
                                session,
                                update.audio,
                            )
                        )
                    )

            elif command == "stop":
                break

            else:
                await websocket.send_json(
                    {
                        "type": "error",
                        "message": (
                            "Control desconocido"
                        ),
                    }
                )

    except (
        WebSocketDisconnect,
        asyncio.TimeoutError,
    ):
        pass
    finally:
        await session.close()
        await metrics.increment(
            "disconnections"
        )

        await emit(
            session,
            "voice.call.disconnected",
            {},
        )
