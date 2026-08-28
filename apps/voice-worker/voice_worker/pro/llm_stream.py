from __future__ import annotations

import json
import os
from collections.abc import AsyncIterator
from typing import Protocol

import httpx

from .contracts import VoiceRuntimeError
from .memory import ConversationMemory
from .telemetry import metrics


class StreamingLanguageModel(Protocol):
    async def stream_reply(self, memory: ConversationMemory, *, system_prompt: str) -> AsyncIterator[str]:
        ...


class AnthropicStreamingLLM:
    def __init__(
        self,
        *,
        model: str,
        api_key: str | None = None,
        max_tokens: int = 300,
        timeout_seconds: int = 25,
        base_url: str = "https://api.anthropic.com",
    ) -> None:
        self.model = model
        self.api_key = (api_key or os.getenv("ANTHROPIC_API_KEY", "")).strip()
        self.max_tokens = max_tokens
        self.timeout = httpx.Timeout(timeout_seconds, connect=min(10, timeout_seconds))
        self.base_url = base_url.rstrip("/")

    async def stream_reply(self, memory: ConversationMemory, *, system_prompt: str) -> AsyncIterator[str]:
        if not self.api_key:
            raise VoiceRuntimeError("LLM_KEY_MISSING", "Falta ANTHROPIC_API_KEY.")
        messages = memory.anthropic_messages()
        if not messages or messages[-1]["role"] != "user":
            raise VoiceRuntimeError("LLM_CONTEXT_INVALID", "La conversación no termina con un mensaje del cliente.")

        payload = {
            "model": self.model,
            "max_tokens": self.max_tokens,
            "system": system_prompt,
            "messages": messages,
            "stream": True,
        }
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        yielded = False
        with metrics.timer("llm_stream_total_ms"):
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                try:
                    async with client.stream(
                        "POST",
                        f"{self.base_url}/v1/messages",
                        headers=headers,
                        json=payload,
                    ) as response:
                        if response.status_code >= 400:
                            body = (await response.aread()).decode("utf-8", errors="replace")[:500]
                            raise VoiceRuntimeError(
                                "LLM_HTTP_ERROR",
                                f"Anthropic respondió {response.status_code}: {body}",
                                retryable=response.status_code >= 500 or response.status_code == 429,
                            )
                        async for line in response.aiter_lines():
                            if not line.startswith("data:"):
                                continue
                            raw = line[5:].strip()
                            if not raw or raw == "[DONE]":
                                continue
                            try:
                                event = json.loads(raw)
                            except json.JSONDecodeError:
                                continue
                            if event.get("type") == "error":
                                error = event.get("error") or {}
                                raise VoiceRuntimeError(
                                    "LLM_STREAM_ERROR",
                                    str(error.get("message") or "Error desconocido en streaming."),
                                    retryable=True,
                                )
                            delta = event.get("delta") or {}
                            if event.get("type") == "content_block_delta" and delta.get("type") == "text_delta":
                                text = str(delta.get("text") or "")
                                if text:
                                    yielded = True
                                    yield text
                except httpx.TimeoutException as exc:
                    raise VoiceRuntimeError("LLM_TIMEOUT", "La IA superó el tiempo máximo.", retryable=True) from exc
                except httpx.HTTPError as exc:
                    raise VoiceRuntimeError("LLM_NETWORK", f"Falló la conexión con la IA: {exc}", retryable=True) from exc
        if not yielded:
            raise VoiceRuntimeError("LLM_EMPTY", "La IA devolvió una respuesta vacía.", retryable=True)


class DevelopmentEchoLLM:
    """Deterministic fallback used only by smoke tests and offline development."""

    async def stream_reply(self, memory: ConversationMemory, *, system_prompt: str) -> AsyncIterator[str]:
        del system_prompt
        user_messages = [message.content for message in memory.messages if message.role == "user"]
        text = user_messages[-1] if user_messages else "tu consulta"
        yield "Entendido. "
        yield f"Voy a revisar {text[:120]}."


def build_system_prompt(memory: ConversationMemory) -> str:
    customer_name = str(memory.customer.get("name") or "cliente")
    commercial_terms = memory.commerce.get("terms") or "no confirmadas"
    return "\n".join(
        [
            "Eres un agente telefónico profesional de ventas y atención.",
            f"Empresa: {memory.company_id}.",
            f"Cliente: {customer_name}.",
            f"Condiciones comerciales conocidas: {commercial_terms}.",
            f"Idioma actual: {memory.language}.",
            "Habla con naturalidad, en frases breves y completas.",
            "No vuelvas a saludar durante la misma llamada.",
            "No inventes inventario, precio, vencimiento, entrega ni condiciones.",
            "Cuando falte un dato, informa que lo verificarás y solicita intervención humana.",
            "Haz como máximo una pregunta necesaria por turno.",
            "Nunca leas markdown, símbolos técnicos ni JSON en voz alta.",
        ]
    )
