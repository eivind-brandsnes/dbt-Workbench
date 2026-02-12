from __future__ import annotations

import asyncio
import json
import logging
import subprocess
import time
from dataclasses import dataclass
from typing import Any, AsyncIterator, Dict, Optional, Tuple

import httpx

from app.core.config import Settings, get_settings
from app.services.ai.provider_base import AiEvent, AiProvider, AiProviderRequest

logger = logging.getLogger(__name__)


@dataclass
class LocalProcessHandle:
    process: subprocess.Popen[str]
    last_used_monotonic: float


class McpProvider(AiProvider):
    _local_processes: Dict[Tuple[int, int], LocalProcessHandle] = {}

    def __init__(
        self,
        *,
        workspace_id: int,
        mcp_server_id: int,
        server_mode: str,
        server_config: Dict[str, Any],
        secret_values: Dict[str, str],
        settings: Optional[Settings] = None,
    ):
        self.workspace_id = workspace_id
        self.mcp_server_id = mcp_server_id
        self.server_mode = server_mode
        self.server_config = server_config or {}
        self.secret_values = secret_values
        self.settings = settings or get_settings()

    async def stream_chat(self, request: AiProviderRequest) -> AsyncIterator[AiEvent]:
        text = await self._invoke(request)
        for chunk in self._chunk(text):
            yield AiEvent(event="token", data={"text": chunk})

    async def _invoke(self, request: AiProviderRequest) -> str:
        self._reap_idle_processes()

        payload = {
            "prompt": request.prompt,
            "messages": request.messages,
            "context": request.context,
            "workspace_id": request.workspace_id,
            "conversation_id": request.conversation_id,
        }

        if self.server_mode == "remote_http":
            return await self._invoke_remote_http(payload)
        if self.server_mode == "remote_sse":
            return await self._invoke_remote_sse(payload)
        if self.server_mode == "local_stdio":
            return await self._invoke_local_stdio(payload)

        raise RuntimeError(f"Unsupported MCP server mode: {self.server_mode}")

    async def _invoke_remote_http(self, payload: Dict[str, Any]) -> str:
        url = self.server_config.get("url")
        if not url:
            raise RuntimeError("MCP remote HTTP server missing URL")

        method = str(self.server_config.get("method") or "POST").upper()
        headers = self._build_headers()

        async with httpx.AsyncClient(timeout=self.settings.ai_mcp_connect_timeout_seconds) as client:
            if method == "GET":
                response = await client.get(url, headers=headers, params={"payload": json.dumps(payload)})
            else:
                response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()

        try:
            data = response.json()
        except Exception:
            return response.text

        return str(data.get("text") or data.get("response") or data)

    async def _invoke_remote_sse(self, payload: Dict[str, Any]) -> str:
        # Best-effort compatibility: try HTTP POST expecting JSON, then fallback to raw text.
        url = self.server_config.get("url")
        if not url:
            raise RuntimeError("MCP remote SSE server missing URL")

        headers = self._build_headers()
        headers.setdefault("Accept", "text/event-stream,application/json")

        async with httpx.AsyncClient(timeout=self.settings.ai_mcp_connect_timeout_seconds) as client:
            response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()

        content_type = response.headers.get("content-type", "")
        if "application/json" in content_type:
            data = response.json()
            return str(data.get("text") or data.get("response") or data)

        text_out: list[str] = []
        for line in response.text.splitlines():
            if line.startswith("data:"):
                text_out.append(line[5:].strip())
        return "\n".join(text_out) if text_out else response.text

    async def _invoke_local_stdio(self, payload: Dict[str, Any]) -> str:
        template_key = self.server_config.get("template_key")
        if not template_key:
            raise RuntimeError("MCP local stdio config requires template_key")

        template = self._local_allowlist().get(template_key)
        if not isinstance(template, dict):
            raise RuntimeError(f"Template '{template_key}' is not allowlisted")

        command = template.get("command")
        if not isinstance(command, list) or not command or not all(isinstance(item, str) for item in command):
            raise RuntimeError(f"Allowlist template '{template_key}' has invalid command")

        requested_args = self.server_config.get("args") or []
        if not isinstance(requested_args, list) or not all(isinstance(item, str) for item in requested_args):
            raise RuntimeError("Local MCP args must be a list of strings")

        allowed_args = template.get("allowed_args")
        if isinstance(allowed_args, list):
            disallowed = [arg for arg in requested_args if arg not in allowed_args]
            if disallowed:
                raise RuntimeError(f"Local MCP args not allowlisted: {disallowed}")

        proc = self._ensure_local_process(command + requested_args)

        try:
            response_line = await asyncio.wait_for(
                asyncio.to_thread(self._invoke_local_blocking, proc, payload),
                timeout=self.settings.ai_mcp_connect_timeout_seconds,
            )
        except asyncio.TimeoutError as exc:
            self._terminate_process(proc)
            raise RuntimeError("Timed out waiting for local MCP server response") from exc

        if not response_line:
            raise RuntimeError("Local MCP server returned empty response")

        try:
            data = json.loads(response_line)
            return str(data.get("text") or data.get("response") or data)
        except Exception:
            return response_line.strip()

    def _build_headers(self) -> Dict[str, str]:
        headers = {}
        configured = self.server_config.get("headers") or {}
        if isinstance(configured, dict):
            headers.update({str(k): str(v) for k, v in configured.items()})

        header_secrets = self.server_config.get("header_secrets") or []
        if isinstance(header_secrets, list):
            for item in header_secrets:
                if not isinstance(item, dict):
                    continue
                name = item.get("header")
                secret_key = item.get("secret_key")
                if name and secret_key and secret_key in self.secret_values:
                    headers[str(name)] = self.secret_values[secret_key]

        return headers

    def _local_allowlist(self) -> Dict[str, Any]:
        raw = self.settings.ai_mcp_local_allowlist_json or "{}"
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            logger.warning("Failed to parse AI_MCP_LOCAL_ALLOWLIST_JSON; defaulting to empty allowlist")
        return {}

    def _ensure_local_process(self, command: list[str]) -> subprocess.Popen[str]:
        key = (self.workspace_id, self.mcp_server_id)
        handle = self._local_processes.get(key)
        if handle and handle.process.poll() is None:
            handle.last_used_monotonic = time.monotonic()
            return handle.process

        process = subprocess.Popen(
            command,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            shell=False,
            bufsize=1,
        )
        self._local_processes[key] = LocalProcessHandle(
            process=process,
            last_used_monotonic=time.monotonic(),
        )
        return process

    def _invoke_local_blocking(self, proc: subprocess.Popen[str], payload: Dict[str, Any]) -> str:
        if proc.stdin is None or proc.stdout is None:
            raise RuntimeError("Local MCP process missing stdio handles")
        proc.stdin.write(json.dumps(payload) + "\n")
        proc.stdin.flush()
        line = proc.stdout.readline()
        self._local_processes[(self.workspace_id, self.mcp_server_id)].last_used_monotonic = time.monotonic()
        return line

    def _reap_idle_processes(self) -> None:
        now = time.monotonic()
        ttl = max(30, self.settings.ai_mcp_process_idle_ttl_seconds)
        for key, handle in list(self._local_processes.items()):
            if handle.process.poll() is not None:
                self._local_processes.pop(key, None)
                continue
            if now - handle.last_used_monotonic > ttl:
                self._terminate_process(handle.process)
                self._local_processes.pop(key, None)

    def _terminate_process(self, proc: subprocess.Popen[str]) -> None:
        if proc.poll() is not None:
            return
        proc.terminate()
        try:
            proc.wait(timeout=2)
        except subprocess.TimeoutExpired:
            proc.kill()

    def _chunk(self, text: str, size: int = 48):
        for i in range(0, len(text), size):
            yield text[i : i + size]
