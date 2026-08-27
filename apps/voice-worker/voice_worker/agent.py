from __future__ import annotations

import httpx


class ConversationAgent:
    def __init__(
        self,
        api_key: str | None,
        model: str,
    ) -> None:
        self.api_key = api_key
        self.model = model

    async def reply(
        self,
        text: str,
        company_id: str,
    ) -> str:
        if not self.api_key:
            raise RuntimeError(
                "ANTHROPIC_API_KEY no está configurada."
            )

        if not self.model:
            raise RuntimeError(
                "ANTHROPIC_MODEL no está configurado."
            )

        system_prompt = (
            "Eres un asistente telefónico comercial. "
            "Responde en español de forma clara, breve "
            "y natural. No hagas interrogatorios. "
            "Realiza una sola pregunta como máximo. "
            "Si no conoces un dato, indica que un humano "
            "continuará la atención. "
            f"Empresa actual: {company_id}."
        )

        async with httpx.AsyncClient(
            timeout=45,
        ) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": self.model,
                    "max_tokens": 220,
                    "system": system_prompt,
                    "messages": [
                        {
                            "role": "user",
                            "content": text,
                        }
                    ],
                },
            )

            response.raise_for_status()
            data = response.json()

        response_parts: list[str] = []

        for block in data.get("content", []):
            if block.get("type") != "text":
                continue

            block_text = str(
                block.get("text", "")
            ).strip()

            if block_text:
                response_parts.append(
                    block_text
                )

        result = " ".join(
            response_parts
        ).strip()

        if not result:
            raise RuntimeError(
                "Anthropic devolvió una respuesta vacía."
            )

        return result
