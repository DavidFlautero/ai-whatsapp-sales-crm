from __future__ import annotations

import asyncio
import enum
import uuid
from dataclasses import dataclass


class AudioSocketType(enum.IntEnum):
    TERMINATE = 0x00
    UUID = 0x01
    DTMF = 0x03
    AUDIO_8K = 0x10
    AUDIO_12K = 0x11
    AUDIO_16K = 0x12
    AUDIO_24K = 0x13
    AUDIO_32K = 0x14
    AUDIO_44K = 0x15
    AUDIO_48K = 0x16
    AUDIO_96K = 0x17
    AUDIO_192K = 0x18
    ERROR = 0xFF


SAMPLE_RATES = {
    AudioSocketType.AUDIO_8K: 8000,
    AudioSocketType.AUDIO_12K: 12000,
    AudioSocketType.AUDIO_16K: 16000,
    AudioSocketType.AUDIO_24K: 24000,
    AudioSocketType.AUDIO_32K: 32000,
    AudioSocketType.AUDIO_44K: 44100,
    AudioSocketType.AUDIO_48K: 48000,
    AudioSocketType.AUDIO_96K: 96000,
    AudioSocketType.AUDIO_192K: 192000,
}


@dataclass(frozen=True, slots=True)
class AudioSocketFrame:
    kind: AudioSocketType
    payload: bytes

    def encode(self) -> bytes:
        if len(self.payload) > 65535:
            raise ValueError(
                "Trama AudioSocket demasiado grande."
            )

        return (
            bytes([int(self.kind)])
            + len(self.payload).to_bytes(
                2,
                "big",
            )
            + self.payload
        )


async def read_frame(
    reader: asyncio.StreamReader,
) -> AudioSocketFrame:
    header = await reader.readexactly(3)

    try:
        kind = AudioSocketType(
            header[0]
        )
    except ValueError as error:
        raise ValueError(
            "Tipo AudioSocket desconocido: "
            f"0x{header[0]:02x}"
        ) from error

    length = int.from_bytes(
        header[1:3],
        "big",
    )

    payload = (
        await reader.readexactly(length)
        if length
        else b""
    )

    return AudioSocketFrame(
        kind=kind,
        payload=payload,
    )


async def write_frame(
    writer: asyncio.StreamWriter,
    kind: AudioSocketType,
    payload: bytes = b"",
) -> None:
    frame = AudioSocketFrame(
        kind=kind,
        payload=payload,
    )

    writer.write(frame.encode())

    await writer.drain()


def decode_uuid(
    payload: bytes,
) -> str:
    if len(payload) != 16:
        raise ValueError(
            "El UUID debe contener 16 bytes."
        )

    return str(
        uuid.UUID(bytes=payload)
    )


def decode_dtmf(
    payload: bytes,
) -> str:
    if len(payload) != 1:
        raise ValueError(
            "DTMF debe contener un carácter."
        )

    return payload.decode(
        "ascii",
        errors="strict",
    )
