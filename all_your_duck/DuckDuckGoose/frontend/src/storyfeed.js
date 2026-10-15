/**
 * Pure logic for the StoryFeed view. Mirrors the backend /feed payload
 * (backend app/services/feed.py build_feed): a list of posts, each with
 * { post_id, round, seq, author{name,username,tier,faction,protagonist},
 *   content, num_likes, num_dislikes, score, comments[] } where every comment
 * is the same node shape keyed by comment_id.
 *
 * The view stays dumb: round playback (which nodes are visible yet), thread
 * ordering, faction bucketing for color, and per-round activity all live here
 * and are unit-tested. No Vue imports, no fetch, no mutation of inputs.
 */

/** Round a node is "born" in; missing round -> 0 so it is visible from the
 * start rather than never (a node always has content even if no event tagged
 * it). */
function visibleRound(node) {
  const r = node?.round
  return Number.isInteger(r) ? r : 0
}

function seqOf(node) {
  return Number.isInteger(node?.seq) ? node.seq : 0
}

/* Faction bucketing: the run carries ~300 free-text faction labels (noisy LLM
 * output). For COLOR/grouping only we fold them into the handful of canonical
 * blocs the report clusters on. This is approximate-by-design (substring match,
 * not authoritative clustering) — order matters: more specific national blocs
 * before the broad stance blocs. */
const FACTION_BUCKETS = [
  ['pro-us', ['pro-u.s', 'pro-us', 'pro u.s', 'pro us', 'pro-american', 'pro-united states']],
  ['anti-west', ['anti-west', 'anti west', 'anti-western']],
  ['anti-iran', ['anti-iran', 'anti iran', 'anti-iranian']],
  ['hardline-closure', ['hardline', 'closure', 'hard-line', 'pro-closure', 'keep closed', 'closed']],
  ['pro-reopening', ['reopen', 're-open', 'opening', 'pro-open']],
  ['neutral', ['neutral', 'undecided', 'observer']],
  ['mixed', ['mixed', 'ambivalent', 'conflicted']],
]

/** Canonical bucket key for a free-text faction label. Doubles as a CSS class
 * suffix (`.fac-<key>`). Empty/non-string -> 'unaligned'. */
export function normalizeFaction(raw) {
  if (typeof raw !== 'string') return 'unaligned'
  const s = raw.trim().toLowerCase()
  if (!s) return 'unaligned'
  for (const [key, needles] of FACTION_BUCKETS) {
    if (needles.some((n) => s.includes(n))) return key
  }
  return 'other'
}

/** Posts (with their comments) visible at or before `round` — the round-by-round
 * reveal. Returns shallow copies so the source feed is never mutated. */
export function feedThroughRound(feed, round) {
  const posts = Array.isArray(feed?.posts) ? feed.posts : []
  const limit = Number.isFinite(round) ? round : Infinity
  const out = []
  for (const post of posts) {
    if (visibleRound(post) > limit) continue
    const comments = (Array.isArray(post.comments) ? post.comments : [])
      .filter((c) => visibleRound(c) <= limit)
    out.push({ ...post, comments })
  }
  return out
}

/** Sort posts for display. 'latest' = newest post first; 'top' = highest score
 * first; 'active' = most recently active thread first (a post bumps when it or
 * one of its visible comments is the newest by seq). Never mutates input. */
export function sortPosts(posts, mode = 'active') {
  const arr = Array.isArray(posts) ? [...posts] : []
  if (mode === 'top') {
    return arr.sort((a, b) => (b.score - a.score) || (seqOf(b) - seqOf(a)))
  }
  if (mode === 'latest') {
    return arr.sort((a, b) => seqOf(b) - seqOf(a))
  }
  const activity = (p) => {
    let s = seqOf(p)
    for (const c of Array.isArray(p.comments) ? p.comments : []) {
      s = Math.max(s, seqOf(c))
    }
    return s
  }
  return arr.sort((a, b) => activity(b) - activity(a))
}

/** Per-round new-post / new-comment counts for the playback scrubber. Length =
 * max_round + 1 (rounds 0..max_round); empty when the run produced no rounds. */
export function roundActivity(feed) {
  const posts = Array.isArray(feed?.posts) ? feed.posts : []
  const max = Number.isInteger(feed?.max_round) ? feed.max_round : -1
  if (max < 0) return []
  const rows = []
  for (let r = 0; r <= max; r += 1) rows.push({ round: r, posts: 0, comments: 0 })
  const bump = (r, key) => {
    if (r >= 0 && r < rows.length) rows[r][key] += 1
  }
  for (const post of posts) {
    bump(visibleRound(post), 'posts')
    for (const c of Array.isArray(post.comments) ? post.comments : []) {
      bump(visibleRound(c), 'comments')
    }
  }
  return rows
}
