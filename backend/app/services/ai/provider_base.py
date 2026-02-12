from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Dict, List, Optional, Protocol


@dataclass
class AiProviderRequest:
    prompt: str
    conversation_id: int
    workspace_id: int
    provider_mode: str
    provider_name: str
    model_name: Optional[str]
    context: Dict[str, Any] = field(default_factory=dict)
    messages: List[Dict[str, str]] = field(default_factory=list)


@dataclass
class AiEvent:
    event: str
    data: Dict[str, Any]


class AiProvider(Protocol):
    async def stream_chat(self, request: AiProviderRequest) -> AsyncIterator[AiEvent]:
        ...
