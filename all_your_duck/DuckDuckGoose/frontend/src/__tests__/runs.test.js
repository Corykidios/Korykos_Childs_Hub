import { describe, it, expect } from 'vitest'
import {
  agentGroups,
  agentIndex,
  assembleLaunchBody,
  eventRow,
  interviewAvailable,
  isRunLive,
  launchErrors,
  resolveTalkMode,
  resultsPickerOrder,
  runDisplayStatus,
  splitTranscript,
  talkPickerOrder,
} from '../runs.js'

describe('resolveTalkMode', () => {
  it('offers reliable persona-chat on a wait-mode (interviewable) run', () => {
    // the headline fix: a running+waiting run can use CHAT, not just the flaky interview
    expect(resolveTalkMode({ status: 'running', phase: 'waiting' }, 'chat')).toBe('chat')
  })
  it('allows live interview only while the worker is running', () => {
    expect(resolveTalkMode({ status: 'running' }, 'interview')).toBe('interview')
    // interview chosen but run finished -> falls back to chat (worker is gone)
    expect(resolveTalkMode({ status: 'finished' }, 'interview')).toBe('chat')
  })
  it('chat works on finished/stopped runs; queued/failed are unavailable', () => {
    expect(resolveTalkMode({ status: 'finished' }, 'chat')).toBe('chat')
    expect(resolveTalkMode({ status: 'stopped' }, 'chat')).toBe('chat')
    expect(resolveTalkMode({ status: 'queued' }, 'chat')).toBe('unavailable')
    expect(resolveTalkMode(null, 'chat')).toBe('')
  })
})

describe('interviewAvailable', () => {
  it('is true only while the run worker is alive', () => {
    expect(interviewAvailable({ status: 'running' })).toBe(true)
    expect(interviewAvailable({ status: 'finished' })).toBe(false)
    expect(interviewAvailable(null)).toBe(false)
  })
})

describe('isRunLive', () => {
  it('is true while a run is queued or actively running rounds', () => {
    expect(isRunLive({ status: 'queued' })).toBe(true)
    expect(isRunLive({ status: 'running' })).toBe(true)
    expect(isRunLive({ status: 'running', phase: 'running' })).toBe(true)
  })

  it('is FALSE for a wait-mode run (rounds done, idling for interviews)', () => {
    // the regression that already bit once: "interviewable" must not poll/refetch
    expect(isRunLive({ status: 'running', phase: 'waiting' })).toBe(false)
  })

  it('is false for terminal states and junk', () => {
    expect(isRunLive({ status: 'finished' })).toBe(false)
    expect(isRunLive({ status: 'stopped' })).toBe(false)
    expect(isRunLive({ status: 'failed' })).toBe(false)
    expect(isRunLive(null)).toBe(false)
    expect(isRunLive(undefined)).toBe(false)
  })
})

describe('splitTranscript', () => {
  it('re-hydrates interview turns newest-top and chat turns as a flat thread', () => {
    const turns = [
      { mode: 'interview', question: 'Q1', answer: 'A1' },
      { mode: 'chat', question: 'C1', answer: 'R1' },
      { mode: 'interview', question: 'Q2', answer: 'A2' },
    ]
    const { interviews, thread } = splitTranscript(turns)
    expect(interviews).toEqual([
      { prompt: 'Q2', response: 'A2' },
      { prompt: 'Q1', response: 'A1' },
    ])
    expect(thread).toEqual([
      { role: 'user', content: 'C1' },
      { role: 'assistant', content: 'R1' },
    ])
  })

  it('tolerates missing/empty/non-array input', () => {
    expect(splitTranscript(null)).toEqual({ interviews: [], thread: [] })
    expect(splitTranscript([])).toEqual({ interviews: [], thread: [] })
    expect(splitTranscript('nope')).toEqual({ interviews: [], thread: [] })
  })
})

const POPULATION = {
  agents: [
    { agent_uid: 'u1', username: 'alice_p', tier: 'protagonist', name: 'Alice' },
    { agent_uid: 'u2', username: 'bob_c', tier: 'crowd_llm', name: 'Bob' },
    { agent_uid: 'u3', username: 'carol_x', tier: 'crowd_policy', name: 'Carol' },
  ],
}

describe('agentIndex', () => {
  it('maps agent_uid to the agent record', () => {
    const idx = agentIndex(POPULATION)
    expect(idx.u1.username).toBe('alice_p')
    expect(idx.u3.tier).toBe('crowd_policy')
  })

  it('tolerates missing population', () => {
    expect(agentIndex(null)).toEqual({})
    expect(agentIndex({})).toEqual({})
  })
})

