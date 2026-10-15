import { describe, it, expect } from 'vitest'
import {
  bandRects,
  barRects,
  gappedPolylines,
  playheadX,
  polylinePoints,
  segmentPoints,
  signSegments,
} from '../sparkline.js'

describe('bandRects', () => {
  it('merges contiguous rounds into one band spanning their cells', () => {
    // total=8 over w=700 -> step=100, half-cell=50; rounds 1..3 center 100..300
    expect(bandRects([1, 2, 3], 8, 700, 100)).toEqual([
      { x: 50, y: 0, width: 300, height: 100 },
    ])
  })

  it('keeps non-contiguous rounds as separate bands', () => {
    const rects = bandRects([1, 3], 8, 700, 100)
    expect(rects).toHaveLength(2)
    expect(rects[0]).toEqual({ x: 50, y: 0, width: 100, height: 100 })
    expect(rects[1]).toEqual({ x: 250, y: 0, width: 100, height: 100 })
  })

  it('clamps to the chart box and returns [] for empty', () => {
    const rects = bandRects([0], 8, 700, 100)
    expect(rects[0].x).toBe(0) // left cell clamps at 0
    expect(bandRects([], 8, 700, 100)).toEqual([])
  })
})

describe('playheadX', () => {
  it('maps a round to its x across the round axis', () => {
    expect(playheadX(0, 8, 700)).toBe(0)
    expect(playheadX(7, 8, 700)).toBe(700)
    expect(playheadX(1, 8, 700)).toBe(100)
  })
})

describe('gappedPolylines', () => {
  it('breaks the line at null/non-finite gaps (one polyline per finite run)', () => {
    // index 0 -> x0, index 2 -> x100; domain [-1,1]: 0 -> y5, 1 -> y0
    const segs = gappedPolylines([0, null, 1], 100, 10, { min: -1, max: 1 })
    expect(segs).toEqual(['0,5', '100,0'])
  })

  it('keeps a contiguous finite run as a single polyline', () => {
    expect(gappedPolylines([0, 0.5, 1], 100, 10, { min: -1, max: 1 }))
      .toEqual(['0,5 50,2.5 100,0'])
  })

  it('returns [] when nothing is finite', () => {
    expect(gappedPolylines([], 100, 10)).toEqual([])
    expect(gappedPolylines([null, NaN, undefined], 100, 10, { min: -1, max: 1 })).toEqual([])
  })
})

describe('polylinePoints', () => {
  it('spans the full width and inverts y (max on top)', () => {
    // values 0..2 over a 100x10 box: min at y=10, max at y=0
    expect(polylinePoints([0, 1, 2], 100, 10)).toBe('0,10 50,5 100,0')
  })

  it('pins the domain via opts.min/max', () => {
    // sentiment-style fixed [-1, 1] domain: 0 sits mid-height
    expect(polylinePoints([0], 100, 10, { min: -1, max: 1 })).toBe('0,5')
  })

  it('centers a flat series instead of dividing by zero', () => {
    const points = polylinePoints([3, 3, 3], 100, 10)
    expect(points).toBe('0,5 50,5 100,5')
  })

  it('returns empty string for empty or non-array input', () => {
    expect(polylinePoints([], 100, 10)).toBe('')
    expect(polylinePoints(undefined, 100, 10)).toBe('')
  })

  it('places a single point at the left edge', () => {
    expect(polylinePoints([5], 100, 10)).toBe('0,5')
  })
})

describe('signSegments', () => {
  it('splits a series into maximal same-sign runs', () => {
    const segs = signSegments([1, 2, -1, -2, 3])
    expect(segs.map((s) => s.sign)).toEqual([1, -1, 1])
  })

  it('treats zero as positive', () => {
    const segs = signSegments([0, -1])
    expect(segs[0].sign).toBe(1)
    expect(segs[1].sign).toBe(-1)
  })

  it('bridges segments with the previous point so polylines stay connected', () => {
    const segs = signSegments([1, -1])
    expect(segs[0].pairs).toEqual([[0, 1]])
    expect(segs[1].pairs).toEqual([
      [0, 1], // repeated boundary point
      [1, -1],
    ])
  })

  it('keeps indices global across segments', () => {
    const segs = signSegments([-1, -2, 5])
    expect(segs[1].pairs).toEqual([
      [1, -2],
      [2, 5],
    ])
  })

  it('returns a single segment for an all-positive series', () => {
    const segs = signSegments([1, 2, 3])
    expect(segs).toHaveLength(1)
    expect(segs[0].pairs).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
    ])
  })

  it('returns [] for empty or non-array input', () => {
    expect(signSegments([])).toEqual([])
    expect(signSegments(null)).toEqual([])
  })
})

describe('segmentPoints', () => {
  it('scales segment pairs against the FULL series geometry', () => {
    // series of 3 points in a 100x10 box, pinned [-1, 1] domain
    const segs = signSegments([1, -1, 1])
    expect(segmentPoints(segs[0], 3, 100, 10, { min: -1, max: 1 })).toBe('0,0')
    expect(segmentPoints(segs[1], 3, 100, 10, { min: -1, max: 1 })).toBe('0,0 50,10')
    expect(segmentPoints(segs[2], 3, 100, 10, { min: -1, max: 1 })).toBe('50,10 100,0')
  })

  it('returns empty string for empty segments', () => {
    expect(segmentPoints(null, 3, 100, 10)).toBe('')
    expect(segmentPoints({ sign: 1, pairs: [] }, 3, 100, 10)).toBe('')
  })
})

describe('barRects', () => {
  it('emits one rect per value, scaled to the series max', () => {
    const rects = barRects([1, 2, 4], 120, 40)
    expect(rects).toHaveLength(3)
    expect(rects[2]).toEqual({ x: 80, y: 0, width: 38, height: 40 }) // max bar fills h
    expect(rects[0].height).toBe(10) // 1/4 of 40
    expect(rects[0].y).toBe(30)
  })

  it('gives zero values a 1px floor stub so empty rounds stay visible', () => {
    const rects = barRects([0, 4], 100, 40)
    expect(rects[0].height).toBe(1)
    expect(rects[0].y).toBe(39)
  })

  it('handles an all-zero series without dividing by zero', () => {
    const rects = barRects([0, 0], 100, 40)
    expect(rects.every((r) => r.height === 1)).toBe(true)
  })

  it('returns [] for empty or non-array input', () => {
    expect(barRects([], 100, 40)).toEqual([])
    expect(barRects(undefined, 100, 40)).toEqual([])
  })

  it('keeps a gap between bars', () => {
    const rects = barRects([1, 1], 100, 10, 2)
    expect(rects[0].width).toBe(48)
    expect(rects[1].x).toBe(50)
  })
})
