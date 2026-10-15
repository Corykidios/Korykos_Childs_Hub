/**
 * Pure logic for the faction-divergence chart. Folds the run's ~300 free-text
 * faction labels into a handful of coarse blocs and turns metrics.json's
 * per-round per-faction sentiment counts into a per-bloc score series the
 * chart draws as lines over rounds.
 *
 * Mirrors metrics.json: per_round[i].faction_sentiment is
 *   { <raw faction>: { positive, negative, neutral } }
 * (added in app/services/metrics.py, schema_version 1). The score per
 * (round, bloc) is the net lexicon sentiment (pos - neg) / total, in [-1, 1];
 * a round with too few classified actions is left null so the line breaks
 * rather than spiking on one-off noise (the data map warned low-N factions
 * score a misleading ±1).
 */
import { normalizeFaction } from './storyfeed.js'

// Canonical blocs, with stable labels + colors (the One Dark data palette, same
// hues as the StoryFeed faction badges). normalizeFaction maps raw labels to
// these keys; 'other'/'unaligned' are intentionally excluded (chart noise).
const BUCKET_META = [
  { key: 'pro-reopening', label: 'Pro-reopening', color: '#98c379' },
  { key: 'hardline-closure', label: 'Hardline-closure', color: '#fb7185' },
  { key: 'pro-us', label: 'Pro-U.S.', color: '#61afef' },
  { key: 'anti-west', label: 'Anti-West', color: '#c678dd' },
  { key: 'anti-iran', label: 'Anti-Iran', color: '#e5c07b' },
  { key: 'neutral', label: 'Neutral', color: '#6b8a94' },
  { key: 'mixed', label: 'Mixed', color: '#abb2bf' },
]

function num(v) {
  return Number.isFinite(Number(v)) ? Number(v) : 0
}

const BUCKET_COLOR = Object.fromEntries(BUCKET_META.map((b) => [b.key, b.color]))

/** Hex color for a raw faction label's normalized bucket (shared by the chart,
 * scoreboard and network so a bloc is the same color everywhere). */
export function factionColor(raw) {
  return BUCKET_COLOR[normalizeFaction(raw)] || '#6b8a94'
}

/**
 * @param {object} metrics  the /metrics payload
 * @param {object} [opts]   { minActions=2, maxBuckets=6 }
 * @returns {{rounds: number[], series: Array<{key,label,color,scores:(number|null)[],totalN:number}>}}
 *          one entry per round in `rounds`; `scores[i]` aligns to `rounds[i]`.
 */
export function factionSentimentSeries(metrics, { minActions = 2, maxBuckets = 6 } = {}) {
  const perRound = Array.isArray(metrics?.per_round) ? metrics.per_round : []
  if (!perRound.length) return { rounds: [], series: [] }

  const rounds = perRound.map((r) => num(r?.round))
  // bloc key -> per-round {pos, neg, neu} accumulator (one cell per round)
  const byBucket = new Map()
  perRound.forEach((slot, idx) => {
    const fs = slot?.faction_sentiment
    if (!fs || typeof fs !== 'object') return
    for (const [rawFaction, counts] of Object.entries(fs)) {
      const bucket = normalizeFaction(rawFaction)
      if (!byBucket.has(bucket)) {
        byBucket.set(bucket, rounds.map(() => ({ pos: 0, neg: 0, neu: 0 })))
      }
      const cell = byBucket.get(bucket)[idx]
      cell.pos += num(counts?.positive)
      cell.neg += num(counts?.negative)
      cell.neu += num(counts?.neutral)
    }
  })

  const series = []
  for (const meta of BUCKET_META) {
    const cells = byBucket.get(meta.key)
    if (!cells) continue
    let totalN = 0
    const scores = cells.map((c) => {
      const n = c.pos + c.neg + c.neu
      totalN += n
      return n >= minActions ? (c.pos - c.neg) / n : null
    })
    if (totalN === 0) continue
    series.push({ ...meta, scores, totalN })
  }
  series.sort((a, b) => b.totalN - a.totalN)
  return { rounds, series: series.slice(0, maxBuckets) }
}

/**
 * Per-round "discourse lean" toward the question's answer: the reopening-stance
 * bloc's share of stance-bloc activity minus the closure-stance bloc's, in
 * [-1, 1] (+1 = the reopening side dominated the round, -1 = the closure side).
 * Share-based (robust) and labelled "lean" — it measures what the DISCOURSE
 * implies, never a probability/forecast (operator's documented-not-fabricated
 * bar). null when neither stance bloc acted that round. Mirrors
 * metrics.json per_round[].by_faction.
 */
export function verdictLeanSeries(metrics) {
  const per = Array.isArray(metrics?.per_round) ? metrics.per_round : []
  return per.map((slot) => {
    const bf = slot?.by_faction || {}
    let reopen = 0
    let closure = 0
    for (const [raw, c] of Object.entries(bf)) {
      const k = normalizeFaction(raw)
      if (k === 'pro-reopening') reopen += num(c)
      else if (k === 'hardline-closure') closure += num(c)
    }
    const total = reopen + closure
    return { round: num(slot?.round), lean: total ? (reopen - closure) / total : null }
  })
}

function scoreRead(score) {
  if (score > 0.1) return 'net positive'
  if (score < -0.1) return 'net negative'
  return 'divided / split'
}

/**
 * Run-total faction scoreboard: each bloc's share of the classified content and
 * its net sentiment, with a plain-language read — the readable replacement for
 * the 6-line spaghetti chart ("who argued what, and who prevailed"). Volume and
 * score share ONE denominator (classified posts) so the bar and the score
 * describe the same thing. Mirrors metrics.json faction_sentiment (run-total).
 */
export function factionScoreboard(metrics, { maxBlocs = 7 } = {}) {
  const sent = metrics?.faction_sentiment
  if (!sent || typeof sent !== 'object') return []
  const byBucket = new Map()
  for (const [raw, s] of Object.entries(sent)) {
    const k = normalizeFaction(raw)
    const cell = byBucket.get(k) || { pos: 0, neg: 0, neu: 0 }
    cell.pos += num(s?.positive)
    cell.neg += num(s?.negative)
    cell.neu += num(s?.neutral)
    byBucket.set(k, cell)
  }
  const totalN = [...byBucket.values()].reduce((t, c) => t + c.pos + c.neg + c.neu, 0) || 1
  const rows = []
  for (const meta of BUCKET_META) {
    const cell = byBucket.get(meta.key)
    if (!cell) continue
    const n = cell.pos + cell.neg + cell.neu
    if (!n) continue
    const score = (cell.pos - cell.neg) / n
    rows.push({ ...meta, posts: n, share: n / totalN, score, read: scoreRead(score) })
  }
  rows.sort((a, b) => b.posts - a.posts)
  return rows.slice(0, maxBlocs)
}
