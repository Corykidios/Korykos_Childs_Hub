/**
 * Pure logic for the Run/Results/Talk views: event-row formatting, run
 * picker ordering, agent picker grouping, and launch-body assembly.
 * Mirrors the backend shapes exactly:
 *   - events v1 (simworker/events.py + engine.py emit sites)
 *   - GET  /api/projects/<id>/runs state rows (services/runqueue.py)
 *   - POST /api/projects/<id>/runs body (api/runs.py create_runs)
 */

/** population.json -> agent_uid lookup for event-row username/tier. */
export function agentIndex(population) {
  const out = {}
  for (const a of population?.agents ?? []) {
    if (a?.agent_uid) out[a.agent_uid] = a
  }
  return out
}

/* content-or-target for an action event's info payload. */
function actionDetail(info) {
  if (info === null || info === undefined) return ''
  if (typeof info !== 'object') return String(info)
  if (typeof info.content === 'string' && info.content) return info.content
  if (info.post_id !== undefined && info.post_id !== null) return `post ${info.post_id}`
  if (info.comment_id !== undefined && info.comment_id !== null) {
    return `comment ${info.comment_id}`
  }
  const rest = JSON.stringify(info)
  return rest === '{}' ? '' : rest
}

/* Non-action events render as muted system lines; worker_error in danger. */
function systemText(event) {
  switch (event.kind) {
    case 'worker_started': {
      const missing = Number(event.policy_missing) || 0
      const tail = missing ? ` · ${missing} policies missing` : ''
      return `worker started · ${event.platform ?? '?'}${tail}`
    }
    case 'round_started':
      return 'round started'
    case 'round_finished':
      return `round finished · ${event.actions_taken ?? 0} actions`
    case 'sim_finished':
      return event.stopped ? 'sim finished (stopped)' : 'sim finished'
    case 'worker_error':
      return `worker error: ${event.error ?? 'unknown'}`
    case 'interview_result':
      return `interview answered · ${event.agent_uid ?? '?'}`
    default:
      return event.kind
  }
}

/**
 * One event -> a display row.
 * Action rows: {system: false, seq, round, username, tier, actionType,
 * detail} — the view renders `[r{round}] {username} {action_type}: {detail}`
 * with the username colored by tier. Unknown agents fall back to the raw
 * uid and the 'unknown' tier.
 * Other kinds: {system: true, seq, round?, text, danger}.
 */
export function eventRow(event, byUid = {}) {
  const seq = event?.seq ?? -1
  const round = Number.isInteger(event?.round) ? event.round : null
  if (event?.kind === 'action') {
    const agent = byUid[event.agent_uid]
    return {
      system: false,
      seq,
      round: round ?? 0,
      username: agent?.username || event.agent_uid || '?',
      tier: agent?.tier || 'unknown',
      actionType: event.action_type || 'unknown',
      detail: actionDetail(event.info),
    }
  }
  return {
    system: true,
    seq,
    round,
    text: systemText(event ?? { kind: 'unknown' }),
    danger: event?.kind === 'worker_error',
  }
}

/* Shared status-priority sort; ties broken newest-first by created_at,
 * then run_id for full determinism. */
function sortByPriority(runs, order) {
  return [...(Array.isArray(runs) ? runs : [])].sort((a, b) => {
    const ra = order[a?.status] ?? 9
    const rb = order[b?.status] ?? 9
    if (ra !== rb) return ra - rb
    const ca = String(a?.created_at ?? '')
    const cb = String(b?.created_at ?? '')
    if (ca !== cb) return cb.localeCompare(ca)
    return String(a?.run_id ?? '').localeCompare(String(b?.run_id ?? ''))
  })
}

/** Results picker: finished runs first (they have full artifacts). */
export function resultsPickerOrder(runs) {
  return sortByPriority(runs, {
    finished: 0,
    stopped: 1,
    running: 2,
    queued: 3,
    failed: 4,
  })
}

/**
 * Display label for a run's lifecycle. A live worker idling post-loop
 * (status "running" + phase "waiting") has finished its rounds and is only
 * interview-capable — show "interviewable", not a misleading "running".
 */
export function runDisplayStatus(run) {
  if (run?.status === 'running' && run?.phase === 'waiting') return 'interviewable'
  return run?.status ?? ''
}

/**
 * Is a run still PRODUCING content (so a viewer should poll/refetch it)? A
 * queued run will start; a running run with phase != 'waiting' is mid-rounds. A
 * wait-mode run (status 'running' + phase 'waiting', shown as "interviewable")
 * has FINISHED its rounds and only idles for interviews — its feed is final, so
 * it must NOT be treated as live (refetching it fought playback; see StoryFeed).
 * Terminal states (finished/stopped/failed) are never live.
 */
export function isRunLive(run) {
  if (!run) return false
  if (run.status === 'queued') return true
  return run.status === 'running' && run.phase !== 'waiting'
}

/** Is the live-interview path available? Only while the run worker is alive
 * (status 'running', including wait/interviewable mode). */
export function interviewAvailable(run) {
  return run?.status === 'running'
}

