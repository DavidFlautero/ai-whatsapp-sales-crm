from __future__ import annotations

import asyncio
import base64
import contextlib
import json
import logging
import os
import signal
import time
import urllib.parse
from dataclasses import asdict

import websockets

from .crm_outbox import CRMOutbox
from .recording import CallRecorder
from .telephony_audio import iter_pcm_frames, resample_pcm16_mono, wav_to_pcm16_mono
from .telephony_context import TelephonyContext, TelephonyContextStore
from .telephony_protocol import AudioSocketCodec, AudioSocketProtocolError, AudioSocketType
from .telemetry import configure_logging, metrics


logger = logging.getLogger(__name__)


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on", "si", "sí"}


class TelephonyGateway:
    def __init__(self) -> None:
        self.host = os.getenv("VOICE_TELEPHONY_HOST", "127.0.0.1")
        self.port = int(os.getenv("VOICE_TELEPHONY_PORT", "9020"))
        self.runtime_ws = os.getenv("VOICE_RUNTIME_WS", "ws://127.0.0.1:4200/ws").rstrip("/")
        self.websocket_token = os.getenv("VOICE_WEBSOCKET_TOKEN", "")
        self.default_company = os.getenv("VOICE_DEFAULT_COMPANY_ID", "demo")
        self.require_context = _env_bool("VOICE_TELEPHONY_REQUIRE_CONTEXT", False)
        self.database = os.getenv("VOICE_PRO_DATABASE", "/opt/ventas-ia-mayorista/data/voice-pro.sqlite3")
        self.contexts = TelephonyContextStore(self.database)
        self.outbox = CRMOutbox(
            self.database,
            base_url=os.getenv("VOICE_INTERNAL_API_URL", "http://127.0.0.1:4000"),
            token=os.getenv("VOICE_INTERNAL_API_TOKEN", ""),
        )
        self.recordings_dir = os.getenv(
            "VOICE_RECORDINGS_DIR",
            "/opt/ventas-ia-mayorista/data/voice-recordings",
        )
        self.max_connections = int(os.getenv("VOICE_TELEPHONY_MAX_CONNECTIONS", "4"))
        self._slots = asyncio.Semaphore(self.max_connections)
        self._server: asyncio.Server | None = None
        self._closing = asyncio.Event()
        self._connections: set[asyncio.Task[object]] = set()

    async def start(self) -> None:
        await self.contexts.initialize()
        await self.outbox.initialize()
        self._server = await asyncio.start_server(
            self._accept,
            self.host,
            self.port,
            limit=256 * 1024,
            reuse_address=True,
        )
        sockets = ",".join(str(item.getsockname()) for item in self._server.sockets or ())
        logger.info("telephony_gateway_started", extra={"voice_extra": {"sockets": sockets}})
        asyncio.create_task(self._outbox_loop(), name="voice-crm-outbox")

    async def serve(self) -> None:
        if self._server is None:
            await self.start()
        assert self._server is not None
        async with self._server:
            await self._server.serve_forever()

    async def close(self) -> None:
        self._closing.set()
        if self._server is not None:
            self._server.close()
            await self._server.wait_closed()
        if self._connections:
            _, pending = await asyncio.wait(self._connections, timeout=10)
            for task in pending:
                task.cancel()

    async def _outbox_loop(self) -> None:
        while not self._closing.is_set():
            try:
                result = await self.outbox.flush_once()
                if result["selected"]:
                    logger.info("crm_outbox_flush", extra={"voice_extra": result})
            except Exception:
                logger.exception("crm_outbox_loop_failed")
            try:
                await asyncio.wait_for(self._closing.wait(), timeout=15)
            except TimeoutError:
                pass

    async def _accept(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        task = asyncio.current_task()
        if task is not None:
            self._connections.add(task)
        try:
            async with self._slots:
                await self._handle(reader, writer)
        finally:
            if task is not None:
                self._connections.discard(task)
            writer.close()
            with contextlib.suppress(Exception):
                await writer.wait_closed()

    async def _context(self, session_id: str) -> TelephonyContext:
        context = await self.contexts.consume(session_id)
        if context is not None:
            return context
        if self.require_context:
            raise AudioSocketProtocolError("La llamada no fue registrada por el CRM.")
        return TelephonyContext(
            session_id=session_id,
            company_id=self.default_company,
            contact_phone=None,
            direction="inbound",
            recording_enabled=False,
            recording_consent="disabled",
            metadata={"fallback_context": True},
            expires_at_ms=time.time_ns() // 1_000_000 + 60_000,
        )

    async def _handle(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        peer = writer.get_extra_info("peername")
        started = time.perf_counter()
        session_id = "unknown"
        context: TelephonyContext | None = None
        recorder: CallRecorder | None = None
        close_reason = "hangup"
        try:
            first = await asyncio.wait_for(AudioSocketCodec.read(reader), timeout=6)
            session_id = first.session_uuid()
            context = await self._context(session_id)
            recorder = CallRecorder(
                self.recordings_dir,
                session_id=session_id,
                company_id=context.company_id,
                sample_rate=16_000,
                enabled=context.recording_enabled,
                consent_basis=context.recording_consent,
            )
            await self.outbox.enqueue(
                context.company_id,
                "call.telephony_started",
                {"session_id": session_id, "peer": str(peer), **TelephonyContextStore.public(context)},
            )
            token = urllib.parse.quote(self.websocket_token, safe="")
            company = urllib.parse.quote(context.company_id, safe="")
            phone = urllib.parse.quote(context.contact_phone or "", safe="")
            uri = f"{self.runtime_ws}/{session_id}?company_id={company}&token={token}&contact_phone={phone}"
            async with websockets.connect(
                uri,
                open_timeout=8,
                close_timeout=5,
                max_size=16 * 1024 * 1024,
                ping_interval=20,
                ping_timeout=20,
            ) as websocket:
                playback: asyncio.Queue[bytes | None] = asyncio.Queue(maxsize=500)
                tasks = {
                    asyncio.create_task(self._phone_to_runtime(reader, websocket, recorder), name=f"phone-in:{session_id}"),
                    asyncio.create_task(self._runtime_to_queue(websocket, playback, recorder), name=f"runtime-out:{session_id}"),
                    asyncio.create_task(self._playback(writer, playback), name=f"phone-out:{session_id}"),
                }
                done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
                for item in pending:
                    item.cancel()
                await asyncio.gather(*pending, return_exceptions=True)
                for item in done:
                    exception = item.exception()
                    if exception and not isinstance(exception, EOFError):
                        raise exception
        except EOFError:
            close_reason = "remote_disconnect"
        except Exception as exc:
            close_reason = f"{type(exc).__name__}"
            metrics.increment("telephony_gateway_errors")
            logger.exception(
                "telephony_call_failed",
                extra={"voice_extra": {"session_id": session_id, "peer": str(peer)}},
            )
            with contextlib.suppress(Exception):
                await AudioSocketCodec.write(writer, AudioSocketType.ERROR, str(exc)[:200].encode("utf-8"))
        finally:
            manifest = await recorder.close() if recorder is not None else None
            duration_ms = round((time.perf_counter() - started) * 1000)
            if context is not None:
                payload = {
                    "session_id": session_id,
                    "duration_ms": duration_ms,
                    "close_reason": close_reason,
                    "recording": asdict(manifest) if manifest else None,
                }
                await self.outbox.enqueue(context.company_id, "call.telephony_ended", payload)
            metrics.observe("telephony_call_duration_ms", duration_ms)

    async def _phone_to_runtime(self, reader, websocket, recorder: CallRecorder) -> None:
        while True:
            message = await AudioSocketCodec.read(reader)
            if message.type == AudioSocketType.HANGUP:
                return
            if message.type == AudioSocketType.DTMF:
                digit = message.payload[:1].decode("ascii", errors="ignore")
                await websocket.send(json.dumps({"type": "dtmf", "digit": digit}))
                continue
            if message.sample_rate is None:
                continue
            pcm = resample_pcm16_mono(message.payload, message.sample_rate, 16_000)
            await recorder.inbound(pcm)
            await websocket.send(pcm)

    async def _runtime_to_queue(self, websocket, playback, recorder: CallRecorder) -> None:
        async for raw in websocket:
            if isinstance(raw, bytes):
                continue
            event = json.loads(raw)
            event_type = event.get("type")
            payload = event.get("payload") or {}
            if event_type == "audio_stop":
                while not playback.empty():
                    with contextlib.suppress(asyncio.QueueEmpty):
                        playback.get_nowait()
                        playback.task_done()
                continue
            encoded = payload.get("audio_base64")
            if event_type != "audio_chunk" or not encoded:
                continue
            audio = base64.b64decode(encoded)
            pcm_8k = wav_to_pcm16_mono(audio, 8_000)
            await recorder.outbound(resample_pcm16_mono(pcm_8k, 8_000, 16_000))
            for frame in iter_pcm_frames(pcm_8k, 8_000, 20):
                await playback.put(frame)

    async def _playback(self, writer: asyncio.StreamWriter, playback: asyncio.Queue[bytes | None]) -> None:
        while True:
            frame = await playback.get()
            try:
                if frame is None:
                    return
                await AudioSocketCodec.write(writer, AudioSocketType.AUDIO_8K, frame)
                await asyncio.sleep(0.02)
            finally:
                playback.task_done()


async def _main() -> None:
    configure_logging(os.getenv("VOICE_LOG_LEVEL", "INFO"))
    gateway = TelephonyGateway()
    loop = asyncio.get_running_loop()
    for name in ("SIGTERM", "SIGINT"):
        value = getattr(signal, name, None)
        if value is not None:
            with contextlib.suppress(NotImplementedError):
                loop.add_signal_handler(value, lambda: asyncio.create_task(gateway.close()))
    await gateway.serve()


if __name__ == "__main__":
    asyncio.run(_main())
