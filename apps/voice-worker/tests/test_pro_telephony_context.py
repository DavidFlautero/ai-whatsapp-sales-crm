from __future__ import annotations

import pytest

from voice_worker.pro.telephony_context import TelephonyContextStore


@pytest.mark.asyncio
async def test_context_is_single_use(tmp_path) -> None:
    store = TelephonyContextStore(tmp_path / "voice.sqlite3")
    context = await store.create(
        company_id="tenant",
        contact_phone="+573001234567",
        direction="inbound",
        recording_enabled=True,
        recording_consent="El cliente fue informado y aceptó la grabación.",
    )
    assert await store.consume(context.session_id) is not None
    assert await store.consume(context.session_id) is None


@pytest.mark.asyncio
async def test_recording_context_requires_consent(tmp_path) -> None:
    store = TelephonyContextStore(tmp_path / "voice.sqlite3")
    with pytest.raises(ValueError, match="consentimiento"):
        await store.create(
            company_id="tenant",
            contact_phone=None,
            direction="inbound",
            recording_enabled=True,
            recording_consent="sí",
        )
