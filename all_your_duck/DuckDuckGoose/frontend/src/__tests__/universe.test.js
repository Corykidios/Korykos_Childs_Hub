import { describe, it, expect } from 'vitest'
import {
  assembleBuildBody,
  defaultProtagonists,
  DIAL_DEFAULTS,
  dialErrors,
} from '../universe.js'

/* graph.json entities are pre-sorted by mention_count desc. */
const entities = [
  { uuid: 'u1', canonical_name: 'Alice', mention_count: 9 },
  { uuid: 'u2', canonical_name: 'Bob', mention_count: 5 },
  { uuid: 'u3', canonical_name: 'Carol', mention_count: 2 },
]

describe('DIAL_DEFAULTS', () => {
  it('mirrors the backend population API defaults', () => {
    expect(DIAL_DEFAULTS).toEqual({
      n_total: 100,
      k_protagonists: 7,
      retinue_ratio: 0.3,
      tiered: true,
      crowd_llm_ratio: 0.2,
    })
  })
})

describe('defaultProtagonists', () => {
  it('returns the top-K uuids in table order', () => {
    expect(defaultProtagonists(entities, 2)).toEqual(['u1', 'u2'])
  })

  it('returns an empty list for K = 0 or negative K', () => {
    expect(defaultProtagonists(entities, 0)).toEqual([])
    expect(defaultProtagonists(entities, -3)).toEqual([])
  })

  it('clamps K above the entity count to all entities', () => {
    expect(defaultProtagonists(entities, 99)).toEqual(['u1', 'u2', 'u3'])
  })

  it('accepts numeric strings from number inputs', () => {
    expect(defaultProtagonists(entities, '2')).toEqual(['u1', 'u2'])
  })

  it('floors fractional K', () => {
    expect(defaultProtagonists(entities, 1.9)).toEqual(['u1'])
  })

  it('tolerates non-array entities and non-numeric K', () => {
    expect(defaultProtagonists(undefined, 3)).toEqual([])
    expect(defaultProtagonists(entities, 'lots')).toEqual([])
  })
})

describe('dialErrors', () => {
  it('accepts the backend defaults', () => {
    expect(dialErrors(DIAL_DEFAULTS)).toEqual({})
  })

  it('accepts boundary ratios 0 and 1, and K = 0', () => {
    expect(
      dialErrors({
        n_total: 1,
        k_protagonists: 0,
        retinue_ratio: 0,
        tiered: false,
        crowd_llm_ratio: 1,
      }),
    ).toEqual({})
  })

  it('rejects n_total below 1 or non-integer', () => {
    expect(dialErrors({ ...DIAL_DEFAULTS, n_total: 0 }).n_total).toBeTruthy()
    expect(dialErrors({ ...DIAL_DEFAULTS, n_total: -5 }).n_total).toBeTruthy()
    expect(dialErrors({ ...DIAL_DEFAULTS, n_total: 1.5 }).n_total).toBeTruthy()
    expect(dialErrors({ ...DIAL_DEFAULTS, n_total: 'many' }).n_total).toBeTruthy()
    expect(dialErrors({ ...DIAL_DEFAULTS, n_total: '' }).n_total).toBeTruthy()
  })

  it('rejects negative or non-integer K', () => {
    expect(dialErrors({ ...DIAL_DEFAULTS, k_protagonists: -1 }).k_protagonists).toBeTruthy()
    expect(dialErrors({ ...DIAL_DEFAULTS, k_protagonists: 2.5 }).k_protagonists).toBeTruthy()
  })

  it('rejects ratios outside [0, 1]', () => {
    expect(dialErrors({ ...DIAL_DEFAULTS, retinue_ratio: -0.1 }).retinue_ratio).toBeTruthy()
    expect(dialErrors({ ...DIAL_DEFAULTS, retinue_ratio: 1.01 }).retinue_ratio).toBeTruthy()
    expect(dialErrors({ ...DIAL_DEFAULTS, crowd_llm_ratio: 2 }).crowd_llm_ratio).toBeTruthy()
    expect(dialErrors({ ...DIAL_DEFAULTS, crowd_llm_ratio: 'x' }).crowd_llm_ratio).toBeTruthy()
  })

  it('accepts numeric strings from inputs', () => {
    expect(
      dialErrors({
        n_total: '100',
        k_protagonists: '7',
        retinue_ratio: '0.3',
        tiered: true,
        crowd_llm_ratio: '0.2',
      }),
    ).toEqual({})
  })

  it('flags every dial when the form object is missing', () => {
    expect(Object.keys(dialErrors(undefined)).sort()).toEqual([
      'crowd_llm_ratio',
      'k_protagonists',
      'n_total',
      'retinue_ratio',
    ])
  })
})

