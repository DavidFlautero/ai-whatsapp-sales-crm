from __future__ import annotations

import pytest

from voice_worker.pro.crm_outbox import CRMOutbox


@pytest.mark.asyncio
async def test_outbox_keeps_failed_delivery_for_retry(tmp_path) -> None:
    outbox = CRMOutbox(tmp_path / "voice.sqlite3", base_url="")
    await outbox.enqueue("tenant", "call.ended", {"session_id": "call"})
    result = await outbox.flush_once()
    assert result == {"selected": 1, "delivered": 0, "failed": 1}
    stats = await outbox.stats()
    assert stats["pending"] == 1