/**
 * Which Talk surface to show given the run and the operator's toggle choice.
 * Persona-chat (reliable, rebuilt from artifacts) is available on ANY started
 * run — including a wait-mode run — so the operator is no longer forced into the
 * flaky live interview. 'interview' only when chosen AND the worker is live.
 *   started (running/finished/stopped) -> 'chat' | 'interview'
 *   queued/failed -> 'unavailable'; no run -> ''
 */
export function resolveTalkMode(run, userChoice = 'chat') {
  const status = run?.status
  if (!['running', 'finished', 'stopped'].includes(status)) {
    return status ? 'unavailable' : ''
  }
  if (userChoice === 'interview' && status === 'running') return 'interview'
  return 'chat'
}

/** Talk picker: running first (interviewable), then chat-able states. */
export function talkPickerOrder(runs) {
  return sortByPriority(runs, {
    running: 0,
    finished: 1,
    stopped: 2,
    queued: 3,
    failed: 4,
  })
}

/**
 * Agent picker groups by tier, best-to-talk-to first, source order kept.
 * Interview/chat quality ranks protagonist (full LLM) > crowd_llm
 * (lightweight LLM) > crowd_policy (compiled rules, no LLM). crowd_policy is
 * the catch-all so unknown tiers still appear in the picker.
 */
export function agentGroups(population) {
  const agents = population?.agents ?? []
  return {
    protagonists: agents.filter((a) => a?.tier === 'protagonist'),
    crowdLlm: agents.filter((a) => a?.tier === 'crowd_llm'),
    crowdPolicy: agents.filter(
      (a) => a?.tier !== 'protagonist' && a?.tier !== 'crowd_llm',
    ),
  }
}

/**
 * Split saved Talk transcript turns (oldest-first, from GET .../transcript)
 * into the two display shapes the Talk view renders: interview cards
 * (newest-top {prompt, response}) and the persona-chat thread ({role,content}
 * pairs). Keeps the view dumb and this re-hydration logic unit-testable.
 */
export function splitTranscript(turns) {
  const list = Array.isArray(turns) ? turns : []
  return {
    interviews: list
      .filter((t) => t?.mode === 'interview')
      .map((t) => ({ prompt: t.question, response: t.answer }))
      .reverse(),
    thread: list
      .filter((t) => t?.mode === 'chat')
      .flatMap((t) => [
        { role: 'user', content: t.question },
        { role: 'assistant', content: t.answer },
      ]),
  }
}

/**
 * Launch-form validation. Returns {} when valid, else field -> message.
 *   rounds    integer >= 1
 *   variants  integer >= 1
 *   seed      blank or an integer
 */
export function launchErrors(form) {
  const errors = {}
  const rounds = Number(form?.rounds)
  if (!Number.isInteger(rounds) || rounds < 1) {
    errors.rounds = 'rounds must be an integer >= 1'
  }
  const variants = Number(form?.variants)
  if (!Number.isInteger(variants) || variants < 1) {
    errors.variants = 'variants must be an integer >= 1'
  }
  const seed = String(form?.seed ?? '').trim()
  if (seed && !/^-?\d+$/.test(seed)) {
    errors.seed = 'seed must be an integer (or blank for random)'
  }
  if (form?.minutes_per_round !== undefined && form?.minutes_per_round !== '') {
    const m = Number(form.minutes_per_round)
    if (!Number.isInteger(m) || m < 1) {
      errors.minutes_per_round = 'minutes/round must be an integer >= 1'
    }
  }
  if (form?.agents_per_round_min !== undefined || form?.agents_per_round_max !== undefined) {
    const lo = Number(form.agents_per_round_min)
    const hi = Number(form.agents_per_round_max)
    if (!Number.isInteger(lo) || lo < 0 || !Number.isInteger(hi) || hi < 0 || hi < lo) {
      errors.agents_per_round = 'crowd/round must be integers with min <= max'
    }
  }
  return errors
}

/**
 * POST /runs body. Blank seed is omitted (the backend randomizes);
 * cross_feed only survives when platform === 'both'; initial-post rows
 * without an agent or content are dropped, content trimmed.
 */
export function assembleLaunchBody(form, initialPosts) {
  const body = {
    platform: form?.platform,
    rounds: Number(form?.rounds),
    tiered: Boolean(form?.tiered),
    variants: Number(form?.variants),
    cross_feed: form?.platform === 'both' ? Boolean(form?.cross_feed) : false,
  }
  // time-dial overrides — only present+finite fields are sent; the backend
  // (TimeDials) fills any omitted field with its default.
  const td = {}
  for (const k of ['minutes_per_round', 'agents_per_round_min', 'agents_per_round_max']) {
    const v = Number(form?.[k])
    if (Number.isFinite(v)) td[k] = v
  }
  if (Object.keys(td).length) body.time_dials = td
  const seed = String(form?.seed ?? '').trim()
  if (seed) body.seed = Number(seed)
  const posts = (Array.isArray(initialPosts) ? initialPosts : [])
    .map((p) => ({
      agent_uid: String(p?.agent_uid ?? '').trim(),
      content: String(p?.content ?? '').trim(),
    }))
    .filter((p) => p.agent_uid && p.content)
  if (posts.length) body.initial_posts = posts
  return body
}
