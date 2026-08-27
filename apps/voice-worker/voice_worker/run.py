from __future__ import annotations

import asyncio

import uvicorn

from .advanced_config import settings
from .advanced_server import app
from .advanced_server import callbacks
from .advanced_server import runtime
from .audiosocket_server import AudioSocketServer


async def main() -> None:
    settings.validate()

    await callbacks.start()

    audio_socket = AudioSocketServer(
        runtime,
        callbacks,
    )

    await audio_socket.start()

    config = uvicorn.Config(
        app,
        host=settings.bind_host,
        port=settings.http_port,
        log_level="info",
        access_log=True,
        ws_ping_interval=20,
        ws_ping_timeout=20,
    )

    http_server = uvicorn.Server(
        config
    )

    telephony_task = asyncio.create_task(
        audio_socket.serve_forever(),
        name="audiosocket",
    )

    http_task = asyncio.create_task(
        http_server.serve(),
        name="voice-http",
    )

    try:
        completed, _ = await asyncio.wait(
            {
                telephony_task,
                http_task,
            },
            return_when=(
                asyncio.FIRST_COMPLETED
            ),
        )

        for task in completed:
            error = task.exception()

            if error is not None:
                raise error
    finally:
        http_server.should_exit = True
        telephony_task.cancel()

        await audio_socket.close()
        await callbacks.close()


if __name__ == "__main__":
    asyncio.run(main())
