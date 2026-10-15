import { describe, it, expect } from 'vitest'
import {
  normalizeFaction,
  feedThroughRound,
  sortPosts,
  roundActivity,
} from '../storyfeed.js'

// Mirrors the backend /feed payload shape (app/services/feed.py build_feed):
// posts[] each with round, seq, author{}, score, comments[] (same node shape).
const FEED = {
  platform: 'reddit',
  max_round: 3,
  posts: [
    {
      post_id: 1, round: 0, seq: 10, score: 8,
      author: { username: 'alice_p', tier: 'protagonist', faction: 'pro-reopening', protagonist: true },
      content: 'Opening post', num_likes: 9, num_dislikes: 1,
      comments: [
        { comment_id: 1, round: 1, seq: 20, score: 3,
          author: { username: 'cara_c', tier: 'crowd_llm', faction: 'hardline-closure' },
          content: 'reply A', num_likes: 3, num_dislikes: 0 },
        { comment_id: 2, round: 3, seq: 40, score: 0,
          author: { username: 'ghost', tier: 'unknown', faction: null },
          content: 'late reply', num_likes: 0, num_dislikes: 0 },
      ],
    },
    {
      post_id: 2, round: 2, seq: 30, score: 5,
      author: { username: 'cara_c', tier: 'crowd_llm', faction: 'neutral', protagonist: false },
      content: 'Second post', num_likes: 5, num_dislikes: 0,
      comments: [],
    },
  ],
}

describe('normalizeFaction', () => {
  it('maps the canonical high-volume blocs to stable bucket keys', () => {
    expect(normalizeFaction('pro-reopening')).toBe('pro-reopening')
    expect(normalizeFaction('hardline-closure')).toBe('hardline-closure')
    expect(normalizeFaction('pro-U.S.')).toBe('pro-us')
    expect(normalizeFaction('anti-West')).toBe('anti-west')
    expect(normalizeFaction('anti-Iran')).toBe('anti-iran')
    expect(normalizeFaction('neutral')).toBe('neutral')
    expect(normalizeFaction('mixed')).toBe('mixed')
  })

  it('folds noisy free-text variants into their bloc (case/separator-insensitive)', () => {
    expect(normalizeFaction('Pragmatic-reopening (conditional)')).toBe('pro-reopening')
    expect(normalizeFaction('cautious reopening')).toBe('pro-reopening')
    expect(normalizeFaction('Hardline closure stance')).toBe('hardline-closure')
  })

  it('buckets unknown labels as "other" and missing as "unaligned"', () => {
    expect(normalizeFaction('something idiosyncratic')).toBe('other')
    expect(normalizeFaction(null)).toBe('unaligned')
    expect(normalizeFaction('')).toBe('unaligned')
    expect(normalizeFaction(42)).toBe('unaligned')
  })
})

describe('feedThroughRound', () => {
  it('hides posts authored after the playback round', () => {
    const shown = feedThroughRound(FEED, 1)
    expect(shown.map((p) => p.post_id)).toEqual([1]) // post 2 is round 2
  })

  it('hides comments authored after the playback round but keeps their post', () => {
    const shown = feedThroughRound(FEED, 1)
    expect(shown[0].comments.map((c) => c.comment_id)).toEqual([1]) // comment 2 is round 3
  })

  it('reveals everything at the final round', () => {
    const shown = feedThroughRound(FEED, 3)
    expect(shown.map((p) => p.post_id)).toEqual([1, 2])
    expect(shown[0].comments).toHaveLength(2)
  })

  it('does not mutate the input feed', () => {
    feedThroughRound(FEED, 1)
    expect(FEED.posts[0].comments).toHaveLength(2)
  })

  it('shows a node whose round is null from the very start (round 0)', () => {
    // a real live-run join miss leaves round===null; it must be visible, not lost
    const feed = {
      max_round: 2,
      posts: [{
        post_id: 7, round: null, seq: 5, score: 0, author: {}, content: 'x',
        comments: [{ comment_id: 9, round: null, seq: 6, score: 0, author: {}, content: 'y' }],
      }],
    }
    const shown = feedThroughRound(feed, 0)
    expect(shown.map((p) => p.post_id)).toEqual([7])
    expect(shown[0].comments.map((c) => c.comment_id)).toEqual([9])
  })

  it('tolerates junk input', () => {
    expect(feedThroughRound(null, 1)).toEqual([])
    expect(feedThroughRound({ posts: 'nope' }, 1)).toEqual([])
  })
})

describe('sortPosts', () => {
  it('"latest" orders by post seq, newest first', () => {
    const out = sortPosts(FEED.posts, 'latest')
    expect(out.map((p) => p.post_id)).toEqual([2, 1])
  })

  it('"top" orders by score, highest first', () => {
    const out = sortPosts(FEED.posts, 'top')
    expect(out.map((p) => p.post_id)).toEqual([1, 2]) // 8 vs 5
  })

  it('"active" bumps posts by their latest comment activity', () => {
    // post 1 last activity seq 40 (its comment), post 2 seq 30 -> post 1 first
    const out = sortPosts(FEED.posts, 'active')
    expect(out.map((p) => p.post_id)).toEqual([1, 2])
  })

  it('breaks a score tie by seq (newer first) so order is deterministic', () => {
    const tied = [
      { post_id: 1, score: 5, seq: 10, comments: [] },
      { post_id: 2, score: 5, seq: 20, comments: [] },
    ]
    expect(sortPosts(tied, 'top').map((p) => p.post_id)).toEqual([2, 1])
  })

  it('does not mutate the input array', () => {
    const before = FEED.posts.map((p) => p.post_id)
    sortPosts(FEED.posts, 'top')
    expect(FEED.posts.map((p) => p.post_id)).toEqual(before)
  })

  it('tolerates junk input', () => {
    expect(sortPosts(null, 'top')).toEqual([])
    expect(sortPosts('nope', 'latest')).toEqual([])
  })
})

describe('roundActivity', () => {
  it('counts new posts and comments per round across the whole run', () => {
    const rows = roundActivity(FEED)
    expect(rows).toHaveLength(4) // rounds 0..3
    expect(rows[0]).toMatchObject({ round: 0, posts: 1, comments: 0 })
    expect(rows[1]).toMatchObject({ round: 1, posts: 0, comments: 1 })
    expect(rows[2]).toMatchObject({ round: 2, posts: 1, comments: 0 })
    expect(rows[3]).toMatchObject({ round: 3, posts: 0, comments: 1 })
  })

  it('yields exactly one row for a single-round run (max_round == 0)', () => {
    const rows = roundActivity({
      max_round: 0,
      posts: [{ round: 0, comments: [{ round: 0 }] }],
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ round: 0, posts: 1, comments: 1 })
  })

  it('tolerates junk / empty input', () => {
    expect(roundActivity(null)).toEqual([])
    expect(roundActivity({ posts: [], max_round: -1 })).toEqual([])
  })
})
