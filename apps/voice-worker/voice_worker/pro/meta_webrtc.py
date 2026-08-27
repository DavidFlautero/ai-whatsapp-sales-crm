from __future__ import annotations

import asyncio
import base64
import contextlib
import logging
import os
import time
import uuid
from dataclasses import dataclass, field
from fractions import Fraction
from typing import Any

import av
from aiortc import (
    AudioStreamTrack,
    RTCConfiguration,
    RTCIceServer,
    RTCPeerConnection,
    RTCSessionDescription,
)
from aiortc.mediastreams import MediaStreamError

from .api import ProfessionalRuntime
from .config import ProVoiceConfig
from .contracts import AudioFrame, EventType, VoiceEvent
from .crm_outbox import CRMOutbox
from .event_bus import DurableEventBus
from .orchestrator import ProfessionalVoiceSession
from .registry import ActiveSessionRegistry, SessionCapacityError
from .storage import VoiceSqliteStore
from .telemetry import metrics
from .telephony_audio import wav_to_pcm16_mono


logger = logging.getLogger(__name__)


class MetaWebRtcError(RuntimeError):
    def __init__(self, code: str, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.status_code = status_code


class PcmQueueAudioTrack(AudioStreamTrack):
    """Continuous 48 kHz mono track fed by the professional TTS pipeline."""

    kind = "audio"
    sample_rate = 48_000
    frame_samples = 960
    frame_bytes = frame_samples * 2
    time_base = Fraction(1, sample_rate)

    def __init__(self, *, max_chunks: int = 16) -> None:
        super().__init__()
        self._queue: asyncio.Queue[bytes] = asyncio.Queue(maxsize=max_chunks)
        self._buffer = bytearray()
        self._pts = 0
        self._started_at: float | None = None
        self._closed = False

    async def enqueue_wav(self, audio: bytes) -> None:
        if self._closed or not audio:
            return
        pcm = await asyncio.to_thread(
            wav_to_pcm16_mono,
            audio,
            self.sample_rate,
        )
        if pcm and not self._closed:
            await self._queue.put(pcm)

    def clear(self) -> None:
        self._buffer.clear()
        while True:
            try:
                self._queue.get_nowait()
            except asyncio.QueueEmpty:
                break
            else:
                self._queue.task_done()

    async def recv(self) -> av.AudioFrame:
        if self._closed or self.readyState != "live":
            raise MediaStreamError

        loop = asyncio.get_running_loop()
        if self._started_at is None:
            self._started_at = loop.time()
        else:
            target = self._started_at + (self._pts / self.sample_rate)
            delay = target - loop.time()
            if delay > 0:
                await asyncio.sleep(delay)

        while len(self._buffer) < self.frame_bytes:
            try:
                chunk = self._queue.get_nowait()
            except asyncio.QueueEmpty:
                break
            self._buffer.extend(chunk)
            self._queue.task_done()

        take = min(len(self._buffer), self.frame_bytes)
        pcm = bytes(self._buffer[:take])
        del self._buffer[:take]
        if take < self.frame_bytes:
            pcm += b"\x00" * (self.frame_bytes - take)

        frame = av.AudioFrame(
            format="s16",
            layout="mono",
            samples=self.frame_samples,
        )
        frame.planes[0].update(pcm)
        frame.sample_rate = self.sample_rate
        frame.pts = self._pts
        frame.time_base = self.time_base
        self._pts += self.frame_samples
        return frame

    def stop(self) -> None:
        if self._closed:
            return
        self._closed = True
        self.clear()
        super().stop()


def _filter_sdp_for_whatsapp(sdp: str) -> str:
    """Normaliza una respuesta SDP para WhatsApp Calling."""

    normalized = (
        sdp
        .replace("\r\n", "\n")
        .replace("\r", "\n")
    )

    filtered: list[str] = []

    for raw_line in normalized.split("\n"):
        line = raw_line.strip()

        if not line:
            continue

        lowered = line.lower()

        if lowered.startswith("a=fingerprint:"):
            if not lowered.startswith(
                "a=fingerprint:sha-256 "
            ):
                continue

            _, separator, digest = (
                line.partition(" ")
            )

            if not separator or not digest.strip():
                continue

            line = (
                "a=fingerprint:SHA-256 "
                + digest.strip()
            )

        filtered.append(line)

    return "\r\n".join(filtered) + "\r\n"


@dataclass(slots=True)
class ActiveMetaWebRtcCall:
    call_id: str
    session_id: str
    company_id: str
    contact_phone: str | None
    peer: RTCPeerConnection
    outbound: PcmQueueAudioTrack
    session: ProfessionalVoiceSession
    created_at_ms: int
    tasks: set[asyncio.Task[Any]] = field(default_factory=set)
    answer_sdp: str | None = None
    answer_type: str = "answer"
    closing: bool = False


class MetaWebRtcManager:
    def __init__(
        self,
        *,
        config: ProVoiceConfig,
        voice: ProfessionalRuntime,
        registry: ActiveSessionRegistry,
        store: VoiceSqliteStore,
        outbox: CRMOutbox,
    ) -> None:
        self.config = config
        self.voice = voice
        self.registry = registry
        self.store = store
        self.outbox = outbox
        self._calls: dict[str, ActiveMetaWebRtcCall] = {}
        self._lock = asyncio.Lock()
        self._ice_gather_timeout = float(
            os.getenv("VOICE_WEBRTC_ICE_GATHER_TIMEOUT_SECONDS", "8")
        )
        self._disconnect_grace = float(
            os.getenv("VOICE_WEBRTC_DISCONNECT_GRACE_SECONDS", "8")
        )

    @staticmethod
    def available() -> dict[str, Any]:
        import aiortc

        return {
            "ok": True,
            "provider": "aiortc",
            "version": getattr(aiortc, "__version__", "unknown"),
            "codec": "opus/48000",
        }

    def _rtc_configuration(self) -> RTCConfiguration:
        raw_urls = os.getenv("VOICE_WEBRTC_ICE_SERVERS", "").strip()
        if not raw_urls:
            return RTCConfiguration(iceServers=[])
        urls = [value.strip() for value in raw_urls.split(",") if value.strip()]
        if not urls:
            return RTCConfiguration(iceServers=[])
        username = os.getenv("VOICE_WEBRTC_ICE_USERNAME", "").strip() or None
        credential = os.getenv("VOICE_WEBRTC_ICE_CREDENTIAL", "").strip() or None
        return RTCConfiguration(
            iceServers=[
                RTCIceServer(
                    urls=urls,
                    username=username,
                    credential=credential,
                )
            ]
        )

    async def snapshot(self) -> dict[str, Any]:
        async with self._lock:
            calls = list(self._calls.values())
        return {
            "active": len(calls),
            "calls": [
                {
                    "call_id": item.call_id,
                    "session_id": item.session_id,
                    "company_id": item.company_id,
                    "contact_phone": item.contact_phone,
                    "connection_state": item.peer.connectionState,
                    "ice_connection_state": item.peer.iceConnectionState,
                    "ice_gathering_state": item.peer.iceGatheringState,
                    "created_at_ms": item.created_at_ms,
                }
                for item in calls
            ],
        }

    async def accept_offer(
        self,
        *,
        call_id: str,
        company_id: str,
        contact_phone: str | None,
        sdp: str,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        safe_call_id = call_id.strip()
        safe_company_id = company_id.strip()
        if not safe_call_id or len(safe_call_id) > 200:
            raise MetaWebRtcError("INVALID_CALL_ID", "call_id inválido.")
        if not safe_company_id or len(safe_company_id) > 80:
            raise MetaWebRtcError("INVALID_COMPANY_ID", "company_id inválido.")
        if not sdp.strip() or len(sdp) > 200_000:
            raise MetaWebRtcError("INVALID_SDP", "La oferta SDP es inválida.")

        async with self._lock:
            current = self._calls.get(safe_call_id)
            if current is not None:
                if current.answer_sdp:
                    return self._answer_payload(current, reused=True)
                raise MetaWebRtcError(
                    "CALL_NEGOTIATION_IN_PROGRESS",
                    "La llamada ya se está negociando.",
                    status_code=409,
                )

        session_id = str(
            uuid.uuid5(uuid.NAMESPACE_URL, f"whatsapp-calling:{safe_call_id}")
        )
        peer = RTCPeerConnection(configuration=self._rtc_configuration())
        outbound = PcmQueueAudioTrack()

        async def downstream(event: VoiceEvent) -> None:
            if event.type == EventType.AUDIO_STOP:
                outbound.clear()
                return
            if event.type != EventType.AUDIO_CHUNK:
                return
            encoded = event.payload.get("audio_base64")
            if not isinstance(encoded, str) or not encoded:
                return
            try:
                audio = base64.b64decode(encoded, validate=True)
            except (ValueError, TypeError) as exc:
                raise MetaWebRtcError(
                    "INVALID_TTS_AUDIO",
                    "El runtime produjo audio Base64 inválido.",
                    status_code=500,
                ) from exc
            await outbound.enqueue_wav(audio)

        bus = DurableEventBus(
            company_id=safe_company_id,
            store=self.store,
            registry=self.registry,
            downstream=downstream,
        )
        session = ProfessionalVoiceSession(
            session_id=session_id,
            company_id=safe_company_id,
            config=self.config,
            stt=self.voice.stt,
            llm=self.voice.llm,
            tts=self.voice.tts,
            memories=self.voice.memories,
            emit=bus.emit,
            contact_phone=contact_phone,
        )
        call = ActiveMetaWebRtcCall(
            call_id=safe_call_id,
            session_id=session_id,
            company_id=safe_company_id,
            contact_phone=contact_phone,
            peer=peer,
            outbound=outbound,
            session=session,
            created_at_ms=time.time_ns() // 1_000_000,
        )

        async with self._lock:
            raced = self._calls.get(safe_call_id)
            if raced is None:
                self._calls[safe_call_id] = call
        if raced is not None:
            await peer.close()
            if raced.answer_sdp:
                return self._answer_payload(raced, reused=True)
            raise MetaWebRtcError(
                "CALL_NEGOTIATION_IN_PROGRESS",
                "La llamada ya se está negociando.",
                status_code=409,
            )

        try:
            await self.registry.register(session_id, safe_company_id, contact_phone)
        except SessionCapacityError as exc:
            await self.close(safe_call_id, reason="capacity_rejected")
            raise MetaWebRtcError(
                "VOICE_CAPACITY_REACHED",
                str(exc),
                status_code=429,
            ) from exc

        try:
            await self.store.start_session(
                session_id,
                safe_company_id,
                contact_phone=contact_phone,
                metadata={
                    "transport": "meta-webrtc",
                    "runtime": "pro-canary",
                    "call_id": safe_call_id,
                    **(metadata or {}),
                },
            )
            await session.start()
            self._install_handlers(call)
            await peer.setRemoteDescription(
                RTCSessionDescription(sdp=sdp, type="offer")
            )
            peer.addTrack(outbound)
            answer = await peer.createAnswer()
            await peer.setLocalDescription(answer)
            await self._wait_for_ice_gathering(peer)
            local = peer.localDescription
            if local is None or not local.sdp:
                raise MetaWebRtcError(
                    "SDP_ANSWER_MISSING",
                    "WebRTC no produjo una respuesta SDP.",
                    status_code=503,
                )
            call.answer_sdp = _filter_sdp_for_whatsapp(local.sdp)
            call.answer_type = local.type
            metrics.increment("meta_webrtc_offers_accepted")
            await self.outbox.enqueue(
                safe_company_id,
                "call.webrtc_started",
                {
                    "call_id": safe_call_id,
                    "session_id": session_id,
                    "contact_phone": contact_phone,
                    "transport": "meta-webrtc",
                },
            )
            return self._answer_payload(call, reused=False)
        except MetaWebRtcError:
            await self.close(safe_call_id, reason="negotiation_error")
            raise
        except Exception as exc:
            metrics.increment("meta_webrtc_negotiation_failures")
            logger.exception(
                "meta_webrtc_negotiation_failed",
                extra={"voice_extra": {"call_id": safe_call_id}},
            )
            await self.close(safe_call_id, reason="negotiation_error")
            raise MetaWebRtcError(
                "WEBRTC_NEGOTIATION_FAILED",
                f"Falló la negociación WebRTC: {type(exc).__name__}",
                status_code=422,
            ) from exc

    @staticmethod
    def _answer_payload(call: ActiveMetaWebRtcCall, *, reused: bool) -> dict[str, Any]:
        return {
            "ok": True,
            "call_id": call.call_id,
            "session_id": call.session_id,
            "sdp": call.answer_sdp,
            "sdp_type": call.answer_type,
            "reused": reused,
        }

    def _install_handlers(self, call: ActiveMetaWebRtcCall) -> None:
        peer = call.peer

        @peer.on("track")
        def on_track(track: Any) -> None:
            if track.kind != "audio":
                return
            self._spawn(call, self._consume_audio(call, track), "meta-audio-in")

        @peer.on("connectionstatechange")
        async def on_connection_state_change() -> None:
            state = peer.connectionState
            await self.registry.update_state(call.session_id, f"webrtc_{state}")
            if state in {"failed", "closed"}:
                self._spawn(
                    call,
                    self.close(call.call_id, reason=f"webrtc_{state}"),
                    "meta-close",
                )
            elif state == "disconnected":
                self._spawn(call, self._close_if_still_disconnected(call), "meta-grace")

    def _spawn(
        self,
        call: ActiveMetaWebRtcCall,
        coroutine: Any,
        prefix: str,
    ) -> asyncio.Task[Any]:
        task = asyncio.create_task(coroutine, name=f"{prefix}:{call.session_id}")
        call.tasks.add(task)
        task.add_done_callback(lambda completed: self._task_done(call, completed))
        return task

    @staticmethod
    def _task_done(call: ActiveMetaWebRtcCall, task: asyncio.Task[Any]) -> None:
        call.tasks.discard(task)
        if task.cancelled():
            return
        with contextlib.suppress(Exception):
            task.exception()

    async def _close_if_still_disconnected(self, call: ActiveMetaWebRtcCall) -> None:
        await asyncio.sleep(self._disconnect_grace)
        if call.peer.connectionState == "disconnected":
            await self.close(call.call_id, reason="webrtc_disconnected")

    async def _consume_audio(self, call: ActiveMetaWebRtcCall, track: Any) -> None:
        resampler = av.AudioResampler(
            format="s16",
            layout="mono",
            rate=self.config.sample_rate,
        )
        frame_bytes = round(
            self.config.sample_rate * self.config.frame_ms / 1000
        ) * 2
        pending = bytearray()
        sequence = 0
        try:
            while not call.closing:
                source = await track.recv()
                converted = resampler.resample(source)
                for frame in converted:
                    length = frame.samples * 2
                    pending.extend(bytes(frame.planes[0])[:length])
                    while len(pending) >= frame_bytes:
                        pcm = bytes(pending[:frame_bytes])
                        del pending[:frame_bytes]
                        await call.session.receive(
                            AudioFrame(
                                pcm=pcm,
                                sequence=sequence,
                                sample_rate=self.config.sample_rate,
                                received_at_ms=time.time_ns() // 1_000_000,
                            )
                        )
                        sequence += 1
        except (MediaStreamError, asyncio.CancelledError):
            raise
        except Exception:
            metrics.increment("meta_webrtc_audio_receive_failures")
            logger.exception(
                "meta_webrtc_audio_receive_failed",
                extra={"voice_extra": {"call_id": call.call_id}},
            )

    async def _wait_for_ice_gathering(self, peer: RTCPeerConnection) -> None:
        if peer.iceGatheringState == "complete":
            return
        complete = asyncio.Event()

        @peer.on("icegatheringstatechange")
        def gathering_changed() -> None:
            if peer.iceGatheringState == "complete":
                complete.set()

        if peer.iceGatheringState == "complete":
            complete.set()
        try:
            await asyncio.wait_for(
                complete.wait(),
                timeout=self._ice_gather_timeout,
            )
        except TimeoutError:
            metrics.increment("meta_webrtc_ice_gather_timeouts")
            logger.warning("meta_webrtc_ice_gather_timeout")

    async def close(self, call_id: str, *, reason: str = "requested") -> bool:
        async with self._lock:
            call = self._calls.pop(call_id, None)
            if call is None or call.closing:
                return False
            call.closing = True

        current = asyncio.current_task()
        for task in tuple(call.tasks):
            if task is not current and not task.done():
                task.cancel()
        pending = [
            task
            for task in tuple(call.tasks)
            if task is not current and not task.done()
        ]
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)
        with contextlib.suppress(Exception):
            await call.session.close()
        call.outbound.stop()
        with contextlib.suppress(Exception):
            await call.peer.close()
        await self.registry.unregister(call.session_id)
        await self.store.close_session(call.company_id, call.session_id, reason)
        with contextlib.suppress(Exception):
            await self.outbox.enqueue(
                call.company_id,
                "call.webrtc_ended",
                {
                    "call_id": call.call_id,
                    "session_id": call.session_id,
                    "reason": reason,
                },
            )
        metrics.increment("meta_webrtc_calls_closed")
        return True

    async def close_all(self, *, reason: str = "runtime_shutdown") -> None:
        async with self._lock:
            call_ids = tuple(self._calls)
        await asyncio.gather(
            *(self.close(call_id, reason=reason) for call_id in call_ids),
            return_exceptions=True,
        )
