/**
 * Pure logic for the Universe view: protagonist defaults, population
 * build-body assembly, and dial validation. Mirrors the backend population
 * API (app/api/population.py DIAL_DEFAULTS + builder semantics).
 *
 * graph.json entities arrive pre-sorted by mention_count desc
 * (services/resolution.py), so "top-K rows" is a prefix of the list.
 */

/** Backend DIAL_DEFAULTS, mirrored for seeding the dials panel. */
export const DIAL_DEFAULTS = {
  n_total: 100,
  k_protagonists: 7,
  retinue_ratio: 0.3,
  tiered: true,
  crowd_llm_ratio: 0.2,
}

/**
 * Default protagonist selection: uuids of the top-K entity rows.
 * Tolerates numeric strings from number inputs; non-positive or
 * non-numeric K yields an empty selection.
 */
export function defaultProtagonists(entities, k) {
  if (!Array.isArray(entities)) return []
  const kk = Number(k)
  if (!Number.isFinite(kk) || kk <= 0) return []
  return entities.slice(0, Math.floor(kk)).map((e) => e.uuid)
}

/**
 * Client-side dial validation. Returns {} when valid, otherwise a
 * field -> message map for inline display.
 *   n_total          integer >= 1
 *   k_protagonists   integer >= 0
 *   retinue_ratio    0 <= x <= 1
 *   crowd_llm_ratio  0 <= x <= 1
 */
export function dialErrors(dials) {
  const errors = {}
  const n = Number(dials?.n_total)
  if (!Number.isInteger(n) || n < 1) {
    errors.n_total = 'N must be an integer >= 1'
  }
  const k = Number(dials?.k_protagonists)
  if (!Number.isInteger(k) || k < 0) {
    errors.k_protagonists = 'K must be an integer >= 0'
  } else if (Number.isInteger(n) && n >= 1 && k > n) {
    errors.k_protagonists = 'K cannot exceed N'
  }
  const rr = Number(dials?.retinue_ratio)
  if (!Number.isFinite(rr) || rr < 0 || rr > 1) {
    errors.retinue_ratio = 'retinue ratio must be between 0 and 1'
  }
  const cr = Number(dials?.crowd_llm_ratio)
  if (!Number.isFinite(cr) || cr < 0 || cr > 1) {
    errors.crowd_llm_ratio = 'crowd LLM ratio must be between 0 and 1'
  }
  return errors
}

/**
 * POST /api/projects/<id>/population body. Dials are cast to their wire
 * types. protagonist_override (entity uuids, in entity-table order) is
 * ALWAYS included: the checkboxes the operator sees are authoritative —
 * the backend's influence ranking can differ from the table's mention
 * ranking, so an omitted override could build a different protagonist set
 * than the one displayed. Checked uuids that no longer exist in the
 * entity list are dropped.
 */
export function assembleBuildBody(dials, entities, checkedUuids) {
  const list = Array.isArray(entities) ? entities : []
  const checkedSet = new Set(checkedUuids ?? [])
  return {
    n_total: Number(dials?.n_total),
    k_protagonists: Number(dials?.k_protagonists),
    retinue_ratio: Number(dials?.retinue_ratio),
    tiered: Boolean(dials?.tiered),
    crowd_llm_ratio: Number(dials?.crowd_llm_ratio),
    protagonist_override: list
      .filter((e) => checkedSet.has(e.uuid))
      .map((e) => e.uuid),
  }
}
