import { describe, it, expect } from 'vitest'
import { factionScoreboard, factionSentimentSeries, verdictLeanSeries } from '../factions.js'

describe('verdictLeanSeries', () => {
  // per-round "discourse lean": reopening-stance vs closure-stance share of
  // their combined activity. +1 = reopening side dominates, -1 = closure side.
  const M = {
    per_round: [
      { round: 0, by_faction: { 'pro-reopening': 4, 'hardline-closure': 1, mixed: 10 } },
      { round: 1, by_faction: { 'hardline-closure': 3 } },
      { round: 2, by_faction: { mixed: 5 } }, // no stance bloc -> null (line breaks)
      { round: 3, by_faction: { 'pragmatic-reopening (conditional)': 6 } }, // folds to pro-reopening
    ],
  }

  it('scores each round by reopening-vs-closure stance share, folding variants', () => {
    const s = verdictLeanSeries(M)
    expect(s.map((p) => p.round)).toEqual([0, 1, 2, 3])
    expect(s[0].lean).toBeCloseTo((4 - 1) / 5) // 0.6
    expect(s[1].lean).toBe(-1) // only closure acted
    expect(s[2].lean).toBeNull() // no stance bloc that round
    expect(s[3].lean).toBe(1) // folded variant counts as reopening
  })

  it('returns [] for missing per_round', () => {
    expect(verdictLeanSeries(null)).toEqual([])
  })
})

describe('factionScoreboard', () => {
  // run-total faction_sentiment, with a noisy variant that must fold in
  const M = {
    faction_sentiment: {
      'pro-reopening': { positive: 6, negative: 1, neutral: 3 }, // n=10
      'pragmatic-reopening (conditional)': { positive: 0, negative: 0, neutral: 2 }, // -> pro-reopening, n+2
      'hardline-closure': { positive: 1, negative: 5, neutral: 2 }, // n=8
    },
  }

  it('ranks blocs by content volume, folds variants, scores each, with a plain read', () => {
    const rows = factionScoreboard(M)
    expect(rows.map((r) => r.key)).toEqual(['pro-reopening', 'hardline-closure'])
    const pro = rows[0]
    expect(pro.posts).toBe(12) // 10 + folded 2
    expect(pro.score).toBeCloseTo((6 - 1) / 12)
    expect(pro.read.toLowerCase()).toContain('positive')
    expect(pro.share).toBeCloseTo(12 / 20)
    expect(rows[1].read.toLowerCase()).toContain('negative')
  })

  it('returns [] for missing/empty data', () => {
    expect(factionScoreboard(null)).toEqual([])
    expect(factionScoreboard({ faction_sentiment: {} })).toEqual([])
  })
})

// Mirrors metrics.json per_round[].faction_sentiment (raw free-text faction ->
// {positive, negative, neutral} for that round). factionSentimentSeries folds
// the ~300 raw labels into coarse blocs and computes a per-round score.
const METRICS = {
  per_round: [
    {
      round: 0,
      faction_sentiment: {
        'pro-reopening': { positive: 3, negative: 0, neutral: 1 },
        'hardline-closure': { positive: 0, negative: 3, neutral: 1 },
      },
    },
    {
      round: 1,
      faction_sentiment: {
        // a noisy variant that must fold into the pro-reopening bloc
        'pragmatic-reopening (conditional)': { positive: 2, negative: 0, neutral: 0 },
        // a thin hardline round (1 action) -> gated to null at minActions=2
        'hardline-closure': { positive: 0, negative: 1, neutral: 0 },
      },
    },
  ],
}

describe('factionSentimentSeries', () => {
  it('folds raw faction variants into coarse blocs and scores each round', () => {
    const { rounds, series } = factionSentimentSeries(METRICS, { minActions: 2 })
    expect(rounds).toEqual([0, 1])
    const pro = series.find((s) => s.key === 'pro-reopening')
    // round 0: (3-0)/4 = 0.75 ; round 1 (folded variant): (2-0)/2 = 1
    expect(pro.scores).toEqual([0.75, 1])
    expect(pro.color).toBeTypeOf('string')
    expect(pro.label).toBe('Pro-reopening')
  })

  it('gates a round below the minActions threshold to null (line breaks)', () => {
    const { series } = factionSentimentSeries(METRICS, { minActions: 2 })
    const hard = series.find((s) => s.key === 'hardline-closure')
    // round 0 has 4 actions -> scored; round 1 has 1 action -> null
    expect(hard.scores[0]).toBeCloseTo(-0.75)
    expect(hard.scores[1]).toBeNull()
  })

  it('orders blocs by total volume and caps the count', () => {
    const { series } = factionSentimentSeries(METRICS, { minActions: 1, maxBuckets: 1 })
    expect(series).toHaveLength(1)
    // pro-reopening (6 actions) outranks hardline-closure (5)
    expect(series[0].key).toBe('pro-reopening')
  })

  it('returns empty structure for missing / empty metrics', () => {
    expect(factionSentimentSeries(null)).toEqual({ rounds: [], series: [] })
    expect(factionSentimentSeries({ per_round: [] })).toEqual({ rounds: [], series: [] })
  })
})
