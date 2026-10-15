import { describe, it, expect } from 'vitest'
import { stageStates } from '../stepper.js'

const project = { id: 'proj_abc', name: 'Test', question: 'What happens?' }

const caps = (overrides = {}) => ({
  hasDocs: false,
  hasGraph: false,
  hasPopulation: false,
  runCount: 0,
  ...overrides,
})

describe('stageStates', () => {
  it('locks everything but corpus when no project is selected', () => {
    expect(stageStates(null, caps())).toEqual({
      corpus: 'available',
      universe: 'locked',
      run: 'locked',
      results: 'locked',
      story: 'locked',
      talk: 'locked',
    })
  })

  it('fresh project: corpus available, everything else locked', () => {
    expect(stageStates(project, caps())).toEqual({
      corpus: 'available',
      universe: 'locked',
      run: 'locked',
      results: 'locked',
      story: 'locked',
      talk: 'locked',
    })
  })

  it('docs ingested: corpus complete, universe unlocks', () => {
    expect(stageStates(project, caps({ hasDocs: true }))).toEqual({
      corpus: 'complete',
      universe: 'available',
      run: 'locked',
      results: 'locked',
      story: 'locked',
      talk: 'locked',
    })
  })

  it('graph alone does not unlock run — population is required', () => {
    expect(stageStates(project, caps({ hasDocs: true, hasGraph: true }))).toEqual({
      corpus: 'complete',
      universe: 'available',
      run: 'locked',
      results: 'locked',
      story: 'locked',
      talk: 'locked',
    })
  })

  it('population built: universe complete, run unlocks', () => {
    const s = stageStates(project, caps({ hasDocs: true, hasGraph: true, hasPopulation: true }))
    expect(s).toEqual({
      corpus: 'complete',
      universe: 'complete',
      run: 'available',
      results: 'locked',
      story: 'locked',
      talk: 'locked',
    })
  })

  it('at least one run: run complete, results and talk unlock', () => {
    const s = stageStates(
      project,
      caps({ hasDocs: true, hasGraph: true, hasPopulation: true, runCount: 2 }),
    )
    expect(s).toEqual({
      corpus: 'complete',
      universe: 'complete',
      run: 'complete',
      results: 'available',
      story: 'available',
      talk: 'available',
    })
  })

  it('tolerates a missing capabilities object', () => {
    expect(stageStates(project)).toEqual({
      corpus: 'available',
      universe: 'locked',
      run: 'locked',
      results: 'locked',
      story: 'locked',
      talk: 'locked',
    })
  })
})
