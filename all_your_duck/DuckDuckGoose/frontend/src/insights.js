/**
 * Pure logic that makes the metrics charts SELF-EXPLAINING (operator pref #2:
 * "numbers/signals must explain themselves" — a black box he can't interrogate
 * makes him distrust the underlying thing). Everything here is deterministic
 * and grounded in metrics.json — no LLM, no fabrication. Mirrors metrics.json
 * (app/services/metrics.py).
 *
 * The core idea: a sentiment point at round 15 (−0.375) drawn the same height
 * as round 19 (−0.10) hides that the first rests on ~16 posts from only the 22
 * elites (a "night" round, the crowd asleep) while the second rests on ~89
 * posts in the loudest round of the run. These helpers expose that regime.
 */

function num(v) {
  return Number.isFinite(Number(v)) ? Number(v) : 0
}

function fmt(n) {
  const r = Math.round(num(n) * 100) / 100
  return (r >= 0 ? '+' : '') + r.toFixed(2)
}

/** Rounds where ONLY the protagonists acted (elite-only "night" rounds). The
 * crowd-active follow-burst at r0 (share ~0) is correctly excluded. */
export function nightRounds(metrics) {
  const div = Array.isArray(metrics?.divergence) ? metrics.divergence : []
  return div
    .filter((d) => num(d?.protagonist_share) >= 0.999)
    .map((d) => num(d.round))
}

/** The r0 follow-burst is an off-scale outlier (12k graph-wiring follows) that
 * makes every real round a 1px bar. Split it out so the discourse rounds are
 * legible. Detected structurally: r0 dwarfs (>2x) the busiest real round. */
export function volumeForChart(metrics) {
  const per = Array.isArray(metrics?.per_round) ? metrics.per_round : []
  if (!per.length) return { burst: null, rounds: [], values: [] }
  const r0 = per[0]
  const rest = per.slice(1)
  const maxRest = rest.reduce((m, r) => Math.max(m, num(r.actions)), 0)
  if (rest.length && num(r0.actions) > 2 * maxRest) {
    return {
      burst: { round: num(r0.round), actions: num(r0.actions) },
      rounds: rest,
      values: rest.map((r) => num(r.actions)),
    }
  }
  return { burst: null, rounds: per, values: per.map((r) => num(r.actions)) }
}

/** Run-level facts the captions and verdict panel are built from. */
export function summarize(metrics) {
  const trend = (Array.isArray(metrics?.sentiment_trend) ? metrics.sentiment_trend : [])
    .filter((p) => p && Number.isFinite(p.score))
  const per = Array.isArray(metrics?.per_round) ? metrics.per_round : []
  const nights = nightRounds(metrics)
  const vol = volumeForChart(metrics)
  const total = num(metrics?.total_actions) || per.reduce((s, r) => s + num(r.actions), 0)
  const minS = trend.length ? trend.reduce((a, b) => (b.score < a.score ? b : a)) : null
  const maxS = trend.length ? trend.reduce((a, b) => (b.score > a.score ? b : a)) : null
  const mean = trend.length ? trend.reduce((s, p) => s + p.score, 0) / trend.length : 0
  const peak = vol.rounds.length
    ? vol.rounds.reduce((a, b) => (num(b.actions) > num(a.actions) ? b : a))
    : null
  return {
    rounds: metrics?.rounds_observed ?? per.length,
    meanSentiment: mean,
    minSentiment: minS ? { round: num(minS.round), score: minS.score } : null,
    maxSentiment: maxS ? { round: num(maxS.round), score: maxS.score } : null,
    realActions: total - (vol.burst ? vol.burst.actions : 0),
    burst: vol.burst,
    peakRound: peak ? { round: num(peak.round), actions: num(peak.actions) } : null,
    nightRounds: nights,
    minIsNight: minS ? nights.includes(num(minS.round)) : false,
  }
}

function tone(mean) {
  if (mean < -0.05) return 'mostly negative'
  if (mean > 0.05) return 'mostly positive'
  return 'flat and mixed'
}

function mergeRuns(nums) {
  const set = [...new Set((Array.isArray(nums) ? nums : []).map(num))].sort((a, b) => a - b)
  const runs = []
  if (!set.length) return runs
  let start = set[0]
  let prev = set[0]
  for (let i = 1; i < set.length; i += 1) {
    if (set[i] === prev + 1) prev = set[i]
    else {
      runs.push([start, prev])
      start = set[i]
      prev = set[i]
    }
  }
  runs.push([start, prev])
  return runs
}

/** Turn the report's bare confidence number into a self-explaining band +
 * sentence (pref #2). Degrades to nulls without a direction. */
export function verdictExplain(direction) {
  const c = Number(direction?.confidence)
  if (!Number.isFinite(c)) return { pct: null, band: null, text: '' }
  const conf = Math.max(0, Math.min(1, c))
  const pct = Math.round(conf * 100)
  const band = conf >= 0.66 ? 'high' : conf >= 0.34 ? 'moderate' : 'low'
  const phrase = {
    high: 'the discourse points clearly this way',
    moderate: 'the discourse leans this way but is contested',
    low: 'a directional read only — the discourse leans this way but is far from settled',
  }[band]
  return { pct, band, text: `${pct}% confidence — ${phrase}.` }
}

/** Deterministic, grounded story beats — the run as a readable spine. Free,
 * always present, factual (pref #5: substance over auto-generated fluff). */
