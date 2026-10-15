import { describe, it, expect } from 'vitest'
import { batchRows, EMPTY_CELL, fmtCell } from '../results.js'

describe('fmtCell', () => {
  it('renders null/undefined/empty as an em dash', () => {
    expect(fmtCell(null)).toBe(EMPTY_CELL)
    expect(fmtCell(undefined)).toBe(EMPTY_CELL)
    expect(fmtCell('')).toBe(EMPTY_CELL)
  })

  it('keeps zero and false-y numbers visible', () => {
    expect(fmtCell(0)).toBe('0')
    expect(fmtCell(0, 2)).toBe('0.00')
  })

  it('fixes decimals only when asked', () => {
    expect(fmtCell(0.333333, 2)).toBe('0.33')
    expect(fmtCell(0.333333)).toBe('0.333333')
  })
})

describe('batchRows', () => {
  it('maps the GET /batches/<id> shape to display rows', () => {
    const rows = batchRows({
      runs: [
        {
          run_id: 'run_aaa',
          status: 'finished',
          seed: 7,
          metrics_summary: {
            total_actions: 42,
            final_sentiment_score: -0.25,
            agents_engaged: 11,
            direction: { answer: 'panic spreads', confidence: 0.7 },
          },
        },
      ],
    })
    expect(rows).toEqual([
      {
        run_id: 'run_aaa',
        seed: '7',
        status: 'finished',
        total_actions: '42',
        final_sentiment_score: '-0.25',
        agents_engaged: '11',
        direction: 'panic spreads',
      },
    ])
  })

  it('renders missing metrics/report pieces as em dashes (backend nulls, never errors)', () => {
    const rows = batchRows({
      runs: [
        {
          run_id: 'run_bbb',
          status: 'failed',
          seed: null,
          metrics_summary: {
            total_actions: null,
            final_sentiment_score: null,
            agents_engaged: null,
            direction: null,
          },
        },
      ],
    })
    expect(rows[0]).toEqual({
      run_id: 'run_bbb',
      seed: EMPTY_CELL,
      status: 'failed',
      total_actions: EMPTY_CELL,
      final_sentiment_score: EMPTY_CELL,
      agents_engaged: EMPTY_CELL,
      direction: EMPTY_CELL,
    })
  })

  it('tolerates a missing metrics_summary object entirely', () => {
    const rows = batchRows({ runs: [{ run_id: 'run_ccc', status: 'queued' }] })
    expect(rows[0].total_actions).toBe(EMPTY_CELL)
    expect(rows[0].direction).toBe(EMPTY_CELL)
  })

  it('returns [] for malformed input', () => {
    expect(batchRows(null)).toEqual([])
    expect(batchRows({})).toEqual([])
    expect(batchRows({ runs: 'nope' })).toEqual([])
  })

  it('keeps one row per variant in response order', () => {
    const rows = batchRows({
      runs: [
        { run_id: 'run_1', status: 'finished' },
        { run_id: 'run_2', status: 'running' },
      ],
    })
    expect(rows.map((r) => r.run_id)).toEqual(['run_1', 'run_2'])
  })

  it('shows a finished-but-waiting run as "interviewable", never "running" (status-bug regression)', () => {
    // a run that finished its rounds but keeps the worker alive for interviews
    // is status:"running" + phase:"waiting" — the table must not read "running".
    const rows = batchRows({
      runs: [{ run_id: 'run_wait', status: 'running', phase: 'waiting' }],
    })
    expect(rows[0].status).toBe('interviewable')
  })
})
