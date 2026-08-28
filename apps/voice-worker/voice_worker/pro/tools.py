from __future__ import annotations

import inspect
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

import httpx

from .contracts import ToolResult
from .telemetry import metrics


ToolHandler = Callable[[dict[str, Any]], Awaitable[dict[str, Any]] | dict[str, Any]]


@dataclass(slots=True, frozen=True)
class ToolDefinition:
    name: str
    description: str
    input_schema: dict[str, Any]
    handler: ToolHandler
    timeout_seconds: float = 8.0


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, ToolDefinition] = {}

    def register(self, definition: ToolDefinition) -> None:
        if definition.name in self._tools:
            raise ValueError(f"La herramienta {definition.name} ya está registrada.")
        self._tools[definition.name] = definition

    def schemas(self) -> list[dict[str, Any]]:
        return [
            {
                "name": tool.name,
                "description": tool.description,
                "input_schema": tool.input_schema,
            }
            for tool in self._tools.values()
        ]

    async def execute(self, name: str, arguments: dict[str, Any]) -> ToolResult:
        tool = self._tools.get(name)
        if tool is None:
            return ToolResult(name=name, ok=False, content={}, latency_ms=0.0, error="Herramienta desconocida")
        started = time.perf_counter()
        try:
            import asyncio

            value = tool.handler(arguments)
            if inspect.isawaitable(value):
                content = await asyncio.wait_for(value, timeout=tool.timeout_seconds)
            else:
                content = value
            latency = (time.perf_counter() - started) * 1000
            metrics.observe(f"tool_{name}_latency_ms", latency)
            metrics.increment(f"tool_{name}_success")
            return ToolResult(name=name, ok=True, content=content, latency_ms=latency)
        except Exception as exc:
            latency = (time.perf_counter() - started) * 1000
            metrics.increment(f"tool_{name}_error")
            return ToolResult(name=name, ok=False, content={}, latency_ms=latency, error=str(exc))


class CRMToolGateway:
    def __init__(self, base_url: str, token: str, company_id: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.company_id = company_id
        self.timeout = httpx.Timeout(8.0, connect=3.0)

    async def _request(self, method: str, path: str, *, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        headers = {
            "accept": "application/json",
            "x-company-id": self.company_id,
        }
        if self.token:
            headers["authorization"] = f"Bearer {self.token}"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.request(method, f"{self.base_url}{path}", headers=headers, json=payload)
        response.raise_for_status()
        value = response.json()
        if not isinstance(value, dict):
            return {"data": value}
        return value

    async def search_product(self, arguments: dict[str, Any]) -> dict[str, Any]:
        query = str(arguments.get("query") or "").strip()
        if len(query) < 2:
            raise ValueError("El producto está vacío.")
        return await self._request("POST", "/internal/voice/catalog/search", payload={"query": query, "limit": 5})

    async def quote(self, arguments: dict[str, Any]) -> dict[str, Any]:
        return await self._request("POST", "/internal/voice/quotes", payload=arguments)

    async def request_human(self, arguments: dict[str, Any]) -> dict[str, Any]:
        return await self._request("POST", "/internal/voice/handoffs", payload=arguments)

    def registry(self) -> ToolRegistry:
        registry = ToolRegistry()
        registry.register(
            ToolDefinition(
                name="buscar_producto",
                description="Busca coincidencias reales de producto, stock, lotes y vencimientos.",
                input_schema={
                    "type": "object",
                    "properties": {"query": {"type": "string"}},
                    "required": ["query"],
                    "additionalProperties": False,
                },
                handler=self.search_product,
            )
        )
        registry.register(
            ToolDefinition(
                name="crear_cotizacion",
                description="Genera una cotización usando precio autorizado y cantidad confirmada.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "product_id": {"type": "string"},
                        "quantity": {"type": "number", "exclusiveMinimum": 0},
                        "customer_id": {"type": "string"},
                    },
                    "required": ["product_id", "quantity"],
                    "additionalProperties": False,
                },
                handler=self.quote,
            )
        )
        registry.register(
            ToolDefinition(
                name="transferir_humano",
                description="Solicita intervención humana conservando llamada, contexto y transcripción.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "reason": {"type": "string"},
                        "priority": {"type": "string", "enum": ["normal", "high", "urgent"]},
                    },
                    "required": ["reason"],
                    "additionalProperties": False,
                },
                handler=self.request_human,
            )
        )
        return registry
