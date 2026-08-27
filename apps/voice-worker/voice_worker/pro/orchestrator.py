from __future__ import annotations

import asyncio
import base64
import logging
import time
from collections.abc import AsyncIterator, Awaitable, Callable

from .audio import FrameAccumulator, JitterBuffer, PreRollBuffer
from .barge_in import PlaybackController
from .config import ProVoiceConfig
from .contracts import AudioFrame, EventType, SessionState, VoiceEvent, VoiceRuntimeError
from .llm_stream import StreamingLanguageModel, build_system_prompt
from .memory import ConversationMemory, SessionMemoryStore, now_ms
from .stt_stream import SpeechToText
from .telemetry import company_id_var, metrics, session_id_var
from .tts_stream import TextToSpeech, SentenceChunker
from .turns import AdaptiveTurnDetector, TurnSignal


logger = logging.getLogger(__name__)
EventSink = Callable[[VoiceEvent], Awaitable[None]]


class ProfessionalVoiceSession:
    def __init__(
        self,
        *,
        session_id: str,
        company_id: str,
        config: ProVoiceConfig,
        stt: SpeechToText,
        llm: StreamingLanguageModel,
        tts: TextToSpeech,
        memories: SessionMemoryStore,
        emit: EventSink,
        contact_phone: str | None = None,
    ) -> None:
        self.session_id = session_id
        self.company_id = company_id
        self.config = config
        self.stt = stt
        self.llm = llm
        self.tts = tts
        self.memories = memories
        self.emit = emit
        self.contact_phone = contact_phone
        self.state = SessionState.CONNECTING
        self.language: str | None = None if config.auto_detect_language else config.default_language
        self.detector = AdaptiveTurnDetector(
            start_frames=config.vad_start_frames,
            end_silence_ms=config.vad_end_silence_ms,
            min_speech_ms=config.vad_min_speech_ms,
            max_utterance_ms=config.vad_max_utterance_ms,
            margin_db=config.vad_margin_db,
        )
        self.accumulator = FrameAccumulator(sample_rate=config.sample_rate, max_duration_ms=config.vad_max_utterance_ms + 2_000)
        self.pre_roll = PreRollBuffer(max_frames=max(3, round(240 / config.frame_ms)))
        self.jitter = JitterBuffer(capacity=max(4, round(200 / config.frame_ms)))
        self._turn_task: asyncio.Task[None] | None = None
        self._greeting_task: asyncio.Task[None] | None = None
        self._closed = False
        self.playback = PlaybackController(self._emit_audio_stop)

    async def start(self) -> None:
        session_id_var.set(self.session_id)
        company_id_var.set(self.company_id)
        await self.memories.get_or_create(
            self.session_id,
            self.company_id,
            contact_phone=self.contact_phone,
            language=self.config.default_language,
        )
        await self._set_state(SessionState.LISTENING)
        await self._event(
            EventType.READY,
            {
                "sample_rate": self.config.sample_rate,
                "encoding": "pcm_s16le",
                "frame_ms": self.config.frame_ms,
                "languages": list(self.config.supported_languages),
                "barge_in": True,
            },
        )
        metrics.increment("sessions_started")
        self._greeting_task = asyncio.create_task(
            self._proactive_greeting(),
            name=f"voice-greeting:{self.session_id}",
        )

    async def _proactive_greeting(self) -> None:
        try:
            # Dejamos que Meta termine de conectar el audio.
            await asyncio.sleep(1.25)

            if self._closed:
                return

            async def greeting_tokens() -> AsyncIterator[str]:
                yield (
                    "Hola, gracias por comunicarte. "
                    "¿En qué puedo ayudarte?"
                )

            memory = await self.memories.get_or_create(
                self.session_id,
                self.company_id,
            )

            await self._speak_stream(
                greeting_tokens(),
                memory,
                remember=False,
            )

            metrics.increment(
                "proactive_greetings_completed"
            )
        except asyncio.CancelledError:
            metrics.increment(
                "proactive_greetings_cancelled"
            )
            raise
        except Exception as exc:
            logger.exception(
                "voice_proactive_greeting_failed"
            )
            metrics.increment(
                "proactive_greetings_failed"
            )
            await self._event(
                EventType.ERROR,
                {
                    "code": "GREETING_FAILED",
                    "message": str(exc),
                    "retryable": True,
                },
            )

    async def receive(self, frame: AudioFrame) -> None:
        if self._closed:
            return
        for ordered in self.jitter.push(frame):
            await self._receive_ordered(ordered)

    async def _receive_ordered(self, frame: AudioFrame) -> None:
        decision = self.detector.accept(frame)
        metrics.gauge("vad_noise_floor_dbfs", self.detector.noise_floor_dbfs)

        if decision.signal == TurnSignal.SPEECH_STARTED:
            if (
                self._greeting_task
                and not self._greeting_task.done()
            ):
                self._greeting_task.cancel()

            if await self.playback.interrupt():
                metrics.increment("barge_ins")
            if self._turn_task and not self._turn_task.done():
                self._turn_task.cancel()
            for buffered in self.pre_roll.drain():
                self.accumulator.append(buffered)
            self.accumulator.append(frame)
            await self._set_state(SessionState.LISTENING)
            await self._event(EventType.SPEECH_STARTED, {"dbfs": round(decision.dbfs, 2)})
            return

        if self.detector.in_speech:
            self.accumulator.append(frame)
            return

        if decision.signal in {TurnSignal.SPEECH_ENDED, TurnSignal.MAX_DURATION}:
            self.accumulator.append(frame)
            audio = self.accumulator.clear()
            await self._event(
                EventType.SPEECH_ENDED,
                {"bytes": len(audio), "reason": decision.signal.value},
            )
            self._turn_task = asyncio.create_task(self._process_turn(audio), name=f"voice-turn:{self.session_id}")
            return

        self.pre_roll.append(frame)

    async def _process_turn(self, pcm: bytes) -> None:
        session_id_var.set(self.session_id)
        company_id_var.set(self.company_id)
        started = time.perf_counter()
        try:
            await self._set_state(SessionState.THINKING)
            with metrics.timer("turn_stt_ms"):
                transcript = await self.stt.transcribe(pcm, self.config.sample_rate, self.language)
            if transcript.language in self.config.supported_languages:
                self.language = transcript.language
            else:
                self.language = self.config.default_language
            await self.memories.append(
                self.session_id,
                "user",
                transcript.text,
                language=self.language,
                confidence=transcript.confidence,
            )
            await self._event(
                EventType.TRANSCRIPT_FINAL,
                {
                    "text": transcript.text,
                    "language": self.language,
                    "confidence": round(transcript.confidence, 4),
                    "words": list(transcript.words),
                },
            )

            memory = await self.memories.get_or_create(self.session_id, self.company_id)
            token_stream = self.llm.stream_reply(memory, system_prompt=build_system_prompt(memory))
            await self._speak_stream(token_stream, memory)
            metrics.observe("turn_total_ms", (time.perf_counter() - started) * 1000)
        except asyncio.CancelledError:
            metrics.increment("turns_cancelled")
            raise
        except VoiceRuntimeError as exc:
            metrics.increment(f"error_{exc.code.lower()}")
            await self._event(EventType.ERROR, {"code": exc.code, "message": str(exc), "retryable": exc.retryable})
            await self._set_state(SessionState.LISTENING)
        except Exception as exc:
            logger.exception("voice_turn_failed")
            metrics.increment("turns_failed")
            await self._event(EventType.ERROR, {"code": "TURN_FAILED", "message": str(exc), "retryable": True})
            await self._set_state(SessionState.LISTENING)

    async def _speak_stream(
        self,
        tokens: AsyncIterator[str],
        memory: ConversationMemory,
        *,
        remember: bool = True,
    ) -> None:
        lease = await self.playback.acquire()

        async def runner() -> None:
            chunker = SentenceChunker(
                minimum_chars=self.config.tts_sentence_min_chars,
                maximum_chars=self.config.tts_sentence_max_chars,
            )
            response_parts: list[str] = []
            sequence = 0
            await self._set_state(SessionState.SPEAKING)

            async def speak_phrase(phrase: str) -> None:
                nonlocal sequence
                if not self.playback.is_current(lease):
                    raise asyncio.CancelledError
                with metrics.timer("tts_phrase_ms"):
                    audio = await self.tts.synthesize(
                        phrase,
                        language=self.language or self.config.default_language,
                        voice_id=self.config.tts_voice_id,
                    )
                if not self.playback.is_current(lease):
                    raise asyncio.CancelledError
                await self._event(
                    EventType.AUDIO_CHUNK,
                    {
                        "sequence": sequence,
                        "audio_base64": base64.b64encode(audio).decode("ascii"),
                        "mime_type": self.tts.mime_type,
                        "sample_rate": self.tts.sample_rate,
                    },
                )
                sequence += 1

            async for token in tokens:
                response_parts.append(token)
                await self._event(EventType.REPLY_PARTIAL, {"text": token})
                for phrase in chunker.feed(token):
                    await speak_phrase(phrase)
            for phrase in chunker.flush():
                await speak_phrase(phrase)

            full_reply = "".join(response_parts).strip()
            if full_reply and remember:
                await self.memories.append(
                    self.session_id,
                    "assistant",
                    full_reply,
                    language=self.language,
                )
            await self._event(EventType.AUDIO_CHUNK, {"sequence": sequence, "final": True})
            await self._set_state(SessionState.LISTENING)

        task = asyncio.create_task(runner(), name=f"voice-playback:{self.session_id}")
        await self.playback.attach(lease, task)
        await task

    async def _emit_audio_stop(self, generation: int) -> None:
        await self._event(EventType.AUDIO_STOP, {"generation": generation})

    async def _set_state(self, state: SessionState) -> None:
        if self.state == state:
            return
        previous = self.state
        self.state = state
        await self._event(EventType.STATE, {"previous": previous.value, "current": state.value})

    async def _event(self, event_type: EventType, payload: dict[str, object]) -> None:
        await self.emit(
            VoiceEvent(
                type=event_type,
                session_id=self.session_id,
                payload=dict(payload),
                timestamp_ms=now_ms(),
            )
        )

    async def close(self) -> None:
        if self._closed:
            return
        self._closed = True

        if (
            self._greeting_task
            and not self._greeting_task.done()
        ):
            self._greeting_task.cancel()
            try:
                await self._greeting_task
            except asyncio.CancelledError:
                pass

        if self._turn_task and not self._turn_task.done():
            self._turn_task.cancel()
            try:
                await self._turn_task
            except asyncio.CancelledError:
                pass
        await self.playback.close()
        await self._set_state(SessionState.CLOSED)
        metrics.increment("sessions_closed")
