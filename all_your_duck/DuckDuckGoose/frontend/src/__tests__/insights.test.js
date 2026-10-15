import { describe, it, expect } from 'vitest'
import {
  chartCaptions,
  inflections,
  nightRounds,
  storyBeats,
  summarize,
  verdictExplain,
  volumeForChart,
} from '../insights.js'

// Mirrors metrics.json. r0 is the follow-burst outlier (60 actions, crowd-active
// -> protagonist_share 0); rounds 1 and 3 are elite-only "night" rounds
// (protagonist_share == 1.0). Round 3 holds the global sentiment low.
const METRICS = {
  total_actions: 100,
  rounds_observed: 4,
  per_round: [
    { round: 0, actions: 60, sentiment: { positive: 1, negative: 0, neutral: 1 } },
    { round: 1, actions: 10, sentiment: { positive: 0, negative: 3, neutral: 1 } },
    { round: 2, actions: 25, sentiment: { positive: 4, negative: 1, neutral: 2 } },
    { round: 3, actions: 5, sentiment: { positive: 0, negative: 3, neutral: 1 } },
  ],
  sentiment_trend: [
    { round: 0, score: 0.1 },
    { round: 1, score: -0.3 },
    { round: 2, score: 0.2 },
    { round: 3, score: -0.375 },
  ],
  divergence: [
    { round: 0, protagonist_share: 0.0 },
    { round: 1, protagonist_share: 1.0 },
    { round: 2, protagonist_share: 0.2 },
    { round: 3, protagonist_share: 1.0 },
  ],
}

describe('nightRounds', () => {
  it('returns the elite-only rounds (protagonist_share == 1.0)', () => {
    expect(nightRounds(METRICS)).toEqual([1, 3])
  })
  it('excludes the crowd-active follow-burst (r0, share ~0) and tolerates junk', () => {
    expect(nightRounds({ divergence: [{ round: 0, protagonist_share: 0.006 }] })).toEqual([])
    expect(nightRounds(null)).toEqual([])
  })
})

describe('summarize', () => {
  it('computes the run-level facts the captions need', () => {
    const s = summarize(METRICS)
    expect(s.minSentiment).toEqual({ round: 3, score: -0.375 })
    expect(s.maxSentiment).toEqual({ round: 2, score: 0.2 })
    // real actions strip r0's follow-burst: 100 - 60 = 40
    expect(s.realActions).toBe(40)
    expect(s.burst).toEqual({ round: 0, actions: 60 })
    // busiest discourse round excludes r0
    expect(s.peakRound).toEqual({ round: 2, actions: 25 })
    expect(s.nightRounds).toEqual([1, 3])
    expect(s.minIsNight).toBe(true) // the low (r3) is a night round
  })
})

describe('chartCaptions', () => {
  it('the sentiment caption names the low, its round, and that it was a night round', () => {
    const c = chartCaptions(METRICS)
    expect(c.sentiment).toContain('round 3')
    expect(c.sentiment.toLowerCase()).toContain('night')
    expect(c.sentiment.toLowerCase()).toContain('low') // names the low explicitly
  })
  it('the volume caption strips the follow-burst and names the busiest round', () => {
    const c = chartCaptions(METRICS)
    expect(c.volume).toContain('40') // real actions
    expect(c.volume).toContain('60') // the excluded burst
    expect(c.volume).toContain('round 2') // busiest
  })
  it('the divergence caption counts the night rounds', () => {
    const c = chartCaptions(METRICS)
    expect(c.divergence).toContain('2') // two night rounds
    expect(c.divergence.toLowerCase()).toContain('night')
  })
  it('degrades gracefully on empty metrics', () => {
    const c = chartCaptions({ per_round: [], sentiment_trend: [], divergence: [] })
    expect(typeof c.sentiment).toBe('string')
    expect(typeof c.volume).toBe('string')
  })
})

describe('inflections', () => {
  it('always includes the global low and high, tagged by kind, sorted by round', () => {
    const pins = inflections(METRICS.sentiment_trend, 5)
    const low = pins.find((p) => p.kind === 'low')
    const high = pins.find((p) => p.kind === 'high')
    expect(low).toMatchObject({ round: 3, score: -0.375 })
    expect(high).toMatchObject({ round: 2, score: 0.2 })
    expect(pins.map((p) => p.round)).toEqual([...pins.map((p) => p.round)].sort((a, b) => a - b))
  })
  it('caps the number of pins and tolerates junk', () => {
    expect(inflections(METRICS.sentiment_trend, 2).length).toBeLessThanOrEqual(2)
    expect(inflections(null)).toEqual([])
    expect(inflections([{ round: 0, score: 0.5 }])).toHaveLength(1)
  })
})

describe('volumeForChart', () => {
  it('separates the r0 follow-burst from the real discourse rounds', () => {
    const v = volumeForChart(METRICS)
    expect(v.burst).toEqual({ round: 0, actions: 60 })
    expect(v.rounds.map((r) => r.round)).toEqual([1, 2, 3])
    expect(v.values).toEqual([10, 25, 5]) // the bars the chart scales to
  })
  it('handles a run with no follow-burst (no off-scale r0)', () => {
    const v = volumeForChart({
      per_round: [
        { round: 0, actions: 12 },
        { round: 1, actions: 20 },
      ],
      actions_by_type: { create_post: 32 },
    })
    expect(v.burst).toBeNull()
    expect(v.values).toEqual([12, 20])
  })
})

describe('verdictExplain', () => {
  it('turns a bare confidence number into a self-explaining band + sentence', () => {
    const v = verdictExplain({ answer: 'NO', confidence: 0.3 })
    expect(v.pct).toBe(30)
    expect(v.band).toBe('low')
    expect(v.text).toContain('30%')
  })
  it('bands moderate and high confidence', () => {
    expect(verdictExplain({ confidence: 0.5 }).band).toBe('moderate')
    expect(verdictExplain({ confidence: 0.8 }).band).toBe('high')
  })
  it('degrades on missing direction', () => {
    expect(verdictExplain(null).pct).toBe(null)
  })
})

describe('storyBeats', () => {
  it('produces grounded beats covering the low and the busiest round, sorted', () => {
    const beats = storyBeats(METRICS)
    expect(beats.length).toBeGreaterThan(0)
    expect(beats.every((b) => Number.isInteger(b.round) && typeof b.text === 'string')).toBe(true)
    expect(beats.map((b) => b.round)).toEqual([...beats.map((b) => b.round)].sort((a, b) => a - b))
    const text = beats.map((b) => b.text).join(' ').toLowerCase()
    expect(text).toContain('round 3') // the sentiment low
    expect(text).toContain('round 2') // the busiest discourse round
    expect(text).toContain('night') // names the regime
  })
  it('returns [] for empty metrics', () => {
    expect(storyBeats({ per_round: [], sentiment_trend: [], divergence: [] })).toEqual([])
  })
})
