from __future__ import annotations

import asyncio
import uuid

import pytest

from voice_worker.pro.telephony_protocol import (
    AudioSocketCodec,
    AudioSocketProtocolError,
    AudioSocketType,
    uuid_message,
)


@pytest.mark.asyncio
async def test_audiosocket_roundtrip() -> None:
    reader = asyncio.StreamReader()
    reader.feed_data(AudioSocketCodec.encode(AudioSocketType.AUDIO_8K, b"\x01\x02"))
    reader.feed_eof()
    message = await AudioSocketCodec.read(reader)
    assert message.type == AudioSocketType.AUDIO_8K
    assert message.sample_rate == 8_000
    assert message.payload == b"\x01\x02"


@pytest.mark.asyncio
async def test_audiosocket_rejects_unknown_type() -> None:
    reader = asyncio.StreamReader()
    reader.feed_data(b"\x99\x00\x00")
    reader.feed_eof()
    with pytest.raises(AudioSocketProtocolError):
        await AudioSocketCodec.read(reader)


def test_uuid_message_uses_binary_uuid() -> None:
    session_id = str(uuid.uuid4())
    packet = uuid_message(session_id)
    assert packet[0] == AudioSocketType.UUID
    assert packet[3:] == uuid.UUID(session_id).bytes
