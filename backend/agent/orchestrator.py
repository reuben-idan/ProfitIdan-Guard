"""Investigation orchestrator: Meta model tool-calling loop.

The client is injected, so tests run a scripted fake while production uses
the Meta Model API (OpenAI-compatible). The openai package is imported lazily
so the finance tools and verifier never depend on it.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field

from .prompts import REPAIR_PROMPT, SYSTEM_PROMPT
from .tools import TOOL_SCHEMAS, ToolContext, run_tool


def _clean(value: str) -> str:
    """Strip whitespace and stray quotes from pasted env values."""
    return (value or "").strip().strip("\"'").strip()


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
        # Dashboard-pasted values often carry stray whitespace or quotes,
        # which the model API rejects (e.g. a padded model id 404s).
        self.model = _clean(model or os.getenv("MODEL_NAME", "muse-spark-1.3"))
        self.base_url = _clean(base_url or os.getenv("META_API_BASE_URL", "https://api.meta.ai/v1"))
        self.api_key = _clean(api_key or os.getenv("MODEL_API_KEY", ""))
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
            # Two repair turns, no tools: quote the syntax error back so the
            # model can fix exactly what broke.
            _, _, error = _parse_final(reply.get("content") or "")
            last_content = reply.get("content") or ""
            for _ in range(2):
                messages.append({"role": "user", "content": _repair_prompt(error)})
                repair = client.chat(messages, [])
                last_content = repair.get("content") or ""
                if _finish(result, last_content):
                    return result
                _, _, error = _parse_final(last_content)
            result.narrative = _honest_narrative(last_content)
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
    findings, actions, _ = _parse_final(content)
    if findings is None:
        return False
    result.findings = findings
    result.recommended_actions = actions or []
    result.completed = True
    return True


def _repair_prompt(error: str | None) -> str:
    if not error:
        return REPAIR_PROMPT
    return f"{REPAIR_PROMPT} The syntax error in your last message was: {error[:200]}"


def _honest_narrative(content: str) -> str:
    """Narrative for an unparseable final answer: keep short human prose,
    never dump a JSON blob the UI would render as a wall of text."""
    text = (content or "").strip()
    if len(text) <= 500 and not text.startswith("{") and '"findings"' not in text:
        return text
    return (
        "The model did not return a readable final answer, so there are no "
        "findings to show. The tool steps above still ran — try Instant review "
        "for a deterministic answer from the same records."
    )


def _strip_controls(text: str) -> str:
    return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)


def _extract_balanced(text: str, start: int, open_ch: str, close_ch: str) -> str | None:
    """String-aware balanced-span extraction starting at an opener."""
    depth = 0
    in_string = False
    escaped = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
        elif ch == '"':
            in_string = True
        elif ch == open_ch:
            depth += 1
        elif ch == close_ch:
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None


def _salvage_array(text: str, key: str) -> list | None:
    """Parse one top-level array by key, tolerating corruption elsewhere."""
    match = re.search(rf'"{key}"\s*:', text)
    if not match:
        return None
    bracket = text.find("[", match.end())
    if bracket == -1:
        return None
    span = _extract_balanced(text, bracket, "[", "]")
    if span is None:
        return None
    try:
        value = json.loads(_strip_controls(span))
    except json.JSONDecodeError:
        return None
    return value if isinstance(value, list) else None


def _parse_final(content: str) -> tuple[list | None, list | None, str | None]:
    """Parse a final answer into (findings, actions, error).

    Tries whole-object parses first, then scans for an embedded object,
    then salvages each array independently so corruption between them
    (as seen in production) still yields verified findings.
    """
    text = content.strip() if isinstance(content, str) else ""
    if not text:
        return None, None, "empty response"
    candidates = [text, _extract_json(text)]
    candidates += [_strip_controls(c) for c in list(candidates)]
    error: str | None = "no JSON object with findings found"
    for candidate in candidates:
        try:
            final = json.loads(candidate)
        except json.JSONDecodeError as exc:
            error = str(exc)
            continue
        if isinstance(final, dict) and isinstance(final.get("findings"), list):
            actions = final.get("recommended_actions", [])
            return final["findings"], actions if isinstance(actions, list) else [], None
    decoder = json.JSONDecoder()
    for candidate in candidates:
        for match in re.finditer(r"\{", candidate):
            try:
                obj, _ = decoder.raw_decode(candidate[match.start() :])
            except json.JSONDecodeError as exc:
                error = str(exc)
                continue
            if isinstance(obj, dict) and isinstance(obj.get("findings"), list):
                actions = obj.get("recommended_actions", [])
                if not isinstance(actions, list) or not actions:
                    # Prefix hit (trailing corruption cut the object short):
                    # recover the actions array independently.
                    salvaged = _salvage_array(candidate, "recommended_actions")
                    if salvaged:
                        actions = salvaged
                return obj["findings"], actions if isinstance(actions, list) else [], None
    findings = _salvage_array(text, "findings")
    if findings is None:
        findings = _salvage_array(_extract_json(text), "findings")
    if findings is not None:
        actions = _salvage_array(text, "recommended_actions")
        return findings, actions if actions is not None else [], None
    return None, None, error
