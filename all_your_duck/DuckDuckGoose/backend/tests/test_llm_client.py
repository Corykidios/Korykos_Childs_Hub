import pytest

from app.services.llm_client import LLMClient, salvage_json
from app.core.profiles import EndpointProfile


def test_salvage_plain_json():
    assert salvage_json('{"a": 1}') == {"a": 1}


def test_salvage_strips_think_blocks():
    raw = '<think>reasoning here {not json}</think>{"a": 1}'
    assert salvage_json(raw) == {"a": 1}


def test_salvage_strips_markdown_fences():
    raw = '```json\n{"a": 1}\n```'
    assert salvage_json(raw) == {"a": 1}


def test_salvage_extracts_object_from_prose():
    raw = 'Sure! Here is the JSON you asked for: {"a": {"b": 2}} hope it helps'
    assert salvage_json(raw) == {"a": {"b": 2}}


def test_salvage_repairs_truncated_object():
    raw = '{"a": 1, "b": {"c": [1, 2'
    assert salvage_json(raw) == {"a": 1, "b": {"c": [1, 2]}}


def test_salvage_total_garbage_raises():
    with pytest.raises(ValueError):
        salvage_json("no json anywhere")


def test_salvage_array_payload():
    assert salvage_json('[{"a": 1}, {"a": 2}]') == [{"a": 1}, {"a": 2}]


def test_client_builds_from_profile():
    p = EndpointProfile(
        name="t", base_url="http://localhost:9/v1", api_key="k",
        model="m", max_concurrency=1,
    )
    c = LLMClient(p)
    assert c.model == "m"
