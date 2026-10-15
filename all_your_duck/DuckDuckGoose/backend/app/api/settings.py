from flask import Blueprint, jsonify, request
from pydantic import ValidationError

from app.core.config import Config
from app.core.profiles import EndpointProfile, ProfileStore, UnknownProfileError
from app.services.llm_client import LLMClient

bp = Blueprint("settings", __name__, url_prefix="/api/settings")


def _store() -> ProfileStore:
    return ProfileStore(Config.SETTINGS_FILE)


@bp.get("/profiles")
def list_profiles():
    s = _store()
    return jsonify({
        "profiles": [p.model_dump() for p in s.list()],
        "roles": s.role_bindings(),
    })


@bp.put("/profiles")
def upsert_profile():
    try:
        profile = EndpointProfile(**(request.get_json(force=True) or {}))
    except ValidationError as e:
        return jsonify({"error": e.errors()}), 400
    _store().upsert(profile)
    return jsonify({"ok": True})


@bp.delete("/profiles/<name>")
def delete_profile(name: str):
    _store().delete(name)
    return jsonify({"ok": True})


@bp.put("/roles")
def bind_role():
    data = request.get_json(force=True) or {}
    try:
        _store().bind_role(data.get("role", ""), data.get("profile", ""))
    except UnknownProfileError:
        return jsonify({"error": "unknown profile"}), 404
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify({"ok": True})


@bp.post("/profiles/<name>/test")
def test_profile(name: str):
    try:
        profile = _store().get(name)
    except UnknownProfileError:
        return jsonify({"error": "unknown profile"}), 404
    try:
        reply = LLMClient(profile).chat(
            [{"role": "user", "content": "Reply with the single word: ok"}],
            temperature=0.0,
        )
        return jsonify({"ok": True, "reply": reply[:100]})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)[:300]})
