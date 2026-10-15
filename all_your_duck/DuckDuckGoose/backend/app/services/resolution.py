"""3-stage entity resolution — THE dedup fix of the rebuild.

Stage 1: name normalization (exact-match merge, always).
Stage 2: embedding clustering with union-find (auto-merge >= AUTO_MERGE_SIM,
         borderline band goes to stage 3). Wikilink alias hints merge always.
Stage 3: LLM adjudication of borderline pairs (batched; llm=None skips,
         leaving borderline pairs separate — conservative default).
"""

import hashlib
import logging
import math
from collections import Counter

logger = logging.getLogger(__name__)

AUTO_MERGE_SIM = 0.90
ADJUDICATE_SIM = 0.75
HONORIFICS = {
    "president", "mr", "mrs", "ms", "dr", "sir", "the", "general",
    "minister", "senator", "chancellor", "king", "queen", "prince",
}

_ADJUDICATE_SYSTEM = (
    "You decide whether two entity mentions from news documents refer to the "
    "SAME real-world actor. Consider names, summaries, and roles. Reply with "
    'JSON: {"verdicts": [{"index": int, "same": bool}]} — one verdict per pair.'
)


def normalize_name(name: str) -> str:
    words = [w.strip(".,") for w in name.casefold().split()]
    kept = [w for w in words if w and w not in HONORIFICS]
    return " ".join(kept) if kept else name.casefold().strip()


def _names_compatible(a: str, b: str) -> bool:
    """Token-containment guard for embedding-only auto-merges.

    'putin' may auto-merge into 'vladimir putin' (one name is a short form
    of the other), but 'sarah monroe' must NOT auto-merge with 'sarah connor'
    on embedding similarity alone — conflicting tokens mean possibly distinct
    actors (the classic forbidden merge). Incompatible high-similarity pairs
    are demoted to the borderline band, where stage 3's LLM adjudicates
    (or, with llm=None, they conservatively stay separate)."""
    ta, tb = set(a.split()), set(b.split())
    if not ta or not tb:
        return False
    return ta <= tb or tb <= ta


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0


class _UnionFind:
    def __init__(self, n: int):
        self.parent = list(range(n))

    def find(self, i: int) -> int:
        while self.parent[i] != i:
            self.parent[i] = self.parent[self.parent[i]]
            i = self.parent[i]
        return i

    def union(self, i: int, j: int) -> None:
        self.parent[self.find(i)] = self.find(j)


def _adjudicate(llm, pairs: list[dict]) -> dict[int, bool]:
    """pairs: [{index, a, b, a_summary, b_summary}] -> {index: same?}"""
    import json as _json

    raw = llm.chat_json(
        [
            {"role": "system", "content": _ADJUDICATE_SYSTEM},
            {"role": "user", "content": "PAIRS:\n" + _json.dumps(pairs)},
        ],
        temperature=0.0,
    )
    out = {}
    for v in raw.get("verdicts") or []:
        if isinstance(v, dict) and "index" in v:
            out[int(v["index"])] = bool(v.get("same"))
    return out


def resolve_entities(
    project_id: str,
    mentions: list[dict],
    embed_fn,
    llm=None,
    alias_hints: dict[str, str] | None = None,
) -> list[dict]:
    """mentions: [{name, type, summary, doc_id, chunk_index}] from ALL docs.
    Returns resolved entities sorted by mention_count desc."""
    if not mentions:
        return []
    alias_hints = {
        normalize_name(k): normalize_name(v) for k, v in (alias_hints or {}).items()
    }

    # ---- stage 1: group by normalized name --------------------------------
    groups: dict[str, list[dict]] = {}
    for m in mentions:
        key = normalize_name(m["name"])
        key = alias_hints.get(key, key)
        groups.setdefault(key, []).append(m)
    keys = sorted(groups)

    # ---- stage 2: embed one representative text per group -----------------
    reps = []
    for k in keys:
        best = max(groups[k], key=lambda m: len(m.get("summary", "")))
        reps.append(f"{best['name']}: {best.get('summary', '')}")
    vectors = embed_fn(reps)

    uf = _UnionFind(len(keys))
    borderline: list[tuple[int, int]] = []
    for i in range(len(keys)):
        for j in range(i + 1, len(keys)):
            sim = _cosine(vectors[i], vectors[j])
            if sim >= AUTO_MERGE_SIM and _names_compatible(keys[i], keys[j]):
                uf.union(i, j)
            elif sim >= ADJUDICATE_SIM:
                borderline.append((i, j))

    # ---- stage 3: LLM adjudication of borderline pairs --------------------
    if borderline and llm is not None:
        payload = []
        for idx, (i, j) in enumerate(borderline):
            a = max(groups[keys[i]], key=lambda m: len(m.get("summary", "")))
            b = max(groups[keys[j]], key=lambda m: len(m.get("summary", "")))
            payload.append({
                "index": idx, "a": a["name"], "b": b["name"],
                "a_summary": a.get("summary", ""), "b_summary": b.get("summary", ""),
            })
        try:
            verdicts = _adjudicate(llm, payload)
        except Exception as e:
            logger.warning(f"adjudication failed, leaving pairs separate: {e}")
            verdicts = {}
        for idx, (i, j) in enumerate(borderline):
            if verdicts.get(idx):
                uf.union(i, j)

    # ---- merge clusters into entities --------------------------------------
    clusters: dict[int, list[str]] = {}
    for i, k in enumerate(keys):
        clusters.setdefault(uf.find(i), []).append(k)

    entities = []
    for cluster_keys in clusters.values():
        all_mentions = [m for k in cluster_keys for m in groups[k]]
        names = [m["name"] for m in all_mentions]
        canonical = max(names, key=len)
        types = Counter(m["type"] for m in all_mentions)
        summaries: list[str] = []
        for m in sorted(all_mentions, key=lambda m: -len(m.get("summary", ""))):
            s = m.get("summary", "").strip()
            if s and s not in summaries:
                summaries.append(s)
            if len(summaries) == 2:
                break
        uid = "ent_" + hashlib.sha256(
            f"{project_id}|{normalize_name(canonical)}".encode()
        ).hexdigest()[:16]
        entities.append({
            "uuid": uid,
            "canonical_name": canonical,
            "type": types.most_common(1)[0][0],
            "summary": " ".join(summaries),
            "aliases": sorted({n for n in names if n != canonical}),
            "doc_ids": sorted({m["doc_id"] for m in all_mentions}),
            "mention_count": len(all_mentions),
            "mentions": all_mentions,
        })
    entities.sort(key=lambda e: -e["mention_count"])
    return entities
