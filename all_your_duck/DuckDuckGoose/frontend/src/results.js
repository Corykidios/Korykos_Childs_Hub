/**
 * Pure logic for the Results view: batch-comparison row assembly and the
 * shared null-tolerant cell formatting. Mirrors GET
 * /api/projects/<id>/batches/<batch_id> (app/api/runs.py get_batch):
 * every metrics/report field reads as null until that artifact exists —
 * nulls render as an em dash, never as "null"/"NaN".
 */

import { runDisplayStatus } from './runs.js'

export const EMPTY_CELL = '—'

/** Null-safe cell: numbers formatted to a fixed precision, '' / null / undefined -> —. */
export function fmtCell(value, decimals = null) {
  if (value === null || value === undefined || value === '') return EMPTY_CELL
  if (typeof value === 'number' && decimals !== null) return value.toFixed(decimals)
  return String(value)
}

/**
 * GET /batches/<id> response -> display rows for the comparison table:
 * one row per variant run x (status, total_actions, final_sentiment_score,
 * agents_engaged, direction.answer), nulls as EMPTY_CELL.
 */
export function batchRows(batchResponse) {
  const runs = Array.isArray(batchResponse?.runs) ? batchResponse.runs : []
  return runs.map((run) => {
    const summary = run?.metrics_summary ?? {}
    return {
      run_id: run?.run_id ?? EMPTY_CELL,
      seed: fmtCell(run?.seed),
      status: runDisplayStatus(run) || EMPTY_CELL,
      total_actions: fmtCell(summary.total_actions),
      final_sentiment_score: fmtCell(summary.final_sentiment_score, 2),
      agents_engaged: fmtCell(summary.agents_engaged),
      direction: fmtCell(summary.direction?.answer ?? null),
    }
  })
}