describe('eventRow — action events', () => {
  const byUid = agentIndex(POPULATION)

  it('resolves username and tier and keeps content', () => {
    const row = eventRow(
      {
        seq: 4,
        kind: 'action',
        round: 2,
        agent_uid: 'u1',
        action_type: 'create_post',
        info: { content: 'panic is spreading' },
      },
      byUid,
    )
    expect(row).toEqual({
      system: false,
      seq: 4,
      round: 2,
      username: 'alice_p',
      tier: 'protagonist',
      actionType: 'create_post',
      detail: 'panic is spreading',
    })
  })

  it('falls back to the raw uid and unknown tier for unmapped agents', () => {
    const row = eventRow(
      { seq: 1, kind: 'action', round: 0, agent_uid: 'ghost', action_type: 'like_post', info: {} },
      byUid,
    )
    expect(row.username).toBe('ghost')
    expect(row.tier).toBe('unknown')
  })

  it('renders target-style info (post/comment ids) when there is no content', () => {
    const like = eventRow(
      { seq: 2, kind: 'action', round: 1, agent_uid: 'u2', action_type: 'like_post', info: { post_id: 7 } },
      byUid,
    )
    expect(like.detail).toBe('post 7')
    const comment = eventRow(
      { seq: 3, kind: 'action', round: 1, agent_uid: 'u2', action_type: 'like_comment', info: { comment_id: 9 } },
      byUid,
    )
    expect(comment.detail).toBe('comment 9')
  })

  it('renders empty detail for empty info and compact JSON for odd shapes', () => {
    expect(eventRow({ kind: 'action', agent_uid: 'u1', info: {} }, byUid).detail).toBe('')
    expect(eventRow({ kind: 'action', agent_uid: 'u1', info: null }, byUid).detail).toBe('')
    expect(eventRow({ kind: 'action', agent_uid: 'u1', info: { x: 1 } }, byUid).detail).toBe('{"x":1}')
  })
})

describe('eventRow — system events', () => {
  it('formats the round/worker lifecycle kinds', () => {
    expect(eventRow({ seq: 0, kind: 'worker_started', platform: 'twitter', policy_missing: 0 }).text).toBe(
      'worker started · twitter',
    )
    expect(eventRow({ kind: 'worker_started', platform: 'both', policy_missing: 3 }).text).toBe(
      'worker started · both · 3 policies missing',
    )
    expect(eventRow({ kind: 'round_started', round: 1 })).toMatchObject({
      system: true,
      round: 1,
      text: 'round started',
    })
    expect(eventRow({ kind: 'round_finished', round: 1, actions_taken: 12 }).text).toBe(
      'round finished · 12 actions',
    )
    expect(eventRow({ kind: 'sim_finished', stopped: false }).text).toBe('sim finished')
    expect(eventRow({ kind: 'sim_finished', stopped: true }).text).toBe('sim finished (stopped)')
  })

  it('flags worker_error as danger', () => {
    const row = eventRow({ kind: 'worker_error', error: 'boom' })
    expect(row.danger).toBe(true)
    expect(row.text).toBe('worker error: boom')
  })

  it('does not flag other system rows as danger', () => {
    expect(eventRow({ kind: 'round_started', round: 0 }).danger).toBe(false)
  })

  it('passes unknown kinds through as their kind name', () => {
    expect(eventRow({ kind: 'paused' }).text).toBe('paused')
  })
})

describe('picker ordering', () => {
  const RUNS = [
    { run_id: 'run_a', status: 'queued', created_at: '2026-06-10T10:00:00' },
    { run_id: 'run_b', status: 'finished', created_at: '2026-06-10T08:00:00' },
    { run_id: 'run_c', status: 'running', created_at: '2026-06-10T09:00:00' },
    { run_id: 'run_d', status: 'finished', created_at: '2026-06-10T09:30:00' },
    { run_id: 'run_e', status: 'failed', created_at: '2026-06-10T11:00:00' },
    { run_id: 'run_f', status: 'stopped', created_at: '2026-06-10T07:00:00' },
  ]

  it('results picker puts finished first, newest first within a status', () => {
    expect(resultsPickerOrder(RUNS).map((r) => r.run_id)).toEqual([
      'run_d', 'run_b', 'run_f', 'run_c', 'run_a', 'run_e',
    ])
  })

  it('talk picker puts running (interviewable) first', () => {
    expect(talkPickerOrder(RUNS).map((r) => r.run_id)).toEqual([
      'run_c', 'run_d', 'run_b', 'run_f', 'run_a', 'run_e',
    ])
  })

  it('does not mutate the input and tolerates junk', () => {
    const input = [...RUNS]
    resultsPickerOrder(input)
    expect(input).toEqual(RUNS)
    expect(resultsPickerOrder(null)).toEqual([])
    expect(talkPickerOrder(undefined)).toEqual([])
  })
})

describe('runDisplayStatus', () => {
  it('labels a post-loop waiting worker interviewable, else the raw status', () => {
    expect(runDisplayStatus({ status: 'running', phase: 'waiting' })).toBe('interviewable')
    expect(runDisplayStatus({ status: 'running' })).toBe('running')
    expect(runDisplayStatus({ status: 'finished' })).toBe('finished')
    expect(runDisplayStatus({})).toBe('')
  })
})

