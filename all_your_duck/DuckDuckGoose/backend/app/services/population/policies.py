"""Compiled behavior policies.

The BUILDER model reasons once per crowd_policy agent — stances, staged
reactions, susceptibility, response templates — and the runtime
only evaluates the result. Policies are pydantic-validated, stored as
inspectable JSON, and editable by the operator."""

import json
import logging
from pathlib import Path
from typing import Literal, Optional

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

ActionKind = Literal["like", "repost", "comment", "post", "do_nothing"]


class PolicyStance(BaseModel):
    topic: str
    position: str
    intensity: float = Field(ge=0.0, le=1.0)


class PolicyAction(BaseModel):
    kind: ActionKind
    weight: float = Field(ge=0.0, le=1.0)
    template_pool: Optional[str] = None


class ReactionRule(BaseModel):
    on_topic: str
    stance_alignment: Literal["agree", "disagree", "any"] = "any"
    min_exposures: int = Field(default=1, ge=1)
    actions: list[PolicyAction]


class Susceptibility(BaseModel):
    social_proof: float = Field(default=0.5, ge=0.0, le=1.0)
    authority: float = Field(default=0.5, ge=0.0, le=1.0)


class Activity(BaseModel):
    base_rate: float = Field(default=0.3, ge=0.0, le=1.0)


class CompiledPolicy(BaseModel):
    agent_uid: str
    stances: list[PolicyStance]
    reaction_rules: list[ReactionRule]
    templates: dict[str, list[str]] = {}
    susceptibility: Susceptibility = Susceptibility()
    activity: Activity = Activity()


_POLICY_SYSTEM = (
    "You compile a social-media behavior policy for ONE simulated person. "
    "Do the hard thinking NOW: given their persona and the operator's "
    "question, decide what they believe (stances with intensity), how they "
    "react to things they see (staged: a skeptic might convert after "
    "repeated exposures), how susceptible they are to crowd pressure and "
    "authority, and write 2-4 short post templates in THEIR voice with "
    "{slot} placeholders. Reply with JSON matching exactly: "
    '{"stances": [{"topic": str, "position": str, "intensity": 0..1}], '
    '"reaction_rules": [{"on_topic": str, "stance_alignment": '
    '"agree"|"disagree"|"any", "min_exposures": int>=1, "actions": '
    '[{"kind": "like"|"repost"|"comment"|"post"|"do_nothing", '
    '"weight": 0..1, "template_pool": str|null}]}], '
    '"templates": {pool: [str]}, '
    '"susceptibility": {"social_proof": 0..1, "authority": 0..1}, '
    '"activity": {"base_rate": 0..1}}. '
    "Rules must reference the given key topics. English only."
)


def generate_policy(
    agent: dict, question: str, key_topics: list[str], llm
) -> CompiledPolicy:
    """Raises on failure — policy generation is never silently faked."""
    payload = llm.chat_json(
        [
            {"role": "system", "content": _POLICY_SYSTEM},
            {
                "role": "user",
                "content": (
                    f"OPERATOR QUESTION: {question}\n"
                    f"KEY TOPICS: {', '.join(key_topics)}\n\n"
                    f"PERSON:\nname: {agent['name']}\n"
                    f"persona: {agent['persona']}\n"
                    f"profession: {agent['profession']}\n"
                    f"interests: {', '.join(agent['interested_topics'])}"
                ),
            },
        ],
        temperature=0.4,
    )
    return CompiledPolicy(agent_uid=agent["agent_uid"], **payload)


def save_policy(policies_dir: Path, policy: CompiledPolicy) -> None:
    policies_dir = Path(policies_dir)
    policies_dir.mkdir(parents=True, exist_ok=True)
    (policies_dir / f"{policy.agent_uid}.json").write_text(
        policy.model_dump_json(indent=2), encoding="utf-8"
    )


def load_policy(policies_dir: Path, agent_uid: str) -> CompiledPolicy | None:
    path = Path(policies_dir) / f"{agent_uid}.json"
    if not path.exists():
        return None
    return CompiledPolicy(**json.loads(path.read_text(encoding="utf-8")))
