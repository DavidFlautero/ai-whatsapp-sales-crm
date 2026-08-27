from __future__ import annotations

import wave

import pytest

from voice_worker.pro.recording import CallRecorder


@pytest.mark.asyncio
async def test_recording_writes_two_isolated_channels(tmp_path) -> None:
    recorder = CallRecorder(
        tmp_path,
        session_id="call-1",
        company_id="tenant",
        enabled=True,
        consent_basis="Consentimiento informado durante la llamada.",
    )
    await recorder.inbound(b"\x01\x00" * 160)
    await recorder.outbound(b"\x02\x00" * 160)
    manifest = await recorder.close()
    assert manifest is not None
    assert manifest.inbound_sha256 != manifest.outbound_sha256
    with wave.open(manifest.inbound_path, "rb") as handle:
        assert handle.getframerate() == 16_000


@pytest.mark.asyncio
async def test_disabled_recording_writes_nothing(tmp_path) -> None:
    recorder = CallRecorder(tmp_path, session_id="call", company_id="tenant", enabled=False)
    await recorder.inbound(b"\x00\x00")
    assert await recorder.close() is None
    assert list(tmp_path.rglob("*.wav")) == []
