"""The ONE shared LLM client.

All build-path LLM calls go through this. Small local models emit messy
JSON; salvage_json is the consolidated repair pipeline (behaviors ported
from MiroFish's three divergent copies).
"""

import json
import logging
import re

from openai import OpenAI

from app.core.profiles import EndpointProfile

logger = logging.getLogger(__name__)

# Reasoning models emit their working in one of two shapes, and which one you
# get depends on the server rather than the model. Both are handled.
#
#   1. Inline, wrapped in a tag inside the normal content.
#   2. Out of band, in a separate message field, leaving content as the answer.
#
# Tag names are not standardised, so several spellings are matched. The
# unclosed variant matters because a response truncated mid-reasoning has an
# opening tag and no closing one, and without this the whole answer would be
# treated as reasoning and discarded.
_REASONING_TAGS = ("think", "thinking", "reason", "reasoning", "scratchpad")
_REASONING_BLOCK_RE = re.compile(
    r"<(?:%s)\b[^>]*>.*?</(?:%s)\s*>" % ("|".join(_REASONING_TAGS), "|".join(_REASONING_TAGS)),
    re.DOTALL | re.IGNORECASE,
)
_UNCLOSED_REASONING_RE = re.compile(
    r"^\s*<(?:%s)\b[^>]*>.*\Z" % "|".join(_REASONING_TAGS), re.DOTALL | re.IGNORECASE
)
# Fields servers use for out-of-band reasoning.
_REASONING_FIELDS = ("reasoning_content", "reasoning")

_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)


def strip_reasoning(text: str) -> str:
    """Remove inline reasoning blocks, leaving the answer.

    A response that is *only* an unclosed reasoning block is left alone: there
    is no answer to recover, and returning empty would turn a truncated
    response into a silent one.
    """
    if not text:
        return ""
    cleaned = _REASONING_BLOCK_RE.sub("", text)
    if cleaned.strip():
        return cleaned.strip()
    if _UNCLOSED_REASONING_RE.match(text):
        return text.strip()
    return cleaned.strip()


def _strip_noise(text: str) -> str:
    text = strip_reasoning(text)
    fence = _FENCE_RE.search(text)
    if fence:
        text = fence.group(1)
    return text.strip()


def _extract_payload(text: str) -> str | None:
    """Return the first bracket-balanced {...} or [...] span in text.

    Walks from the earliest { or [ bracket, tracks nesting depth (respecting
    quoted strings and escapes), and returns the substring up to the matching
    close bracket. Falls back to returning the remainder from that bracket if
    no balanced span is found (truncated input gets repaired downstream).
    """
    starts = [i for i in (text.find("{"), text.find("[")) if i != -1]
    if not starts:
        return None
    start = min(starts)
    depth = 0
    in_string = False
    escaped = False
    for i, ch in enumerate(text[start:], start):
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch in "{[":
            depth += 1
        elif ch in "}]":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    # No balanced close found — return remainder for _repair_truncated
    return text[start:]


def _repair_truncated(payload: str) -> str:
    """Close unterminated strings/brackets in a truncated JSON payload."""
    stack = []
    in_string = False
    escaped = False
    for ch in payload:
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch in "{[":
            stack.append("}" if ch == "{" else "]")
        elif ch in "}]" and stack:
            stack.pop()
    repaired = payload
    if in_string:
        repaired += '"'
    repaired = re.sub(r",\s*$", "", repaired)
    return repaired + "".join(reversed(stack))


def salvage_json(raw: str):
    """Parse JSON out of messy LLM output. Raises ValueError if hopeless."""
    text = _strip_noise(raw)
    for candidate in (text, _extract_payload(text)):
        if not candidate:
            continue
        for attempt in (candidate, _repair_truncated(candidate)):
            try:
                return json.loads(attempt)
            except json.JSONDecodeError:
                continue
    raise ValueError(f"unsalvageable JSON (first 200 chars): {raw[:200]!r}")


def _reasoning_request_hints(mode: str) -> dict:
    """Best-effort request parameters asking a server to limit reasoning.

    There is no portable way to do this. Each known spelling is sent together,
    since servers that do not recognise one generally ignore it; a server that
    rejects the lot is handled by retrying without them. Do not rely on this
    working: output-side stripping is what actually guarantees the behaviour.
    """
    if mode == "auto":
        return {}
    if mode == "off":
        return {
            # OpenRouter
            "reasoning": {"enabled": False, "exclude": True},
            # llama.cpp, vLLM, LM Studio and other chat-template servers
            "chat_template_kwargs": {"enable_thinking": False},
        }
    return {
        "reasoning": {"effort": mode},
        "reasoning_effort": mode,
    }


def _message_reasoning(message) -> str:
    """Out-of-band reasoning text, if the server returned any."""
    for field in _REASONING_FIELDS:
        value = getattr(message, field, None)
        if isinstance(value, str) and value.strip():
            return value
    return ""


def extract_answer(message, keep_reasoning: bool = False) -> str:
    """Pull the answer out of a response message.

    Handles both reasoning shapes. When a model puts everything in its
    reasoning field and leaves content empty, the reasoning is returned rather
    than an empty string, because a silent empty answer is far harder to
    diagnose than a verbose one.
    """
    content = getattr(message, "content", None) or ""
    reasoning = _message_reasoning(message)

    if keep_reasoning and reasoning and content.strip():
        return f"{reasoning.strip()}\n\n{content.strip()}"

    answer = strip_reasoning(content)
    if answer:
        return answer

    # Nothing usable in content. Fall back to the reasoning text so the caller
    # gets something to work with (and salvage_json can still find a payload).
    if reasoning:
        logger.info(
            "model returned no content, only reasoning; falling back to it"
        )
        return reasoning.strip()
    return ""


class LLMClient:
    def __init__(self, profile: EndpointProfile):
        self.profile = profile
        self.model = profile.model
        self.reasoning = getattr(profile, "reasoning", "auto")
        self._client = OpenAI(
            base_url=profile.base_url, api_key=profile.api_key or "none",
            max_retries=0,
        )

    def _create(self, kwargs: dict, extra_body: dict):
        """Call the endpoint, dropping unsupported extras rather than failing.

        Tries the full request, then without the reasoning hints, then without
        response_format. Each fallback is a real compatibility case: strict
        servers reject unknown top-level fields, and not every server
        implements JSON mode.
        """
        plain = {k: v for k, v in kwargs.items() if k != "response_format"}

        attempts = []
        if extra_body:
            attempts.append((kwargs, extra_body, "reasoning hints"))
        attempts.append((kwargs, {}, "json_mode" if "response_format" in kwargs else None))
        if "response_format" in kwargs:
            attempts.append((plain, {}, None))

        last_error = None
        for call_kwargs, body, drops_next in attempts:
            try:
                if body:
                    return self._client.chat.completions.create(
                        **call_kwargs, extra_body=body
                    )
                return self._client.chat.completions.create(**call_kwargs)
            except Exception as exc:
                last_error = exc
                if drops_next:
                    logger.info("endpoint rejected the call; retrying without %s", drops_next)
        raise last_error

    def chat(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        json_mode: bool = False,
        keep_reasoning: bool = False,
    ) -> str:
        kwargs = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        resp = self._create(kwargs, _reasoning_request_hints(self.reasoning))
        return extract_answer(resp.choices[0].message, keep_reasoning=keep_reasoning)

    def chat_json(
        self, messages: list[dict], temperature: float = 0.7
    ):
        return salvage_json(
            self.chat(messages, temperature=temperature, json_mode=True)
        )
