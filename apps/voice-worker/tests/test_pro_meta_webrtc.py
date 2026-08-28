from __future__ import annotations

import io
import wave

import pytest

pytest.importorskip("aiortc")
pytest.importorskip("av")

from voice_worker.pro.meta_webrtc import (
    PcmQueueAudioTrack,
    _filter_sdp_for_whatsapp,
)


def wav_silence(*, sample_rate: int = 22_050, duration_ms: int = 100) -> bytes:
    output = io.BytesIO()
    with wave.open(output, "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(sample_rate)
        handle.writeframes(b"\x00\x00" * round(sample_rate * duration_ms / 1000))
    return output.getvalue()


@pytest.mark.asyncio
async def test_outbound_track_converts_wav_to_webrtc_audio() -> None:
    track = PcmQueueAudioTrack()
    await track.enqueue_wav(wav_silence())
    frame = await track.recv()
    assert frame.sample_rate == 48_000
    assert frame.samples == 960
    assert frame.layout.name == "mono"
    assert frame.pts == 0
    second = await track.recv()
    assert second.pts == 960
    track.stop()


@pytest.mark.asyncio
async def test_outbound_track_clear_discards_pending_audio() -> None:
    track = PcmQueueAudioTrack()
    await track.enqueue_wav(wav_silence(duration_ms=200))
    track.clear()
    frame = await track.recv()
    assert bytes(frame.planes[0])[:1920] == b"\x00" * 1920
    track.stop()



def test_whatsapp_sdp_keeps_only_sha256() -> None:
    source = (
        "v=0\n"
        "s=-\n"
        "t=0 0\n"
        "m=audio 9 UDP/TLS/RTP/SAVPF 111\n"
        "a=fingerprint:sha-256 AA:BB:CC\n"
        "a=fingerprint:sha-384 DD:EE:FF\n"
        "a=fingerprint:sha-512 11:22:33\n"
        "a=setup:active\n"
        "a=sendrecv\n"
        "a=rtpmap:111 opus/48000/2\n"
    )

    filtered = _filter_sdp_for_whatsapp(
        source,
    )

    assert (
        "a=fingerprint:SHA-256 AA:BB:CC\r\n"
        in filtered
    )

    assert "sha-384" not in filtered.lower()
    assert "sha-512" not in filtered.lower()
    assert filtered.endswith("\r\n")


def test_whatsapp_sdp_filter_is_idempotent() -> None:
    source = (
        "v=0\r\n"
        "s=-\r\n"
        "t=0 0\r\n"
        "a=fingerprint:SHA-256 AA:BB:CC\r\n"
    )

    first = _filter_sdp_for_whatsapp(source)
    second = _filter_sdp_for_whatsapp(first)

    assert first == second
