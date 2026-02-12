from __future__ import annotations

from typing import AsyncIterator

import httpx

from app.services.ai.provider_base import AiEvent, AiProvider, AiProviderRequest


class OpenAIProvider(AiProvider):
    def __init__(self, api_key: str | None, timeout_seconds: int = 45):
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds

    async def stream_chat(self, request: AiProviderRequest) -> AsyncIterator[AiEvent]:
        model = request.model_name or "gpt-4o-mini"
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
            "messages": messages,
            "temperature": 0.2,
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers=headers,
                    json=payload,
                )
            response.raise_for_status()
            data = response.json()
            text = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
            )
            if not text:
                text = self._fallback_text(request.prompt)
        except Exception:
            text = self._fallback_text(request.prompt)

        for chunk in self._chunk(text):
            yield AiEvent(event="token", data={"text": chunk})

    def _fallback_text(self, prompt: str) -> str:
        return (
            "OpenAI provider is not configured or unavailable. "
            "This is a local fallback response for prompt: "
            f"{prompt[:500]}"
        )

    def _chunk(self, text: str, size: int = 48):
        for i in range(0, len(text), size):
            yield text[i : i + size]