describe('agentGroups', () => {
  it('splits agents into protagonist / crowd_llm / crowd_policy, keeping source order', () => {
    const groups = agentGroups(POPULATION)
    expect(groups.protagonists.map((a) => a.agent_uid)).toEqual(['u1'])
    expect(groups.crowdLlm.map((a) => a.agent_uid)).toEqual(['u2'])
    expect(groups.crowdPolicy.map((a) => a.agent_uid)).toEqual(['u3'])
  })

  it('puts unknown/other tiers in crowd_policy (catch-all)', () => {
    const groups = agentGroups({ agents: [{ agent_uid: 'x', tier: 'mystery' }] })
    expect(groups.crowdPolicy.map((a) => a.agent_uid)).toEqual(['x'])
  })

  it('tolerates missing population', () => {
    expect(agentGroups(null)).toEqual({ protagonists: [], crowdLlm: [], crowdPolicy: [] })
  })
})

describe('launchErrors', () => {
  it('accepts a valid form (blank seed = random)', () => {
    expect(launchErrors({ rounds: 5, variants: 1, seed: '' })).toEqual({})
    expect(launchErrors({ rounds: 1, variants: 3, seed: '42' })).toEqual({})
    expect(launchErrors({ rounds: 2, variants: 2, seed: '-7' })).toEqual({})
  })

  it('rejects non-integer or sub-1 rounds/variants', () => {
    expect(launchErrors({ rounds: 0, variants: 1 })).toHaveProperty('rounds')
    expect(launchErrors({ rounds: 1.5, variants: 1 })).toHaveProperty('rounds')
    expect(launchErrors({ rounds: 1, variants: 0 })).toHaveProperty('variants')
    expect(launchErrors({ rounds: 1, variants: 'x' })).toHaveProperty('variants')
  })

  it('rejects a non-integer seed', () => {
    expect(launchErrors({ rounds: 1, variants: 1, seed: 'abc' })).toHaveProperty('seed')
    expect(launchErrors({ rounds: 1, variants: 1, seed: '1.5' })).toHaveProperty('seed')
  })

  it('validates pacing fields only when present', () => {
    expect(
      launchErrors({ rounds: 5, variants: 1, minutes_per_round: 120, agents_per_round_min: 5, agents_per_round_max: 20 }),
    ).toEqual({})
    expect(launchErrors({ rounds: 5, variants: 1, minutes_per_round: 0 })).toHaveProperty('minutes_per_round')
    expect(
      launchErrors({ rounds: 5, variants: 1, agents_per_round_min: 20, agents_per_round_max: 5 }),
    ).toHaveProperty('agents_per_round')
  })
})

describe('assembleLaunchBody', () => {
  it('builds the POST /runs body, omitting a blank seed', () => {
    const body = assembleLaunchBody(
      { platform: 'twitter', rounds: '5', tiered: true, variants: '2', seed: '', cross_feed: true },
      [],
    )
    expect(body).toEqual({
      platform: 'twitter',
      rounds: 5,
      tiered: true,
      variants: 2,
      cross_feed: false, // cross_feed only survives platform === 'both'
    })
    expect('seed' in body).toBe(false)
    expect('initial_posts' in body).toBe(false)
  })

  it('keeps seed and cross_feed when set on a both-platform launch', () => {
    const body = assembleLaunchBody(
      { platform: 'both', rounds: 3, tiered: false, variants: 1, seed: '42', cross_feed: true },
      [],
    )
    expect(body.seed).toBe(42)
    expect(body.cross_feed).toBe(true)
    expect(body.tiered).toBe(false)
  })

  it('drops incomplete initial posts and trims content', () => {
    const body = assembleLaunchBody(
      { platform: 'reddit', rounds: 1, tiered: true, variants: 1, seed: '' },
      [
        { agent_uid: 'u1', content: '  hello world  ' },
        { agent_uid: '', content: 'orphan' },
        { agent_uid: 'u2', content: '   ' },
      ],
    )
    expect(body.initial_posts).toEqual([{ agent_uid: 'u1', content: 'hello world' }])
  })

  it('includes time_dials when the form carries pacing fields, omits them otherwise', () => {
    const withDials = assembleLaunchBody(
      {
        platform: 'reddit', rounds: 12, tiered: true, variants: 1, seed: '',
        minutes_per_round: 120, agents_per_round_min: 5, agents_per_round_max: 20,
      },
      [],
    )
    expect(withDials.time_dials).toEqual({
      minutes_per_round: 120, agents_per_round_min: 5, agents_per_round_max: 20,
    })
    const without = assembleLaunchBody(
      { platform: 'reddit', rounds: 1, tiered: true, variants: 1, seed: '' },
      [],
    )
    expect('time_dials' in without).toBe(false)
  })
})
