/**
 * Pure stage-unlock logic for the wizard stepper.
 *
 * The project GET response does not carry graph/population presence, so the
 * shell (App.vue) assembles a `capabilities` object from cheap GETs:
 *   - hasDocs:        Object.keys(project.docs).length > 0 from GET /api/projects/<id>
 *   - hasGraph:       GET /api/projects/<id>/graph       (404 tolerated -> false)
 *   - hasPopulation:  GET /api/projects/<id>/population  (404 tolerated -> false)
 *   - runCount:       GET /api/projects/<id>/runs        -> runs.length
 *
 * Unlock rules:
 *   corpus    always reachable; complete once docs exist
 *   universe  needs docs > 0;   complete once the population is built
 *   run       needs population; complete once >= 1 run exists
 *   story     needs >= 1 run   (watch the run unfold as a threaded feed)
 *   results   needs >= 1 run
 *   talk      needs >= 1 run
 *
 * `hasGraph` is collected for the Universe view's benefit but is not
 * load-bearing for unlocks: building a population requires a graph
 * server-side, so hasPopulation implies hasGraph.
 *
 * @param {object|null} project  the selected project (null when none selected)
 * @param {object} [capabilities] {hasDocs, hasGraph, hasPopulation, runCount}
 * @returns {{corpus: string, universe: string, run: string, story: string, results: string, talk: string}}
 *          each value is 'locked' | 'available' | 'complete'
 */
export function stageStates(project, capabilities = {}) {
  const { hasDocs = false, hasPopulation = false, runCount = 0 } = capabilities

  if (!project) {
    return {
      corpus: 'available',
      universe: 'locked',
      run: 'locked',
      story: 'locked',
      results: 'locked',
      talk: 'locked',
    }
  }

  return {
    corpus: hasDocs ? 'complete' : 'available',
    universe: hasDocs ? (hasPopulation ? 'complete' : 'available') : 'locked',
    run: hasPopulation ? (runCount > 0 ? 'complete' : 'available') : 'locked',
    story: runCount > 0 ? 'available' : 'locked',
    results: runCount > 0 ? 'available' : 'locked',
    talk: runCount > 0 ? 'available' : 'locked',
  }
}

/** Stage display order + routes — single source of truth for the shell. */
export const STAGES = [
  { key: 'corpus', label: 'Corpus', path: '/corpus' },
  { key: 'universe', label: 'Universe', path: '/universe' },
  { key: 'run', label: 'Run', path: '/run' },
  { key: 'story', label: 'Story', path: '/story' },
  { key: 'results', label: 'Results', path: '/results' },
  { key: 'talk', label: 'Talk', path: '/talk' },
]
