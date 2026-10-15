"""Endpoint profiles: named OpenAI-compatible endpoints + role bindings.

One config shape covers Ollama, Anthropic's compat endpoint, OpenRouter,
OpenAI, and anything else speaking that protocol. Stored as JSON in
Config.SETTINGS_FILE.

The same JSON file also carries simple top-level operator settings (e.g.
``max_concurrent_runs`` for the run queue) via get_setting/put_setting;
ProfileStore only owns the "profiles" and "roles" keys and preserves
everything else on save.
"""

import json
import threading
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

ROLES = (
    "protagonist_brain",
    "crowd_llm_brain",
    "builder",
    "report_writer",
    "embeddings",
)

# How much visible reasoning to ask a model for.
#
# "auto" sends nothing and takes whatever the model does by default, which is
# the only setting guaranteed not to be rejected by a strict server. The rest
# are best-effort request hints, because there is no agreed way to control
# reasoning across OpenAI-compatible servers: OpenRouter reads `reasoning`,
# OpenAI reads `reasoning_effort`, llama.cpp and vLLM read a chat-template
# argument, and some servers (LM Studio, observed) ignore all of them.
#
# Reasoning is therefore always handled on the way out as well, so the setting
# degrades to "we strip it from the answer" wherever the server will not
# suppress it. See app.services.llm_client.
REASONING_MODES = ("auto", "off", "low", "medium", "high")


class UnknownProfileError(KeyError):
    pass


def _read_settings_file(path: Path) -> dict:
    if not Path(path).exists():
        return {}
    try:
        raw = json.loads(Path(path).read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return raw if isinstance(raw, dict) else {}


def get_setting(path: Path, key: str, default=None):
    """Read a top-level key from the settings JSON (shares the file with
    ProfileStore's profiles/roles payload)."""
    return _read_settings_file(path).get(key, default)


def put_setting(path: Path, key: str, value) -> None:
    """Write a top-level key into the settings JSON, preserving everything
    else (profiles, roles, other settings)."""
    path = Path(path)
    raw = _read_settings_file(path)
    raw[key] = value
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(raw, indent=2), encoding="utf-8")


class EndpointProfile(BaseModel):
    name: str = Field(min_length=1)
    base_url: str = Field(min_length=1)
    api_key: str = ""
    model: str = Field(min_length=1)
    max_concurrency: int = Field(default=4, gt=0)
    # Defaults to "auto" so profiles saved before this field existed keep
    # behaving exactly as they did.
    reasoning: Literal["auto", "off", "low", "medium", "high"] = "auto"


class ProfileStore:
    def __init__(self, path: Path):
        self._path = Path(path)
        self._lock = threading.Lock()
        self._profiles: dict[str, EndpointProfile] = {}
        self._bindings: dict[str, str] = {}
        self._load()

    def _load(self) -> None:
        if not self._path.exists():
            return
        raw = json.loads(self._path.read_text(encoding="utf-8"))
        self._profiles = {
            p["name"]: EndpointProfile(**p) for p in raw.get("profiles", [])
        }
        self._bindings = {
            r: n for r, n in raw.get("roles", {}).items()
            if r in ROLES and n in self._profiles
        }

    def _save(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        # Re-read the file so top-level settings written by put_setting
        # (e.g. max_concurrent_runs) survive a profile/role save.
        payload = _read_settings_file(self._path)
        payload["profiles"] = [p.model_dump() for p in self._profiles.values()]
        payload["roles"] = self._bindings
        self._path.write_text(
            json.dumps(payload, indent=2), encoding="utf-8"
        )

    def upsert(self, profile: EndpointProfile) -> None:
        with self._lock:
            self._profiles[profile.name] = profile
            self._save()

    def get(self, name: str) -> EndpointProfile:
        try:
            return self._profiles[name]
        except KeyError:
            raise UnknownProfileError(name) from None

    def list(self) -> list[EndpointProfile]:
        return list(self._profiles.values())

    def delete(self, name: str) -> None:
        with self._lock:
            self._profiles.pop(name, None)
            self._bindings = {
                r: n for r, n in self._bindings.items() if n != name
            }
            self._save()

    def bind_role(self, role: str, profile_name: str) -> None:
        if role not in ROLES:
            raise ValueError(f"unknown role: {role!r}")
        with self._lock:
            if profile_name not in self._profiles:
                raise UnknownProfileError(profile_name)
            self._bindings[role] = profile_name
            self._save()

    def resolve_role(self, role: str) -> EndpointProfile | None:
        if role not in ROLES:
            raise ValueError(f"unknown role: {role!r}")
        name = self._bindings.get(role)
        return self._profiles.get(name) if name else None

    def role_bindings(self) -> dict[str, str]:
        return dict(self._bindings)
