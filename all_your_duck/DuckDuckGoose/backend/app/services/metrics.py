"""LLM-free aggregate metrics from a run's event stream.

This is the signal local-small runs are judged by (operator decision:
judge the crowd trend, not single-agent eloquence). Everything here is
honest counting — lexicon sentiment, word-containment topic matching —
identical for a 4B-local run and a cloud run. No LLM calls, ever."""

import json
import re
from datetime import datetime, timezone
from pathlib import Path

from simworker.events import EVENTS_FILE, EventReader

POSITIVE_WORDS = {
    "surge", "rally", "gain", "gains", "calm", "relief", "optimistic",
    "stable", "recovery", "confident", "hope", "hopeful", "strong",
    "growth", "boom", "win", "winning", "safe", "secure", "improve",
    "improving", "good", "great", "steady", "reassuring",
}
NEGATIVE_WORDS = {
    "crash", "panic", "fear", "worried", "worry", "collapse", "shortage",
    "crisis", "plunge", "fall", "falling", "drop", "fail", "failure",
    "afraid", "scared", "chaos", "disaster", "bad", "terrible", "risk",
    "risky", "unstable", "spike", "spiking", "alarm",
}

_CONTENT_ACTIONS = {"create_post", "create_comment", "quote_post"}

# bump when the metrics payload shape OR a computed value changes (invalidates
# an older cache so a finished run's metrics.json is rebuilt). v2: keyword-stem
# topic matching (was literal phrase-containment, which undercounted topics).
METRICS_SCHEMA = 2


# non-content words to drop from a topic before keyword matching (only the
# len>=4 ones matter; shorter words are filtered by the length gate)
_TOPIC_STOPWORDS = {
    "over", "into", "from", "with", "about", "that", "this", "their", "your",
    "will", "would", "could", "than", "then", "they", "them", "what", "when",
}


def _topic_keywords(topic: str) -> list[str]:
    return [
        w for w in re.findall(r"[a-z]+", topic.casefold())
        if len(w) >= 4 and w not in _TOPIC_STOPWORDS
    ]


def _stem_match(a: str, b: str) -> bool:
    """Crude bidirectional-prefix stem: a topic word and a content word match
    when they share a >=4-char prefix (iranian↔iran, losses↔loss,
    reopening↔reopen, financial↔finance)."""
    n = 0
    for x, y in zip(a, b):
        if x != y:
            break
        n += 1
    return n >= 4


