from __future__ import annotations

from typing import AsyncIterator

import httpx

from app.services.ai.provider_base import AiEvent, AiProvider, AiProviderRequest


class AnthropicProvider(AiProvider):
    def __init__(self, api_key: str | None, timeout_seconds: int = 45):
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds

    async def stream_chat(self, request: AiProviderRequest) -> AsyncIterator[AiEvent]:
        model = request.model_name or "claude-3-5-sonnet-latest"
        if not self.api_key:
            text = self._fallback_text(request.prompt)
            for chunk in self._chunk(text):
                yield AiEvent(event="token", data={"text": chunk})
            return

        messages = list(request.messages)
        if not messages:
            messages = [{"role": "user", "content": request.prompt}]

        payload = {
            "model": model,
            "max_tokens": 1024,
            "messages": messages,
        }
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers=headers,
                    json=payload,
                )
            response.raise_for_status()
            data = response.json()
            content_blocks = data.get("content", [])
            text = "".join(block.get("text", "") for block in content_blocks if isinstance(block, dict))
            if not text:
                text = self._fallback_text(request.prompt)
        except Exception:
            text = self._fallback_text(request.prompt)

        for chunk in self._chunk(text):
            yield AiEvent(event="token", data={"text": chunk})

    def _fallback_text(self, prompt: str) -> str:
        return (
            "Anthropic provider is not configured or unavailable. "
            "This is a local fallback response for prompt: "
            f"{prompt[:500]}"
        )

    def _chunk(self, text: str, size: int = 48):
        for i in range(0, len(text), size):
            yield text[i : i + size]
