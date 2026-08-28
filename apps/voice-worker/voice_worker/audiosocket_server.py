from __future__ import annotations

import asyncio
import contextlib
import logging
from dataclasses import dataclass

from .advanced_config import settings
from .advanced_session import AdvancedVoiceSession
from .audiosocket_protocol import SAMPLE_RATES
from .audiosocket_protocol import AudioSocketType
from .audiosocket_protocol import decode_dtmf
from .audiosocket_protocol import decode_uuid
from .audiosocket_protocol import read_frame
from .audiosocket_protocol import write_frame
from .callbacks import CallbackClient
from .callbacks import VoiceCallback
from .runtime import VoiceRuntime
from .telephony_audio import RateConverter
from .telephony_audio import chunk_pcm
from .telephony_audio import wav_to_pcm16_mono


logger = logging.getLogger(
    "voice.audiosocket"
)


@dataclass(slots=True)
class AudioSocketConnection:
    call_id: str
    company_id: str
    input_rate: int
    input_type: AudioSocketType
    converter: RateConverter
    session: AdvancedVoiceSession
    generation: asyncio.Task[None] | None = None


class AudioSocketServer:
    def __init__(
        self,
        runtime: VoiceRuntime,
        callbacks: CallbackClient,
    ) -> None:
        self.runtime = runtime
        self.callbacks = callbacks
        self.server: asyncio.AbstractServer | None = None

    async def start(self) -> None:
        if self.server is not None:
            return

        self.server = await asyncio.start_server(
            self.handle_connection,
            settings.audiosocket_host,
            settings.audiosocket_port,
        )

        addresses = ", ".join(
            str(socket.getsockname())
            for socket in self.server.sockets or []
        )

        logger.info(
            "AudioSocket escuchando en %s",
            addresses,
        )

    async def serve_forever(self) -> None:
        if self.server is None:
            await self.start()

        assert self.server is not None

        async with self.server:
            await self.server.serve_forever()

    async def close(self) -> None:
        if self.server is None:
            return

        self.server.close()
        await self.server.wait_closed()
        self.server = None

    async def emit(
        self,
        connection: AudioSocketConnection,
        kind: str,
        payload: dict[str, object],
    ) -> None:
        await self.callbacks.emit(
            VoiceCallback(
                kind=kind,
                company_id=connection.company_id,
                call_id=connection.call_id,
                sequence=(
                    connection.session.next_sequence()
                ),
                payload=payload,
            )
        )

    async def cancel_generation(
        self,
        connection: AudioSocketConnection,
    ) -> None:
        task = connection.generation

        if task is None or task.done():
            connection.generation = None
            return

        task.cancel()

        with contextlib.suppress(
            asyncio.CancelledError
        ):
            await task

        connection.generation = None

    async def handle_connection(
        self,
        reader: asyncio.StreamReader,
        writer: asyncio.StreamWriter,
    ) -> None:
        peer = writer.get_extra_info(
            "peername"
        )

        connection: AudioSocketConnection | None = None

        try:
            identity = await asyncio.wait_for(
                read_frame(reader),
                timeout=5,
            )

            if (
                identity.kind
                is not AudioSocketType.UUID
            ):
                raise ValueError(
                    "La primera trama AudioSocket "
                    "debe contener el UUID."
                )

            call_id = decode_uuid(
                identity.payload
            )

            session = AdvancedVoiceSession(
                company_id="telephony",
                call_id=call_id,
                language="es",
                settings=settings,
            )

            connection = AudioSocketConnection(
                call_id=call_id,
                company_id="telephony",
                input_rate=8000,
                input_type=AudioSocketType.AUDIO_8K,
                converter=RateConverter(
                    8000,
                    settings.sample_rate,
                ),
                session=session,
            )

            await self.emit(
                connection,
                "voice.telephony.connected",
                {
                    "peer": str(peer),
                },
            )

            while True:
                frame = await read_frame(
                    reader
                )

                if (
                    frame.kind
                    is AudioSocketType.TERMINATE
                ):
                    break

                if (
                    frame.kind
                    is AudioSocketType.DTMF
                ):
                    digit = decode_dtmf(
                        frame.payload
                    )

                    await self.emit(
                        connection,
                        "voice.telephony.dtmf",
                        {
                            "digit": digit,
                        },
                    )

                    continue

                if (
                    frame.kind
                    is AudioSocketType.ERROR
                ):
                    raise RuntimeError(
                        "Asterisk informó un error: "
                        f"{frame.payload.hex()}"
                    )

                if frame.kind not in SAMPLE_RATES:
                    continue

                await self.handle_audio(
                    connection,
                    writer,
                    frame.kind,
                    frame.payload,
                )

        except (
            asyncio.IncompleteReadError,
            ConnectionResetError,
        ):
            pass

        except Exception:
            logger.exception(
                "AudioSocket falló peer=%s",
                peer,
            )

            with contextlib.suppress(
                Exception
            ):
                await write_frame(
                    writer,
                    AudioSocketType.ERROR,
                    b"runtime_error",
                )

        finally:
            if connection is not None:
                await self.cancel_generation(
                    connection
                )

                await connection.session.close()

                await self.emit(
                    connection,
                    "voice.telephony.disconnected",
                    {},
                )

            writer.close()

            with contextlib.suppress(
                Exception
            ):
                await writer.wait_closed()

    async def handle_audio(
        self,
        connection: AudioSocketConnection,
        writer: asyncio.StreamWriter,
        frame_type: AudioSocketType,
        pcm16: bytes,
    ) -> None:
        sample_rate = SAMPLE_RATES[
            frame_type
        ]

        if sample_rate != connection.input_rate:
            connection.input_rate = sample_rate
            connection.input_type = frame_type
            connection.converter = RateConverter(
                sample_rate,
                settings.sample_rate,
            )

        runtime_audio = (
            connection.converter.convert(
                pcm16
            )
        )

        updates = (
            connection.session.feed_audio(
                runtime_audio
            )
        )

        for update in updates:
            if update.speech_started:
                await self.cancel_generation(
                    connection
                )

            if (
                update.speech_ended
                and update.audio
            ):
                await self.cancel_generation(
                    connection
                )

                connection.generation = (
                    asyncio.create_task(
                        self.answer(
                            connection,
                            writer,
                            update.audio,
                        )
                    )
                )

    async def answer(
        self,
        connection: AudioSocketConnection,
        writer: asyncio.StreamWriter,
        pcm16: bytes,
    ) -> None:
        result = await self.runtime.process(
            pcm16,
            "es",
            connection.company_id,
        )

        output_pcm = wav_to_pcm16_mono(
            result.audio,
            connection.input_rate,
        )

        await self.emit(
            connection,
            "voice.telephony.turn",
            {
                "transcript": result.transcript,
                "reply": result.reply,
            },
        )

        connection.session.detector \
            .set_assistant_speaking(True)

        try:
            for audio_chunk in chunk_pcm(
                output_pcm,
                connection.input_rate,
                20,
            ):
                await write_frame(
                    writer,
                    connection.input_type,
                    audio_chunk,
                )

                await asyncio.sleep(0.02)
        finally:
            connection.session.detector \
                .set_assistant_speaking(False)
