from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any

import httpx

from .advanced_config import AdvancedSettings


logger = logging.getLogger(
    "voice.callbacks"
)


@dataclass(frozen=True, slots=True)
class VoiceCallback:
    kind: str
    company_id: str
    call_id: str
    sequence: int
    payload: dict[str, Any]


class CallbackClient:
    def __init__(
        self,
        settings: AdvancedSettings,
    ) -> None:
        self.url = settings.callback_url
        self.token = settings.callback_token
        self.timeout = (
            settings.callback_timeout_seconds
        )
        self.client: httpx.AsyncClient | None = None

    @property
    def enabled(self) -> bool:
        return bool(self.url)

    async def start(self) -> None:
        if (
            self.enabled
            and self.client is None
        ):
            self.client = httpx.AsyncClient(
                timeout=self.timeout
            )

    async def close(self) -> None:
        if self.client is not None:
            await self.client.aclose()
            self.client = None

    async def emit(
        self,
        callback: VoiceCallback,
    ) -> None:
        if not self.enabled:
            return

        if self.client is None:
            await self.start()

        assert self.client is not None

        headers = {
            "content-type": "application/json",
        }

        if self.token:
            headers["authorization"] = (
                f"Bearer {self.token}"
            )

        body = {
            "kind": callback.kind,
            "company_id": callback.company_id,
            "call_id": callback.call_id,
            "sequence": callback.sequence,
            "payload": callback.payload,
        }

        for attempt in range(3):
            try:
                response = await self.client.post(
                    self.url,
                    json=body,
                    headers=headers,
                )

                response.raise_for_status()
                return

            except Exception as error:
                if attempt == 2:
                    logger.warning(
                        "callback_failed kind=%s error=%s",
                        callback.kind,
                        error,
                    )
                    return

                await asyncio.sleep(
                    0.25 * (2 ** attempt)
                )
