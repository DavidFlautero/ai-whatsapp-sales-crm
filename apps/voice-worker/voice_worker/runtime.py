from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass

from .advanced_config import AdvancedSettings
from .metrics import metrics
from .pipeline import VoicePipeline


@dataclass(frozen=True, slots=True)
class TurnResult:
    transcript: str
    reply: str
    audio: bytes
    mime_type: str
    elapsed_seconds: float


class VoiceRuntime:
    def __init__(
        self,
        settings: AdvancedSettings,
    ) -> None:
        self.settings = settings
        self.pipeline: VoicePipeline | None = None
        self.load_lock = asyncio.Lock()
        self.slots = asyncio.Semaphore(
            settings.max_sessions
        )
        self.ready = False
        self.load_error: str | None = None

    async def warmup(self) -> None:
        await self.get_pipeline()

    async def get_pipeline(
        self,
    ) -> VoicePipeline:
        if self.pipeline is not None:
            return self.pipeline

        async with self.load_lock:
            if self.pipeline is not None:
                return self.pipeline

            try:
                self.pipeline = await asyncio.to_thread(
                    VoicePipeline
                )
                self.ready = True
                self.load_error = None

                await metrics.set_gauge(
                    "runtime_ready",
                    1,
                )
            except Exception as error:
                self.ready = False
                self.load_error = str(error)

                await metrics.set_gauge(
                    "runtime_ready",
                    0,
                )

                raise

            return self.pipeline

    async def process(
        self,
        pcm16: bytes,
        language: str,
        company_id: str,
    ) -> TurnResult:
        pipeline = await self.get_pipeline()
        started = time.perf_counter()

        await metrics.increment(
            "turns_started"
        )

        async with self.slots:
            try:
                result = await asyncio.wait_for(
                    pipeline.process(
                        pcm16,
                        language,
                        company_id,
                    ),
                    timeout=(
                        self.settings
                        .inference_timeout_seconds
                    ),
                )
            except asyncio.CancelledError:
                await metrics.increment(
                    "turns_cancelled"
                )
                raise
            except Exception:
                await metrics.increment(
                    "turns_failed"
                )
                raise

        transcript, reply, audio, mime_type = result
        elapsed = time.perf_counter() - started

        await metrics.increment(
            "turns_completed"
        )
        await metrics.observe(
            "turn_latency",
            elapsed,
        )
        await metrics.observe(
            "input_audio",
            len(pcm16) / 32000,
        )

        return TurnResult(
            transcript=transcript,
            reply=reply,
            audio=audio,
            mime_type=mime_type,
            elapsed_seconds=elapsed,
        )
