"""Investigation orchestrator: Meta model tool-calling loop.

The client is injected, so tests run a scripted fake while production uses
the Meta Model API (OpenAI-compatible). The openai package is imported lazily
so the finance tools and verifier never depend on it.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field

from .prompts import REPAIR_PROMPT, SYSTEM_PROMPT
from .tools import TOOL_SCHEMAS, ToolContext, run_tool


@dataclass
class InvestigationResult:
    question: str
    steps: list[dict] = field(default_factory=list)
    findings: list[dict] = field(default_factory=list)
    recommended_actions: list[dict] = field(default_factory=list)
    narrative: str = ""
    completed: bool = False

    def to_dict(self) -> dict:
        return {
            "question": self.question,
            "steps": self.steps,
            "findings": self.findings,
            "recommended_actions": self.recommended_actions,
            "narrative": self.narrative,
            "completed": self.completed,
        }


class MetaClient:
    """Thin wrapper over the Meta Model API chat endpoint."""

    def __init__(
        self,
        model: str | None = None,
        base_url: str | None = None,
        api_key: str | None = None,
        max_tokens: int = 8000,
    ):
        self.model = model or os.getenv("MODEL_NAME", "muse-spark-1.3")
        self.base_url = base_url or os.getenv("META_API_BASE_URL", "https://api.meta.ai/v1")
        self.api_key = api_key or os.getenv("MODEL_API_KEY", "")
        self.max_tokens = max_tokens

    def chat(self, messages: list[dict], tools: list[dict]) -> dict:
        from openai import OpenAI  # lazy: keeps core testable without the SDK

        if not self.api_key:
            raise RuntimeError("MODEL_API_KEY is not set")
        client = OpenAI(base_url=self.base_url, api_key=self.api_key)
        response = client.chat.completions.create(
            model=self.model, messages=messages, tools=tools or None, max_tokens=self.max_tokens
        )
        message = response.choices[0].message
        tool_calls = []
        for call in message.tool_calls or []:
            tool_calls.append(
                {"id": call.id, "name": call.function.name, "arguments": json.loads(call.function.arguments)}
            )
        return {"content": message.content, "tool_calls": tool_calls}


def run_investigation(
    question: str, ctx: ToolContext, client, max_steps: int = 8
) -> InvestigationResult:
    result = InvestigationResult(question=question)
    messages: list[dict] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": question},
    ]

    for _ in range(max_steps):
        reply = client.chat(messages, TOOL_SCHEMAS)
        tool_calls = reply.get("tool_calls") or []
        messages.append(
            {
                "role": "assistant",
                "content": reply.get("content") or "",
                "tool_calls": [
                    {
                        "id": c["id"],
                        "type": "function",
                        "function": {"name": c["name"], "arguments": json.dumps(c["arguments"])},
                    }
                    for c in tool_calls
                ]
                or None,
            }
        )
        if not tool_calls:
            if _finish(result, reply.get("content") or ""):
                return result
            # One repair turn, no tools: ask for the JSON object again.
            messages.append({"role": "user", "content": REPAIR_PROMPT})
            repair = client.chat(messages, [])
            if _finish(result, repair.get("content") or ""):
                return result
            result.narrative = repair.get("content") or reply.get("content") or ""
            return result
        for call in tool_calls:
            output = run_tool(ctx, call["name"], call["arguments"])
            result.steps.append(
                {
                    "tool": call["name"],
                    "args": call["arguments"],
                    "status": output.get("status"),
                    "evidence_ids": output.get("evidence_ids", []),
                }
            )
            messages.append(
                {"role": "tool", "tool_call_id": call["id"], "content": json.dumps(output, default=str)}
            )

    result.narrative = "Step budget exhausted before the agent concluded."
    return result


def _extract_json(content: str) -> str:
    """Tolerate markdown-fenced or prose-wrapped final answers."""
    text = (content or "").strip()
    if "```" in text:
        start = text.find("```")
        end = text.rfind("```")
        if end > start:
            inner = text[start:end].split("\n", 1)
            text = inner[1] if len(inner) > 1 else inner[0]
            text = text.strip()
    if not text.startswith("{"):
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end > start:
            text = text[start : end + 1]
    return text


def _finish(result: InvestigationResult, content: str) -> bool:
    try:
        final = json.loads(_extract_json(content))
    except (json.JSONDecodeError, AttributeError, TypeError):
        return False
    if not isinstance(final, dict) or "findings" not in final:
        return False
    result.findings = final.get("findings", [])
    result.recommended_actions = final.get("recommended_actions", [])
    result.completed = True
    return True
