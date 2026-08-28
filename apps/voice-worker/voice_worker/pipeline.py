from __future__ import annotations

import asyncio

from .agent import ConversationAgent
from .config import settings
from .stt import Transcriber
from .tts import Synthesizer


class VoicePipeline:
    def __init__(self) -> None:
        self.transcriber = Transcriber(
            settings.whisper_model,
            settings.whisper_device,
            settings.whisper_compute,
        )

        self.agent = ConversationAgent(
            settings.anthropic_key,
            settings.anthropic_model,
        )

        self.synthesizer = Synthesizer(
            settings.tts_engine,
            settings.tts_device,
            settings.reference_audio,
        )

    async def process(
        self,
        pcm16: bytes,
        language: str,
        company_id: str,
    ) -> tuple[str, str, bytes, str]:
        if not pcm16:
            raise ValueError(
                "No se recibió audio para procesar."
            )

        transcript = await asyncio.to_thread(
            self.transcriber.transcribe,
            pcm16,
            settings.sample_rate,
            language,
        )

        if not transcript:
            raise ValueError(
                "No se detectó voz en el audio."
            )

        reply = await self.agent.reply(
            transcript,
            company_id,
        )

        if not reply:
            raise ValueError(
                "El agente no generó una respuesta."
            )

        audio, mime_type = await asyncio.to_thread(
            self.synthesizer.synthesize,
            reply,
            language,
        )

        if not audio:
            raise ValueError(
                "El sintetizador no generó audio."
            )

        return (
            transcript,
            reply,
            audio,
            mime_type,
        )
