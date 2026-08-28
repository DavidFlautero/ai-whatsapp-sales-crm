from __future__ import annotations

import pytest

from voice_worker.pro.memory import SessionMemoryStore


@pytest.mark.asyncio
async def test_memory_is_tenant_isolated_and_trimmed() -> None:
    store = SessionMemoryStore(max_messages=4)
    await store.get_or_create("call-1", "company-a")
    for index in range(8):
        await store.append("call-1", "user" if index % 2 == 0 else "assistant", str(index))
    memory = await store.get_or_create("call-1", "company-a")
    assert len(memory.messages) == 4
    with pytest.raises(PermissionError):
        await store.get_or_create("call-1", "company-b")
