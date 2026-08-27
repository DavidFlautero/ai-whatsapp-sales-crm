from __future__ import annotations

import asyncio

import pytest

from voice_worker.pro.barge_in import PlaybackController


@pytest.mark.asyncio
async def test_barge_in_cancels_current_playback() -> None:
    stopped = []

    async def on_stop(generation: int) -> None:
        stopped.append(generation)

    controller = PlaybackController(on_stop)
    lease = await controller.acquire()

    async def playback() -> None:
        await asyncio.sleep(60)

    task = asyncio.create_task(playback())
    await controller.attach(lease, task)
    assert controller.speaking
    assert await controller.interrupt()
    assert task.cancelled()
    assert stopped
