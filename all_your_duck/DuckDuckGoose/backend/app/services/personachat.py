"""Post-hoc persona chat: talk to any agent AFTER the worker is
gone. The voice is assembled honestly from artifacts on disk — the agent's
population record, its compiled-policy stances (if any), and its actual
actions in the run's event stream. No live worker, no invented memories:
the activity digest is exactly what the event stream says the agent did."""

import json
import logging
from pathlib import Path

from app.core.projects import ProjectStore
from app.services import runqueue
from simworker.events import EventReader

logger = logging.getLogger(__name__)

HISTORY_CAP = 20    # prior chat turns kept (most recent)
ACTIVITY_CAP = 15   # run actions quoted in the system prompt


def _load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return default


def _render_action(event: dict) -> str:
    info = event.get("info") or {}
    if not isinstance(info, dict):
        info = {}
    content = info.get("content", "")
    post_id = info.get("post_id")
    action_type = event.get("action_type", "")
    if action_type == "create_post":
        body = f"you posted: {content}"
    elif action_type == "create_comment":
        body = f"you commented: {content}"
    elif action_type == "quote_post":
        body = f"you quoted post {post_id}: {content}"
    elif action_type == "like_post":
        body = f"you liked post {post_id}"
    elif action_type == "repost":
        body = f"you reposted post {post_id}"
    else:
        body = f"you did {action_type}"
    return f"[round {event.get('round', 0)}] {body}"


def _activity_digest(run_dir: Path, agent_uid: str) -> str:
    lines = []
    for event in EventReader(run_dir).read_from(0):
        if event.get("kind") != "action":
            continue
        if event.get("agent_uid") != agent_uid:
            continue
        lines.append(_render_action(event))
        if len(lines) >= ACTIVITY_CAP:
            break
    return "\n".join(lines) or "(you took no actions during the run)"


def _stances_block(run_dir: Path, agent_uid: str) -> str:
    policy = _load_json(run_dir / "policies" / f"{agent_uid}.json", None)
    if not isinstance(policy, dict):
        return ""
    lines = [
        f"- {s.get('topic')}: {s.get('position')} "
        f"(intensity {s.get('intensity')})"
        for s in policy.get("stances") or [] if isinstance(s, dict)
    ]
    if not lines:
        return ""
    return "Your stances:\n" + "\n".join(lines)


def _sanitize_history(history) -> list[dict]:
    """Keep only well-formed user/assistant turns (an operator-supplied
    'system' turn must not override the persona), capped at the most
    recent HISTORY_CAP."""
    out = []
    for item in history or []:
        if not isinstance(item, dict):
            continue
        role = item.get("role")
        content = item.get("content")
        if role in ("user", "assistant") and isinstance(content, str):
            out.append({"role": role, "content": content})
    return out[-HISTORY_CAP:]


def chat_with_agent(
    store: ProjectStore,
    project_id: str,
    run_id: str,
    agent_uid: str,
    message: str,
    history: list[dict],
    llm,
) -> str:
    """One post-hoc chat turn with a run agent. Raises ValueError for an
    unknown run or an agent_uid not in the run's population."""
    project = store.get(project_id)
    run_dir = runqueue.run_dir_for(store, project_id, run_id)
    if project is None or run_dir is None:
        raise ValueError(f"unknown run: {project_id}/{run_id}")
    population = _load_json(run_dir / "population.json", {})
    agent = next(
        (a for a in population.get("agents", [])
         if a.get("agent_uid") == agent_uid),
        None,
    )
    if agent is None:
        raise ValueError(f"unknown agent: {agent_uid}")

    parts = [
        f"You are {agent.get('name') or agent_uid} "
        f"(@{agent.get('username') or agent_uid}), a participant in a "
        "social-media simulation that has finished.",
    ]
    if agent.get("bio"):
        parts.append(f"Bio: {agent['bio']}")
    if agent.get("persona"):
        parts.append(f"Persona: {agent['persona']}")
    stances = _stances_block(run_dir, agent_uid)
    if stances:
        parts.append(stances)
    parts.append(
        f"The simulation explored the question: {project['question']}"
    )
    parts.append(
        "Your activity during the run:\n"
        + _activity_digest(run_dir, agent_uid)
    )
    parts.append(
        "Stay in character. Answer in first person, grounded in your "
        "persona and your actual run activity above."
    )

    messages = (
        [{"role": "system", "content": "\n\n".join(parts)}]
        + _sanitize_history(history)
        + [{"role": "user", "content": message}]
    )
    return llm.chat(messages)
