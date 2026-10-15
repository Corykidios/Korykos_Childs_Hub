"""Reasoning-model handling: output normalization and request hints.

Reasoning arrives in one of two shapes depending on the server: inline in a
tag inside content, or out of band in a separate message field. Both must
produce a clean answer, and neither may produce a silently empty one.
"""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.core.profiles import REASONING_MODES, EndpointProfile
from app.services.llm_client import (
    LLMClient,
    _reasoning_request_hints,
    extract_answer,
    salvage_json,
    strip_reasoning,
)


def _message(content=None, reasoning_content=None, reasoning=None):
    return SimpleNamespace(
        content=content, reasoning_content=reasoning_content, reasoning=reasoning
    )


# -- inline reasoning tags -------------------------------------------------


@pytest.mark.parametrize("tag", ["think", "thinking", "reason", "reasoning", "scratchpad"])
def test_inline_reasoning_tags_are_stripped(tag):
    assert strip_reasoning(f"<{tag}>working it out</{tag}>The answer is 42") == "The answer is 42"


def test_stripping_is_case_insensitive_and_survives_attributes():
    assert strip_reasoning('<THINK dur="2s">noise</THINK>answer') == "answer"


def test_multiple_reasoning_blocks_are_all_removed():
    assert strip_reasoning("<think>a</think>keep<think>b</think> this") == "keep this"


def test_content_without_reasoning_is_untouched():
    assert strip_reasoning("just an answer") == "just an answer"


def test_empty_content_stays_empty():
    assert strip_reasoning("") == ""
    assert strip_reasoning(None) == ""


def test_a_response_that_is_only_unclosed_reasoning_is_preserved():
    """Truncated mid-reasoning. Returning empty would hide the failure."""
    raw = "<think>I am still working and got cut off"
    assert strip_reasoning(raw) == raw


# -- out-of-band reasoning fields ------------------------------------------


def test_answer_comes_from_content_when_both_are_present():
    """The shape LM Studio returns: reasoning out of band, answer in content."""
    assert extract_answer(_message(content="\n\n391", reasoning_content="long working")) == "391"


@pytest.mark.parametrize("field", ["reasoning_content", "reasoning"])
def test_empty_content_falls_back_to_reasoning_rather_than_returning_blank(field):
    """A silently empty answer is much harder to diagnose than a verbose one."""
    message = _message(content="", **{field: "the model only produced this"})
    assert extract_answer(message) == "the model only produced this"


def test_whitespace_only_content_also_falls_back():
    assert extract_answer(_message(content="   \n ", reasoning_content="fallback")) == "fallback"


def test_nothing_anywhere_yields_empty_string():
    assert extract_answer(_message(content=None)) == ""


def test_reasoning_can_be_kept_when_explicitly_requested():
    answer = extract_answer(
        _message(content="391", reasoning_content="because 17*23"), keep_reasoning=True
    )
    assert "because 17*23" in answer and "391" in answer


def test_inline_reasoning_is_stripped_even_with_a_reasoning_field_present():
    message = _message(content="<think>inline</think>answer", reasoning_content="out of band")
    assert extract_answer(message) == "answer"


# -- json salvage on reasoning output --------------------------------------


def test_json_survives_an_inline_reasoning_preamble():
    raw = '<think>The user wants JSON with two types.</think>{"entity_types": ["Person"]}'
    assert salvage_json(raw) == {"entity_types": ["Person"]}


def test_json_survives_reasoning_plus_a_code_fence():
    raw = '<think>deciding</think>\n```json\n{"ok": true}\n```'
    assert salvage_json(raw) is not None
    assert salvage_json(raw)["ok"] is True


# -- request hints ---------------------------------------------------------


def test_auto_sends_nothing():
    """The only mode guaranteed not to be rejected by a strict server."""
    assert _reasoning_request_hints("auto") == {}


def test_off_sends_every_known_spelling():
    hints = _reasoning_request_hints("off")
    assert hints["reasoning"] == {"enabled": False, "exclude": True}
    assert hints["chat_template_kwargs"] == {"enable_thinking": False}


@pytest.mark.parametrize("mode", ["low", "medium", "high"])
def test_effort_modes_send_an_effort_level(mode):
    hints = _reasoning_request_hints(mode)
    assert hints["reasoning_effort"] == mode
    assert hints["reasoning"] == {"effort": mode}


# -- profile field ---------------------------------------------------------


def test_reasoning_defaults_to_auto_so_existing_profiles_are_unchanged():
    profile = EndpointProfile(name="p", base_url="http://x/v1", model="m")
    assert profile.reasoning == "auto"


@pytest.mark.parametrize("mode", REASONING_MODES)
def test_every_declared_mode_is_accepted(mode):
    assert EndpointProfile(
        name="p", base_url="http://x/v1", model="m", reasoning=mode
    ).reasoning == mode


def test_an_unknown_mode_is_rejected():
    with pytest.raises(Exception):
        EndpointProfile(name="p", base_url="http://x/v1", model="m", reasoning="turbo")


# -- client wiring ---------------------------------------------------------


def _client(reasoning="auto"):
    return LLMClient(
        EndpointProfile(
            name="p", base_url="http://x/v1", model="m", reasoning=reasoning
        )
    )


def _response(content="answer", reasoning_content=None):
    return SimpleNamespace(
        choices=[SimpleNamespace(message=_message(content, reasoning_content))]
    )


def test_auto_profile_sends_no_extra_body():
    client = _client("auto")
    with patch.object(client._client.chat.completions, "create", return_value=_response()) as create:
        client.chat([{"role": "user", "content": "hi"}])

    assert "extra_body" not in create.call_args[1]


def test_off_profile_sends_the_hints():
    client = _client("off")
    with patch.object(client._client.chat.completions, "create", return_value=_response()) as create:
        client.chat([{"role": "user", "content": "hi"}])

    body = create.call_args[1]["extra_body"]
    assert body["chat_template_kwargs"] == {"enable_thinking": False}


def test_a_server_rejecting_the_hints_is_retried_without_them():
    """Strict servers reject unknown top-level fields; that must not fail the call."""
    client = _client("off")
    create = MagicMock(side_effect=[Exception("unknown field: reasoning"), _response()])
    with patch.object(client._client.chat.completions, "create", create):
        assert client.chat([{"role": "user", "content": "hi"}]) == "answer"

    assert create.call_count == 2
    assert "extra_body" not in create.call_args_list[1][1]


def test_json_mode_still_falls_back_when_unsupported():
    client = _client("auto")
    create = MagicMock(side_effect=[Exception("response_format unsupported"), _response("{}")])
    with patch.object(client._client.chat.completions, "create", create):
        client.chat([{"role": "user", "content": "hi"}], json_mode=True)

    assert create.call_count == 2
    assert "response_format" not in create.call_args_list[1][1]


def test_a_genuine_failure_still_raises():
    client = _client("auto")
    create = MagicMock(side_effect=Exception("connection refused"))
    with patch.object(client._client.chat.completions, "create", create):
        with pytest.raises(Exception, match="connection refused"):
            client.chat([{"role": "user", "content": "hi"}])


def test_chat_returns_the_answer_not_the_reasoning():
    client = _client("auto")
    response = _response(content="\n\n391", reasoning_content="long working out")
    with patch.object(client._client.chat.completions, "create", return_value=response):
        assert client.chat([{"role": "user", "content": "hi"}]) == "391"
