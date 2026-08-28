import asyncio
import uuid

import pytest

from voice_worker.audiosocket_protocol import AudioSocketFrame
from voice_worker.audiosocket_protocol import AudioSocketType
from voice_worker.audiosocket_protocol import decode_uuid
from voice_worker.audiosocket_protocol import read_frame


def test_encode_audio() -> None:
    payload = b"\x01\x02\x03\x04"

    encoded = AudioSocketFrame(
        AudioSocketType.AUDIO_8K,
        payload,
    ).encode()

    assert encoded == (
        b"\x10\x00\x04"
        + payload
    )


def test_uuid() -> None:
    value = uuid.uuid4()

    assert decode_uuid(
        value.bytes
    ) == str(value)


@pytest.mark.asyncio
async def test_read_dtmf() -> None:
    reader = asyncio.StreamReader()

    reader.feed_data(
        b"\x03\x00\x01#"
    )

    reader.feed_eof()

    frame = await read_frame(reader)

    assert frame.kind is AudioSocketType.DTMF
    assert frame.payload == b"#"