describe('assembleBuildBody', () => {
  const dials = { ...DIAL_DEFAULTS, k_protagonists: 2 }

  it('ALWAYS includes protagonist_override — the displayed checks are authoritative', () => {
    const body = assembleBuildBody(dials, entities, ['u1', 'u2'])
    expect(body).toEqual({
      n_total: 100,
      k_protagonists: 2,
      retinue_ratio: 0.3,
      tiered: true,
      crowd_llm_ratio: 0.2,
      protagonist_override: ['u1', 'u2'],
    })
  })

  it('emits the override in entity-table order — selection order does not matter', () => {
    const body = assembleBuildBody(dials, entities, ['u2', 'u1'])
    expect(body.protagonist_override).toEqual(['u1', 'u2'])
  })

  it('accepts a Set for checkedUuids', () => {
    const body = assembleBuildBody(dials, entities, new Set(['u3', 'u1']))
    expect(body.protagonist_override).toEqual(['u1', 'u3'])
  })

  it('includes the override when a default row is unchecked', () => {
    const body = assembleBuildBody(dials, entities, ['u1'])
    expect(body.protagonist_override).toEqual(['u1'])
  })

  it('includes an empty override when K > 0 but nothing is checked', () => {
    const body = assembleBuildBody(dials, entities, [])
    expect(body.protagonist_override).toEqual([])
  })

  it('includes an empty override for K = 0 with no checks', () => {
    const body = assembleBuildBody({ ...dials, k_protagonists: 0 }, entities, [])
    expect(body.protagonist_override).toEqual([])
  })

  it('includes the override for K = 0 with checks', () => {
    const body = assembleBuildBody({ ...dials, k_protagonists: 0 }, entities, ['u2'])
    expect(body.protagonist_override).toEqual(['u2'])
  })

  it('drops checked uuids that no longer exist in the graph', () => {
    const body = assembleBuildBody(dials, entities, ['u1', 'u2', 'gone'])
    expect(body.protagonist_override).toEqual(['u1', 'u2'])
  })

  it('casts dial wire types (numeric strings, truthy tiered)', () => {
    const body = assembleBuildBody(
      {
        n_total: '50',
        k_protagonists: '2',
        retinue_ratio: '0.4',
        tiered: 1,
        crowd_llm_ratio: '0.1',
      },
      entities,
      ['u1', 'u2'],
    )
    expect(body).toEqual({
      n_total: 50,
      k_protagonists: 2,
      retinue_ratio: 0.4,
      tiered: true,
      crowd_llm_ratio: 0.1,
      protagonist_override: ['u1', 'u2'],
    })
  })
})

describe('dialErrors K<=N', () => {
  it('rejects K greater than N', () => {
    const errors = dialErrors({ n_total: 10, k_protagonists: 11, retinue_ratio: 0.3, crowd_llm_ratio: 0.2 })
    expect(errors.k_protagonists).toMatch(/exceed/i)
  })
  it('accepts K equal to N', () => {
    const errors = dialErrors({ n_total: 10, k_protagonists: 10, retinue_ratio: 0.3, crowd_llm_ratio: 0.2 })
    expect(errors.k_protagonists).toBeUndefined()
  })
})
