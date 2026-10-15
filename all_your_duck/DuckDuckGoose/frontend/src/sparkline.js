/**
 * Pure SVG sparkline math. No chart library, by design.
 * The views own the <svg> markup; this module owns every coordinate.
 *
 * Coordinate space: x spans [0, w] across the series indices, y spans
 * [0, h] with SVG's inverted axis (max value at y=0). All numbers are
 * rounded to 2 decimals so the emitted attributes stay stable and small.
 */

function round2(n) {
  return Math.round(n * 100) / 100
}

function domainOf(values, min, max) {
  let lo = min ?? Math.min(...values)
  let hi = max ?? Math.max(...values)
  if (!Number.isFinite(lo)) lo = 0
  if (!Number.isFinite(hi)) hi = 0
  if (lo === hi) {
    // flat series — pad so the line sits mid-height instead of dividing by 0
    lo -= 1
    hi += 1
  }
  return [lo, hi]
}

function xAt(i, count, w) {
  // a single point sits at the left edge; n points span the full width
  return count <= 1 ? 0 : (i / (count - 1)) * w
}

function yAt(v, lo, hi, h) {
  return h - ((v - lo) / (hi - lo)) * h
}

/**
 * "x,y x,y …" points attribute for an SVG <polyline> over a numeric
 * series. opts.min / opts.max pin the y-domain (e.g. [-1, 1] for
 * sentiment scores); by default the domain is the series' own min/max.
 * Empty / non-array input yields ''.
 */
export function polylinePoints(values, w, h, opts = {}) {
  const series = Array.isArray(values) ? values.map(Number) : []
  if (!series.length) return ''
  const [lo, hi] = domainOf(series, opts.min, opts.max)
  return series
    .map((v, i) => `${round2(xAt(i, series.length, w))},${round2(yAt(v, lo, hi, h))}`)
    .join(' ')
}

/** x-coordinate of a round on the shared round axis (same mapping the polylines
 * use), for drawing a playhead / vertical marker. */
export function playheadX(round, total, w) {
  return round2(xAt(num(round), num(total), w))
}

function num(v) {
  return Number.isFinite(Number(v)) ? Number(v) : 0
}

/**
 * Background band rects for a set of rounds (e.g. the elite-only "night"
 * rounds), drawn behind the chart so every point is read inside its regime.
 * Contiguous rounds merge into one band; each band spans the half-cell on
 * either side of its rounds' centers, clamped to [0, w]. Returns
 * [{x, y:0, width, height:h}].
 */
export function bandRects(rounds, total, w, h) {
  const set = [...new Set((Array.isArray(rounds) ? rounds : [])
    .map(Number).filter(Number.isFinite))].sort((a, b) => a - b)
  if (!set.length || !total) return []
  const center = (i) => (total > 1 ? (i / (total - 1)) * w : w / 2)
  const half = total > 1 ? w / (total - 1) / 2 : w / 2
  const spans = []
  let start = set[0]
  let prev = set[0]
  for (let i = 1; i < set.length; i += 1) {
    if (set[i] === prev + 1) prev = set[i]
    else {
      spans.push([start, prev])
      start = set[i]
      prev = set[i]
    }
  }
  spans.push([start, prev])
  return spans.map(([a, b]) => {
    const x = Math.max(0, center(a) - half)
    const right = Math.min(w, center(b) + half)
    return { x: round2(x), y: 0, width: round2(right - x), height: h }
  })
}

/**
 * Like polylinePoints but GAP-AWARE: null / non-finite values break the line.
 * Returns an array of point-strings, one per maximal run of finite values, all
 * scaled against the FULL series geometry (x = index across w, shared
 * y-domain). Used for per-bloc sentiment lines where a round with too little
 * data is left blank (null) rather than drawn as a misleading zero.
 */
export function gappedPolylines(values, w, h, opts = {}) {
  const series = Array.isArray(values) ? values : []
  const count = series.length
  const finite = series.map((v) =>
    typeof v === 'number' && Number.isFinite(v) ? v : null,
  )
  const present = finite.filter((v) => v !== null)
  if (!present.length) return []
  const [lo, hi] = domainOf(present, opts.min, opts.max)
  const segments = []
  let current = null
  finite.forEach((v, i) => {
    if (v === null) {
      current = null
      return
    }
    const pt = `${round2(xAt(i, count, w))},${round2(yAt(v, lo, hi, h))}`
    if (current) current.push(pt)
    else {
      current = [pt]
      segments.push(current)
    }
  })
  return segments.map((s) => s.join(' '))
}

/**
 * Split a series into maximal same-sign runs for sign-colored rendering
 * (>= 0 reads positive). Each segment after the first repeats the previous
 * point so consecutive polylines stay connected — the crossing stroke
 * takes the color of the segment it enters.
 *
 * Returns [{sign: 1|-1, pairs: [[index, value], …]}].
 */
export function signSegments(values) {
  const series = Array.isArray(values) ? values.map(Number) : []
  const segments = []
  let current = null
  series.forEach((v, i) => {
    const sign = v >= 0 ? 1 : -1
    if (current && current.sign === sign) {
      current.pairs.push([i, v])
      return
    }
    const pairs = []
    if (current) {
      const prev = current.pairs[current.pairs.length - 1]
      pairs.push([prev[0], prev[1]]) // bridge point keeps the line continuous
    }
    pairs.push([i, v])
    current = { sign, pairs }
    segments.push(current)
  })
  return segments
}

/**
 * Points attribute for ONE signSegments() segment, scaled against the FULL
 * series geometry (count points across w, shared y-domain) so segments
 * overlay into a single visual polyline.
 */
export function segmentPoints(segment, count, w, h, opts = {}) {
  const pairs = segment?.pairs ?? []
  if (!pairs.length || !count) return ''
  const [lo, hi] = domainOf(
    pairs.map(([, v]) => v),
    opts.min,
    opts.max,
  )
  return pairs
    .map(([i, v]) => `${round2(xAt(i, count, w))},${round2(yAt(v, lo, hi, h))}`)
    .join(' ')
}

/**
 * Bar geometry for a per-round volume chart: one {x, y, width, height}
 * rect per value, heights scaled to the series max, 2px gap between bars.
 * Zero values get a 1px floor stub so empty rounds stay visible.
 */
export function barRects(values, w, h, gap = 2) {
  const series = Array.isArray(values) ? values.map(Number) : []
  if (!series.length) return []
  const max = Math.max(...series, 1)
  const step = w / series.length
  const width = Math.max(step - gap, 1)
  return series.map((v, i) => {
    const height = Math.max(round2((v / max) * h), v > 0 ? 1 : 0)
    const floor = v > 0 ? height : 1
    return {
      x: round2(i * step),
      y: round2(h - floor),
      width: round2(width),
      height: round2(floor),
    }
  })
}
