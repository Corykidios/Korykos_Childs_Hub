"""Manual agent-graph construction with PER-AGENT model backends — the
capability MiroFish lacked and the reason this rebuild exists (spike §1a).

Mirrors oasis.generate_*_agent_graph but assigns model= per agent by tier.
Backends are created ONCE per tier with explicit url/api_key constructor
params (never env mutation) and shared across that tier's agents.

VERIFIED against installed camel-oasis 0.2.5:

ActionType values (oasis/social_platform/typing.py):
    CREATE_POST="create_post", LIKE_POST="like_post", REPOST="repost",
    QUOTE_POST="quote_post", FOLLOW="follow", DO_NOTHING="do_nothing",
    DISLIKE_POST="dislike_post", CREATE_COMMENT="create_comment",
    LIKE_COMMENT="like_comment", DISLIKE_COMMENT="dislike_comment",
    SEARCH_POSTS="search_posts", SEARCH_USER="search_user", TREND="trend",
    REFRESH="refresh", MUTE="mute", INTERVIEW="interview", SIGNUP="sign_up".
    The per-platform lists below equal
    ActionType.get_default_twitter_actions()/get_default_reddit_actions().

Action-method argument names (oasis/social_agent/agent_action.py):
    create_post(content)            (line 145)
    repost(post_id)                 (line 166)
    quote_post(post_id, quote_content)  (line 192)
    like_post(post_id)              (line 219)
    follow(followee_id)             (line 395)
    create_comment(post_id, content)    (line 509)
    interview(prompt)               (line 653)

Model attribute (camel/agents/chat_agent.py:463-471): ChatAgent wraps a
passed BaseModelBackend in a per-agent ModelManager stored at
``agent.model_backend``; pre-instantiated backends are identity-preserved
(chat_agent.py:601-603), reachable at ``agent.model_backend.models[0]``.
"""

import csv
import json
from pathlib import Path

from camel.models import ModelFactory
from camel.types import ModelPlatformType
from oasis import ActionType
from oasis.social_agent.agent import SocialAgent
from oasis.social_agent.agent_graph import AgentGraph
from oasis.social_platform.config import UserInfo

from simworker.runconfig import EndpointConfig, RunConfig

# VERIFIED: matches ActionType.get_default_twitter_actions() in installed 0.2.5
TWITTER_ACTIONS = [
    ActionType.CREATE_POST, ActionType.LIKE_POST, ActionType.REPOST,
    ActionType.FOLLOW, ActionType.DO_NOTHING, ActionType.QUOTE_POST,
]
# VERIFIED: matches ActionType.get_default_reddit_actions() in installed 0.2.5
REDDIT_ACTIONS = [
    ActionType.LIKE_POST, ActionType.DISLIKE_POST, ActionType.CREATE_POST,
    ActionType.CREATE_COMMENT, ActionType.LIKE_COMMENT,
    ActionType.DISLIKE_COMMENT, ActionType.SEARCH_POSTS,
    ActionType.SEARCH_USER, ActionType.TREND, ActionType.REFRESH,
    ActionType.DO_NOTHING, ActionType.FOLLOW, ActionType.MUTE,
]

# VERIFIED action-method argument names (agent_action.py) — used by the
# descriptor->ManualAction mapper (simworker.feed) and the engine:
ARG_CREATE_POST = "content"        # create_post(content)
ARG_LIKE_POST = "post_id"          # like_post(post_id)
ARG_REPOST = "post_id"             # repost(post_id)
ARG_CREATE_COMMENT = ("post_id", "content")  # create_comment(post_id, content)
ARG_FOLLOW = "followee_id"         # follow(followee_id)
ARG_INTERVIEW = "prompt"           # interview(prompt)

_NULL_ENDPOINT = EndpointConfig(
    base_url="http://127.0.0.1:1/v1", api_key="unused", model="never-called"
)


def _backend(cfg: EndpointConfig):
    return ModelFactory.create(
        model_platform=ModelPlatformType.OPENAI,
        model_type=cfg.model,
        url=cfg.base_url,
        api_key=cfg.api_key or "none",
    )


def _load_worker_files(run_dir: Path):
    mapping = json.loads(
        (run_dir / "export_mapping.json").read_text(encoding="utf-8")
    )["uid_to_position"]
    population = json.loads(
        (run_dir / "population.json").read_text(encoding="utf-8")
    )
    tier_by_uid = {a["agent_uid"]: a.get("tier", "crowd_policy")
                   for a in population["agents"]}
    return mapping, population, tier_by_uid


def build_agent_graph(platform: str, run_dir: Path, config: RunConfig):
    run_dir = Path(run_dir)
    mapping, population, tier_by_uid = _load_worker_files(run_dir)
    position_to_uid = {v: k for k, v in mapping.items()}

    proto_cfg = config.endpoints.protagonist or _NULL_ENDPOINT
    crowd_cfg = config.endpoints.crowd_llm or proto_cfg
    backends = {
        "protagonist": _backend(proto_cfg),
        "crowd_llm": _backend(crowd_cfg),
        "crowd_policy": _backend(config.endpoints.crowd_llm or _NULL_ENDPOINT),
    }

    graph = AgentGraph()
    by_position: dict[int, SocialAgent] = {}

    if platform == "twitter":
        rows = list(csv.DictReader(
            (run_dir / "twitter_profiles.csv").open(encoding="utf-8", newline="")
        ))
        for i, row in enumerate(rows):
            uid = position_to_uid.get(i, "")
            tier = tier_by_uid.get(uid, "crowd_policy")
            user_info = UserInfo(
                user_name=row["username"],
                name=row["name"],
                description=row["description"],
                profile={"other_info": {"user_profile": row["user_char"]}},
                recsys_type="twitter",
            )
            agent = SocialAgent(
                agent_id=i, user_info=user_info,
                model=backends[tier], agent_graph=graph,
                available_actions=TWITTER_ACTIONS,
            )
            graph.add_agent(agent)
            by_position[i] = agent
    else:
        items = json.loads(
            (run_dir / "reddit_profiles.json").read_text(encoding="utf-8")
        )
        for i, item in enumerate(items):
            uid = position_to_uid.get(i, "")
            tier = tier_by_uid.get(uid, "crowd_policy")
            user_info = UserInfo(
                user_name=item["username"],
                name=item["realname"],
                description=item["bio"],
                profile={"other_info": {
                    "user_profile": item["persona"],
                    "mbti": item["mbti"],
                    "gender": item["gender"],
                    "age": item["age"],
                    "country": item["country"],
                }},
                recsys_type="reddit",
            )
            agent = SocialAgent(
                agent_id=i, user_info=user_info,
                model=backends[tier], agent_graph=graph,
                available_actions=REDDIT_ACTIONS,
            )
            graph.add_agent(agent)
            by_position[i] = agent

    return graph, by_position, dict(mapping)
