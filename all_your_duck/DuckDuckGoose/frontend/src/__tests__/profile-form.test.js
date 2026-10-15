import { describe, it, expect } from 'vitest'
import {
  emptyProfileForm,
  REASONING_LABELS,
  REASONING_MODES,
  ROLES,
  validateProfile,
} from '../profile-form.js'

describe('ROLES', () => {
  it('lists the five backend roles in order', () => {
    expect(ROLES).toEqual([
      'protagonist_brain',
      'crowd_llm_brain',
      'builder',
      'report_writer',
      'embeddings',
    ])
  })
})

describe('validateProfile', () => {
  const valid = {
    name: 'local',
    base_url: 'http://localhost:11434/v1',
    api_key: '',
    model: 'qwen3:8b',
    max_concurrency: 4,
  }

  it('accepts a valid profile (api_key optional)', () => {
    expect(validateProfile(valid)).toEqual({})
  })

  it('accepts the empty-form defaults for max_concurrency only', () => {
    const errors = validateProfile(emptyProfileForm())
    expect(errors.max_concurrency).toBeUndefined()
    expect(Object.keys(errors).sort()).toEqual(['base_url', 'model', 'name'])
  })

  it('rejects blank or whitespace-only required fields', () => {
    const errors = validateProfile({ ...valid, name: '  ', base_url: '', model: '\t' })
    expect(errors.name).toBeTruthy()
    expect(errors.base_url).toBeTruthy()
    expect(errors.model).toBeTruthy()
    expect(errors.max_concurrency).toBeUndefined()
  })

  it('rejects non-positive max_concurrency', () => {
    expect(validateProfile({ ...valid, max_concurrency: 0 }).max_concurrency).toBeTruthy()
    expect(validateProfile({ ...valid, max_concurrency: -2 }).max_concurrency).toBeTruthy()
  })

  it('rejects non-integer max_concurrency', () => {
    expect(validateProfile({ ...valid, max_concurrency: 1.5 }).max_concurrency).toBeTruthy()
    expect(validateProfile({ ...valid, max_concurrency: 'lots' }).max_concurrency).toBeTruthy()
    expect(validateProfile({ ...valid, max_concurrency: '' }).max_concurrency).toBeTruthy()
  })

  it('accepts numeric strings from number inputs', () => {
    expect(validateProfile({ ...valid, max_concurrency: '8' })).toEqual({})
  })

  it('tolerates a missing form object', () => {
    const errors = validateProfile(undefined)
    expect(Object.keys(errors).sort()).toEqual(['base_url', 'max_concurrency', 'model', 'name'])
  })

  it('accepts every declared reasoning mode', () => {
    for (const reasoning of REASONING_MODES) {
      expect(validateProfile({ ...valid, reasoning })).toEqual({})
    }
  })

  it('rejects an unknown reasoning mode', () => {
    expect(validateProfile({ ...valid, reasoning: 'turbo' }).reasoning).toBeTruthy()
  })

  it('treats a missing reasoning field as valid', () => {
    // Profiles saved before the field existed come back without it.
    const { reasoning, ...withoutReasoning } = { ...valid, reasoning: 'auto' }
    expect(validateProfile(withoutReasoning)).toEqual({})
    expect(validateProfile({ ...valid, reasoning: '' })).toEqual({})
  })
})

describe('reasoning modes', () => {
  it('mirrors the backend REASONING_MODES in order', () => {
    expect(REASONING_MODES).toEqual(['auto', 'off', 'low', 'medium', 'high'])
  })

  it('defaults a new profile to auto, so nothing is sent unless asked', () => {
    expect(emptyProfileForm().reasoning).toBe('auto')
  })

  it('has a human label for every mode', () => {
    for (const mode of REASONING_MODES) {
      expect(REASONING_LABELS[mode]).toBeTruthy()
    }
  })
})
