from __future__ import annotations

from typing import AsyncIterator

import httpx

from app.services.ai.provider_base import AiEvent, AiProvider, AiProviderRequest


class GeminiProvider(AiProvider):
    def __init__(self, api_key: str | None, timeout_seconds: int = 45):
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds

    async def stream_chat(self, request: AiProviderRequest) -> AsyncIterator[AiEvent]:
        model = request.model_name or "gemini-1.5-flash"
        if not self.api_key:
            text = self._fallback_text(request.prompt)
            for chunk in self._chunk(text):
                yield AiEvent(event="token", data={"text": chunk})
            return

        contents = [{"role": "user", "parts": [{"text": request.prompt}]}]
        payload = {"contents": contents}
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(url, params={"key": self.api_key}, json=payload)
            response.raise_for_status()
            data = response.json()
            candidates = data.get("candidates", [])
            text_parts: list[str] = []
            for candidate in candidates:
                content = candidate.get("content", {}) if isinstance(candidate, dict) else {}
                for part in content.get("parts", []) if isinstance(content, dict) else []:
                    if isinstance(part, dict) and part.get("text"):
                        text_parts.append(part["text"])
            text = "\n".join(text_parts) if text_parts else self._fallback_text(request.prompt)
        except Exception:
            text = self._fallback_text(request.prompt)

        for chunk in self._chunk(text):
            yield AiEvent(event="token", data={"text": chunk})

    def _fallback_text(self, prompt: str) -> str:
        return (
            "Gemini provider is not configured or unavailable. "
            "This is a local fallback response for prompt: "
            f"{prompt[:500]}"
        )

    def _chunk(self, text: str, size: int = 48):
        for i in range(0, len(text), size):
            yield text[i : i + size]