export function storyBeats(metrics) {
  const s = summarize(metrics)
  const per = Array.isArray(metrics?.per_round) ? metrics.per_round : []
  if (!per.length || !s.minSentiment) return []
  const beats = []
  const spans = mergeRuns(s.nightRounds)
  if (spans.length) {
    const [a, b] = spans[0]
    beats.push({
      round: a,
      text: a === b
        ? `Round ${a} (night): only the 22 principals post — the crowd is asleep — as positions are staked out.`
        : `Rounds ${a}–${b} (night): the 22 principals stake out positions while the crowd is asleep.`,
    })
  }
  if (s.peakRound) {
    beats.push({
      round: s.peakRound.round,
      text: `Round ${s.peakRound.round}: peak engagement — ${s.peakRound.actions} actions, the debate's loudest moment.`,
    })
  }
  beats.push({
    round: s.minSentiment.round,
    text: `Round ${s.minSentiment.round}${s.minIsNight ? ' (night)' : ''}: net mood bottoms at ` +
      `${fmt(s.minSentiment.score)}, the run's low${s.minIsNight ? ' — and only the principals were posting' : ''}.`,
  })
  const trend = Array.isArray(metrics?.sentiment_trend) ? metrics.sentiment_trend : []
  const last = trend[trend.length - 1]
  if (last) {
    beats.push({
      round: num(last.round),
      text: `By round ${num(last.round)}: net mood ${tone(last.score)} (${fmt(last.score)}); ` +
        `${last.score > 0.05 ? 'a positive consensus had formed' : 'no positive consensus emerged'}.`,
    })
  }
  const seen = new Set()
  return beats
    .filter((bt) => (seen.has(bt.round) ? false : seen.add(bt.round)))
    .sort((a, b) => a.round - b.round)
}

/** Persistent plain-language caption per chart (NOT a tooltip — pref #2). */
export function chartCaptions(metrics) {
  const s = summarize(metrics)
  // sentiment
  let sentiment
  if (s.minSentiment && s.maxSentiment) {
    const where = s.minIsNight
      ? 'a night round — only the 22 principals were posting'
      : 'a busy crowd round'
    sentiment =
      `Net mood ran ${tone(s.meanSentiment)} (mean ${fmt(s.meanSentiment)}, ` +
      `range ${fmt(s.minSentiment.score)}…${fmt(s.maxSentiment.score)}). ` +
      `The low (${fmt(s.minSentiment.score)} at round ${s.minSentiment.round}) fell on ${where}.`
  } else {
    sentiment = 'No sentiment recorded yet.'
  }
  // volume
  let volume
  if (s.burst) {
    volume =
      `${s.realActions.toLocaleString()} real posts, comments and reactions over ` +
      `${s.rounds} rounds — round ${s.burst.round}'s ${s.burst.actions.toLocaleString()} ` +
      `follow-wirings are off-scale and excluded.` +
      (s.peakRound ? ` Busiest: round ${s.peakRound.round} (${s.peakRound.actions}).` : '')
  } else if (s.peakRound) {
    volume = `${s.realActions.toLocaleString()} actions over ${s.rounds} rounds. ` +
      `Busiest: round ${s.peakRound.round} (${s.peakRound.actions}).`
  } else {
    volume = 'No actions recorded yet.'
  }
  // divergence
  const n = s.nightRounds.length
  const divergence = n
    ? `${n} ${n === 1 ? 'round was' : 'rounds were'} elite-only "night" rounds ` +
      `(${s.nightRounds.join(', ')}) where only the principals posted; the crowd carried the rest.`
    : 'The crowd was active throughout — no elite-only rounds.'
  return { sentiment, volume, divergence }
}

/** Turning points on a {round, score} series for labelled pins. Always keeps
 * the global low and high; fills remaining slots with the most prominent other
 * extrema; sorted by round. */
export function inflections(series, maxPins = 5) {
  const arr = (Array.isArray(series) ? series : []).filter((p) => p && Number.isFinite(p.score))
  if (!arr.length) return []
  if (arr.length === 1) return [{ round: num(arr[0].round), score: arr[0].score, kind: 'high' }]

  const ext = []
  for (let i = 0; i < arr.length; i += 1) {
    const prev = arr[i - 1]
    const cur = arr[i]
    const next = arr[i + 1]
    let kind = null
    if (!prev) kind = cur.score <= next.score ? 'low' : 'high'
    else if (!next) kind = cur.score <= prev.score ? 'low' : 'high'
    else {
      const a = cur.score - prev.score
      const b = next.score - cur.score
      if (a <= 0 && b > 0) kind = 'low'
      else if (a >= 0 && b < 0) kind = 'high'
      else continue
    }
    ext.push({ round: num(cur.round), score: cur.score, kind, prom: Math.abs(cur.score) })
  }

  const gmin = arr.reduce((a, b) => (b.score < a.score ? b : a))
  const gmax = arr.reduce((a, b) => (b.score > a.score ? b : a))
  const out = [{ round: num(gmin.round), score: gmin.score, kind: 'low' }]
  if (num(gmax.round) !== num(gmin.round)) {
    out.push({ round: num(gmax.round), score: gmax.score, kind: 'high' })
  }
  // 'low'/'high' are reserved for THE global extremes; other notable turning
  // points are 'turn' so the view can render the two headline pins prominently.
  const taken = new Set(out.map((p) => p.round))
  ext
    .filter((e) => !taken.has(e.round))
    .sort((a, b) => b.prom - a.prom)
    .forEach((e) => {
      if (out.length < maxPins) {
        out.push({ round: e.round, score: e.score, kind: 'turn' })
        taken.add(e.round)
      }
    })
  return out.sort((a, b) => a.round - b.round).slice(0, maxPins)
}
