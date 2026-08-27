from __future__ import annotations

import asyncio
import struct
import uuid
from dataclasses import dataclass
from enum import IntEnum


class AudioSocketType(IntEnum):
    HANGUP = 0x00
    UUID = 0x01
    DTMF = 0x03
    AUDIO_8K = 0x10
    AUDIO_12K = 0x11
    AUDIO_16K = 0x12
    AUDIO_24K = 0x13
    AUDIO_32K = 0x14
    AUDIO_44K = 0x15
    AUDIO_48K = 0x16
    ERROR = 0xFF


SAMPLE_RATES = {
    AudioSocketType.AUDIO_8K: 8_000,
    AudioSocketType.AUDIO_12K: 12_000,
    AudioSocketType.AUDIO_16K: 16_000,
    AudioSocketType.AUDIO_24K: 24_000,
    AudioSocketType.AUDIO_32K: 32_000,
    AudioSocketType.AUDIO_44K: 44_100,
    AudioSocketType.AUDIO_48K: 48_000,
}


class AudioSocketProtocolError(RuntimeError):
    pass


@dataclass(slots=True, frozen=True)
class AudioSocketMessage:
    type: AudioSocketType
    payload: bytes

    @property
    def sample_rate(self) -> int | None:
        return SAMPLE_RATES.get(self.type)

    def session_uuid(self) -> str:
        if self.type != AudioSocketType.UUID or len(self.payload) != 16:
            raise AudioSocketProtocolError("La trama inicial no contiene un UUID binario válido.")
        return str(uuid.UUID(bytes=self.payload))


class AudioSocketCodec:
    HEADER_SIZE = 3
    MAX_PAYLOAD = 65_535

    @classmethod
    def encode(cls, message_type: AudioSocketType, payload: bytes = b"") -> bytes:
        if len(payload) > cls.MAX_PAYLOAD:
            raise AudioSocketProtocolError("La trama AudioSocket supera 65535 bytes.")
        return bytes((int(message_type),)) + struct.pack(">H", len(payload)) + payload

    @classmethod
    async def read(cls, reader: asyncio.StreamReader) -> AudioSocketMessage:
        try:
            header = await reader.readexactly(cls.HEADER_SIZE)
        except asyncio.IncompleteReadError as exc:
            raise EOFError("AudioSocket cerró la conexión.") from exc
        raw_type = header[0]
        length = struct.unpack(">H", header[1:])[0]
        try:
            message_type = AudioSocketType(raw_type)
        except ValueError as exc:
            raise AudioSocketProtocolError(f"Tipo AudioSocket desconocido: 0x{raw_type:02x}") from exc
        try:
            payload = await reader.readexactly(length)
        except asyncio.IncompleteReadError as exc:
            raise AudioSocketProtocolError("La trama AudioSocket llegó incompleta.") from exc
        return AudioSocketMessage(message_type, payload)

    @classmethod
    async def write(
        cls,
        writer: asyncio.StreamWriter,
        message_type: AudioSocketType,
        payload: bytes = b"",
    ) -> None:
        writer.write(cls.encode(message_type, payload))
        await writer.drain()


def uuid_message(session_id: str) -> bytes:
    return AudioSocketCodec.encode(AudioSocketType.UUID, uuid.UUID(session_id).bytes)
