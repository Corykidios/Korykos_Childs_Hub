/**
 * Pure logic for the Settings profile form. Mirrors the backend
 * EndpointProfile pydantic model (app/core/profiles.py):
 *   name/base_url/model — min_length 1, api_key optional,
 *   max_concurrency — integer > 0.
 */

/** The five bindable roles, in backend ROLES order. */
export const ROLES = [
  'protagonist_brain',
  'crowd_llm_brain',
  'builder',
  'report_writer',
  'embeddings',
]

/**
 * How much visible reasoning to ask a model for, mirroring the backend
 * REASONING_MODES. 'auto' sends nothing and takes the model's default; the
 * others are best-effort request hints, since servers disagree on how (and
 * whether) reasoning can be controlled. Reasoning is stripped from answers
 * either way, so this never leaks into agent posts.
 */
export const REASONING_MODES = ['auto', 'off', 'low', 'medium', 'high']

export const REASONING_LABELS = {
  auto: 'Auto (model default)',
  off: 'Off (request no reasoning)',
  low: 'Low effort',
  medium: 'Medium effort',
  high: 'High effort',
}

export function emptyProfileForm() {
  return {
    name: '',
    base_url: '',
    api_key: '',
    model: '',
    max_concurrency: 4,
    reasoning: 'auto',
  }
}

/**
 * Client-side mirror of the backend validation. Returns {} when valid,
 * otherwise a field -> message map for inline display.
 */
export function validateProfile(form) {
  const errors = {}
  if (!String(form?.name ?? '').trim()) errors.name = 'name is required'
  if (!String(form?.base_url ?? '').trim()) errors.base_url = 'base_url is required'
  if (!String(form?.model ?? '').trim()) errors.model = 'model is required'
  const n = Number(form?.max_concurrency)
  if (!Number.isInteger(n) || n <= 0) {
    errors.max_concurrency = 'max_concurrency must be a positive integer'
  }
  // Absent is valid: profiles saved before this field existed default to auto.
  const r = form?.reasoning
  if (r != null && r !== '' && !REASONING_MODES.includes(r)) {
    errors.reasoning = `reasoning must be one of ${REASONING_MODES.join(', ')}`
  }
  return errors
}