def _matches_topic(content: str, topic: str) -> bool:
    """Keyword-stem topic matching (replaces literal full-phrase containment,
    which scored central topics at 0 because they're rarely phrased verbatim).
    Matches on a full-phrase hit OR when at least half the topic's content
    keywords appear (stemmed) in the post."""
    c = content.casefold()
    if topic.casefold() in c:
        return True
    keywords = _topic_keywords(topic)
    if not keywords:
        return False
    content_words = set(re.findall(r"[a-z]+", c))
    hits = sum(
        1 for kw in keywords if any(_stem_match(kw, cw) for cw in content_words)
    )
    return hits >= max(1, (len(keywords) + 1) // 2)


def _sentiment(content: str) -> str:
    words = set(content.casefold().replace(",", " ").replace(".", " ").split())
    pos = len(words & POSITIVE_WORDS)
    neg = len(words & NEGATIVE_WORDS)
    if pos > neg:
        return "positive"
    if neg > pos:
        return "negative"
    return "neutral"


def _load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def compute_metrics(run_dir: Path) -> dict:
    run_dir = Path(run_dir)
    cache = run_dir / "metrics.json"
    events_file = run_dir / EVENTS_FILE
    if cache.exists() and events_file.exists():
        if cache.stat().st_mtime > events_file.stat().st_mtime:
            cached = _load_json(cache, {})
            if cached.get("schema_version") == METRICS_SCHEMA:
                return cached

    population = _load_json(run_dir / "population.json", {})
    topics = population.get("key_topics", [])
    agents = population.get("agents", [])
    tier_by_uid = {a["agent_uid"]: a.get("tier", "crowd_policy") for a in agents}
    faction_by_uid = {a["agent_uid"]: a.get("faction") or "unaligned" for a in agents}
    events = EventReader(run_dir).read_from(0)

    per_round: dict[int, dict] = {}
    actions_by_type: dict[str, int] = {}
    actions_by_tier: dict[str, int] = {}
    actions_by_faction: dict[str, int] = {}
    faction_sentiment: dict[str, dict] = {}
    topic_totals: dict[str, int] = {t: 0 for t in topics}
    engaged_by_round: dict[int, set] = {}
    total_actions = 0

    for event in events:
        if event["kind"] != "action":
            continue
        total_actions += 1
        round_num = int(event.get("round", 0))
        slot = per_round.setdefault(round_num, {
            "round": round_num, "actions": 0, "by_tier": {}, "by_faction": {},
            "sentiment": {"positive": 0, "negative": 0, "neutral": 0},
            "faction_sentiment": {},
            "topic_engagement": {t: 0 for t in topics},
        })
        slot["actions"] += 1

        action_type = event.get("action_type", "unknown")
        actions_by_type[action_type] = actions_by_type.get(action_type, 0) + 1

        uid = event.get("agent_uid", "")
        tier = tier_by_uid.get(uid, "unknown")
        actions_by_tier[tier] = actions_by_tier.get(tier, 0) + 1
        slot["by_tier"][tier] = slot["by_tier"].get(tier, 0) + 1
        faction = faction_by_uid.get(uid, "unaligned")
        actions_by_faction[faction] = actions_by_faction.get(faction, 0) + 1
        slot["by_faction"][faction] = slot["by_faction"].get(faction, 0) + 1
        engaged_by_round.setdefault(round_num, set()).add(uid)

        info = event.get("info") or {}
        content = info.get("content", "") if isinstance(info, dict) else ""
        if action_type in _CONTENT_ACTIONS and content:
            sent = _sentiment(content)
            slot["sentiment"][sent] += 1
            fs = faction_sentiment.setdefault(
                faction, {"positive": 0, "negative": 0, "neutral": 0}
            )
            fs[sent] += 1
            slot_fs = slot["faction_sentiment"].setdefault(
                faction, {"positive": 0, "negative": 0, "neutral": 0}
            )
            slot_fs[sent] += 1
            for topic in topics:
                if _matches_topic(content, topic):
                    slot["topic_engagement"][topic] += 1
                    topic_totals[topic] += 1

    rounds = [per_round[r] for r in sorted(per_round)]
    sentiment_trend = []
    divergence = []
    for slot in rounds:
        s = slot["sentiment"]
        total = s["positive"] + s["negative"] + s["neutral"]
        sentiment_trend.append({
            "round": slot["round"],
            "score": (s["positive"] - s["negative"]) / max(total, 1),
        })
        divergence.append({
            "round": slot["round"],
            "protagonist_share": (
                slot["by_tier"].get("protagonist", 0) / max(slot["actions"], 1)
            ),
        })

    all_engaged: set = set()
    cumulative: list[tuple[int, int]] = []
    for round_num in sorted(engaged_by_round):
        all_engaged |= engaged_by_round[round_num]
        cumulative.append((round_num, len(all_engaged)))
    half = len(all_engaged) / 2
    first_half_round = next(
        (r for r, n in cumulative if n >= half and n > 0), None
    )

    for s in faction_sentiment.values():
        total = s["positive"] + s["negative"] + s["neutral"]
        s["score"] = round((s["positive"] - s["negative"]) / max(total, 1), 4)

    metrics = {
        "schema_version": METRICS_SCHEMA,
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "rounds_observed": len(rounds),
        "total_actions": total_actions,
        "actions_by_type": actions_by_type,
        "actions_by_tier": actions_by_tier,
        "actions_by_faction": actions_by_faction,
        "faction_sentiment": faction_sentiment,
        "per_round": rounds,
        "topic_totals": topic_totals,
        "sentiment_trend": sentiment_trend,
        "divergence": divergence,
        "cascade": {
            "agents_engaged": len(all_engaged),
            "engaged_share": (
                len(all_engaged) / max(len(tier_by_uid), 1)
            ),
            "first_round_half_engaged": first_half_round,
        },
    }
    cache.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    return metrics
