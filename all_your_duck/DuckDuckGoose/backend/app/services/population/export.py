"""OASIS profile exporters. Formats are pinned to camel-oasis 0.2.5 and were
verified against the installed package rather than its documentation.

Positional ids exist ONLY here. The uid<->position mapping is persisted so
the sim worker can address agents by stable agent_uid."""

import csv
import json
from datetime import datetime, timezone

from app.core.projects import ProjectStore

TWITTER_COLUMNS = [
    "user_id", "name", "username", "user_char", "description",
    "following_agentid_list", "previous_tweets",
]


def _load_population(store: ProjectStore, project_id: str) -> dict:
    path = store.project_dir(project_id) / "population.json"
    if not path.exists():
        raise ValueError("population not built")
    return json.loads(path.read_text(encoding="utf-8"))


def export_population(
    store: ProjectStore, project_id: str, platform: str
) -> dict:
    if platform not in ("twitter", "reddit"):
        raise ValueError(f"unknown platform: {platform}")
    population = _load_population(store, project_id)
    agents = population["agents"]
    uid_to_position = {a["agent_uid"]: i for i, a in enumerate(agents)}

    follows_by_uid: dict[str, list[int]] = {}
    for edge in population.get("follow_edges", []):
        f, t = edge["follower"], edge["followee"]
        if f in uid_to_position and t in uid_to_position:
            follows_by_uid.setdefault(f, []).append(uid_to_position[t])

    project_dir = store.project_dir(project_id)
    if platform == "twitter":
        out_path = project_dir / "twitter_profiles.csv"
        with out_path.open("w", encoding="utf-8", newline="") as fh:
            writer = csv.DictWriter(fh, fieldnames=TWITTER_COLUMNS)
            writer.writeheader()
            for i, a in enumerate(agents):
                user_char = f"{a['bio']} {a['persona']}".strip()
                writer.writerow({
                    "user_id": i,
                    "name": a["name"],
                    "username": a["username"],
                    "user_char": user_char,
                    "description": a["bio"],
                    "following_agentid_list": json.dumps(
                        sorted(follows_by_uid.get(a["agent_uid"], []))
                    ),
                    "previous_tweets": "[]",
                })
    else:
        out_path = project_dir / "reddit_profiles.json"
        items = []
        for i, a in enumerate(agents):
            items.append({
                "user_id": i,
                "username": a["username"],
                "realname": a["name"],
                "bio": a["bio"] or a["name"],
                "persona": a["persona"] or a["bio"] or a["name"],
                "age": a["age"],
                "gender": a["gender"],
                "mbti": a["mbti"],
                "country": a["country"],
            })
        out_path.write_text(
            json.dumps(items, indent=2, ensure_ascii=False), encoding="utf-8"
        )

    mapping = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "uid_to_position": uid_to_position,
    }
    (project_dir / "export_mapping.json").write_text(
        json.dumps(mapping, indent=2), encoding="utf-8"
    )
    return {"path": str(out_path), "uid_to_position": uid_to_position}
