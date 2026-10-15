<script setup>
// Stage 3 — launch panel, run queue, live event monitor.
import { computed, inject, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { api, ApiError, errorMessage } from '../api.js'
import { useProject } from '../composables/useProject.js'
import {
  agentGroups,
  agentIndex,
  assembleLaunchBody,
  eventRow,
  launchErrors,
  runDisplayStatus,
} from '../runs.js'

const refreshCapabilities = inject('refreshCapabilities', async () => {})
const { projectId } = useProject()

const POLL_MS = 2000
const EVENTS_PAGE_CAP = 500 // backend page size — a full page means more waits

/* ============ population (agent names for initial posts, tiers for the feed) */
const population = ref(null)
const byUid = computed(() => agentIndex(population.value))
const groups = computed(() => agentGroups(population.value))

async function loadPopulation(id) {
  try {
    const data = await api.get(`/api/projects/${id}/population`)
    if (projectId.value !== id) return
    population.value = data
    // tiered default comes from the population dials when present
    if (typeof data?.dials?.tiered === 'boolean') form.tiered = data.dials.tiered
  } catch {
    if (projectId.value !== id) return
    population.value = null // 404 = not built; Run stage is normally locked then
  }
}

/* ============ launch panel ============ */
const form = reactive({
  platform: 'twitter',
  rounds: 5,
  tiered: true,
  variants: 1,
  cross_feed: false,
  seed: '',
  // sim-time pacing (TimeDials defaults). minutes_per_round drives the sim
  // clock: too few simulated hours stays overnight, where the crowd's default
  // active window (08–22) gates it out — raise it (~120) to sweep into daytime
  // so the crowd participates.
  minutes_per_round: 30,
  agents_per_round_min: 5,
  agents_per_round_max: 20,
})
const initialPosts = ref([]) // [{agent_uid, content}]
const launching = ref(false)
const launchError = ref('')
const launchNeedsBrain = ref(false)
const launchedNote = ref('')

const formErrs = computed(() => launchErrors(form))
const formValid = computed(() => Object.keys(formErrs.value).length === 0)

function addPost() {
  initialPosts.value.push({ agent_uid: '', content: '' })
}

function removePost(i) {
  initialPosts.value.splice(i, 1)
}

async function launch() {
  if (!formValid.value) return
  launchError.value = ''
  launchNeedsBrain.value = false
  launchedNote.value = ''
  launching.value = true
  try {
    const body = assembleLaunchBody(form, initialPosts.value)
    const res = await api.post(`/api/projects/${projectId.value}/runs`, body)
    launchedNote.value = `queued ${res.run_ids.length} run${res.run_ids.length === 1 ? '' : 's'}`
    initialPosts.value = []
    await loadRuns()
    await refreshCapabilities()
    schedulePoll()
  } catch (err) {
    launchNeedsBrain.value =
      err instanceof ApiError && err.status === 409 && /protagonist_brain/i.test(errorMessage(err))
    launchError.value = errorMessage(err)
  } finally {
    launching.value = false
  }
}

/* ============ run list ============ */
const runs = ref([])
const runsError = ref('')
const runRounds = ref({}) // run_id -> heartbeat round (running runs only)
const stopConfirm = ref('') // run_id pending stop confirmation
const stopping = ref('')

async function loadRuns() {
  const id = projectId.value
  if (!id) return
  try {
    const data = await api.get(`/api/projects/${id}/runs`)
    if (projectId.value !== id) return
    runs.value = data?.runs ?? []
    runsError.value = ''
  } catch (err) {
    if (projectId.value !== id) return
    runsError.value = errorMessage(err)
  }
}

/* Heartbeat rounds for every running run (list column; usually 0-1 runs). */
async function loadRunningRounds() {
  const id = projectId.value
  const running = runs.value.filter((r) => r.status === 'running')
  const next = {}
  await Promise.all(
    running.map(async (r) => {
      try {
        const detail = await api.get(`/api/projects/${id}/runs/${r.run_id}`)
        if (typeof detail?.heartbeat?.round === 'number') next[r.run_id] = detail.heartbeat.round
      } catch {
        /* run vanished mid-poll — the next list refresh reconciles */
      }
    }),
  )
  if (projectId.value === id) runRounds.value = next
}

function askStop(runId) {
  stopConfirm.value = runId
}

async function confirmStop(runId) {
  stopConfirm.value = ''
  stopping.value = runId
  try {
    await api.post(`/api/projects/${projectId.value}/runs/${runId}/stop`)
    await loadRuns()
  } catch (err) {
    runsError.value = errorMessage(err)
  } finally {
    stopping.value = ''
  }
}

/* ============ live monitor ============ */
const selectedRunId = ref('')
const selectedRun = computed(() => runs.value.find((r) => r.run_id === selectedRunId.value) ?? null)
const events = ref([]) // newest-top display rows
const lastSeq = ref(-1)
const monitorError = ref('')
const pollTick = ref(0) // poll-tick bar re-trigger key

async function fetchEventsPage() {
  const id = projectId.value
  const runId = selectedRunId.value
  let added = 0
  // page until a short page — the backend caps each response at 500
  for (;;) {
    const data = await api.get(
      `/api/projects/${id}/runs/${runId}/events?after=${lastSeq.value}`,
    )
    if (projectId.value !== id || selectedRunId.value !== runId) return 0
    const batch = data?.events ?? []
    if (batch.length) {
      lastSeq.value = batch[batch.length - 1].seq
      const rows = batch.map((e) => eventRow(e, byUid.value)).reverse()
      events.value = [...rows, ...events.value]
      added += batch.length
    }
    if (batch.length < EVENTS_PAGE_CAP) return added
  }
}

async function selectRun(runId) {
  if (selectedRunId.value === runId) return
  selectedRunId.value = runId
  events.value = []
  lastSeq.value = -1
  monitorError.value = ''
  try {
    await fetchEventsPage()
  } catch (err) {
    monitorError.value = errorMessage(err)
  }
  schedulePoll()
}

/* ============ 2s poll loop — runs while anything is queued/running ============ */
let pollTimer = null

const pollNeeded = computed(() =>
  runs.value.some((r) => r.status === 'queued' || r.status === 'running'),
)

function schedulePoll() {
  if (pollTimer !== null) return
  if (!pollNeeded.value) return
  pollTimer = setTimeout(pollOnce, POLL_MS)
}

async function pollOnce() {
  pollTimer = null
  const id = projectId.value
  if (!id) return
  await loadRuns()
  if (projectId.value !== id) return
  await loadRunningRounds()
  if (selectedRun.value?.status === 'running' || selectedRun.value?.status === 'queued') {
    try {
      await fetchEventsPage()
      pollTick.value += 1
    } catch (err) {
      monitorError.value = errorMessage(err)
    }
  }
  schedulePoll()
}

watch(pollNeeded, () => schedulePoll())

onBeforeUnmount(() => {
  if (pollTimer !== null) clearTimeout(pollTimer)
  pollTimer = null
})

/* ============ load + project switch ============ */
watch(
  projectId,
  () => {
    population.value = null
    runs.value = []
    runsError.value = ''
    runRounds.value = {}
    selectedRunId.value = ''
    events.value = []
    lastSeq.value = -1
    monitorError.value = ''
    stopConfirm.value = ''
    launchError.value = ''
    launchNeedsBrain.value = false
    launchedNote.value = ''
    initialPosts.value = []
    const id = projectId.value
    if (!id) return
    loadPopulation(id)
    loadRuns().then(() => {
      loadRunningRounds()
      schedulePoll()
    })
  },
  { immediate: true },
)
</script>

<template>
  <section class="view">
    <div class="micro-label">Stage 03 — Run</div>
    <hr class="rule" />

    <p v-if="!projectId" class="hint">Select a project from the top bar first.</p>

    <template v-else>
      <!-- ============ launch panel ============ -->
      <div class="micro-label">Launch</div>
      <div class="panel launch-panel">
        <div class="launch-grid">
          <label class="field">
            <span class="micro-label">Platform</span>
            <select v-model="form.platform">
              <option value="twitter">twitter</option>
              <option value="reddit">reddit</option>
              <option value="both">both</option>
            </select>
          </label>
          <label class="field">
            <span class="micro-label">Rounds</span>
            <input v-model.number="form.rounds" type="number" min="1" step="1" />
            <span v-if="formErrs.rounds" class="danger-text field-error">{{ formErrs.rounds }}</span>
          </label>
          <label class="field">
            <span class="micro-label">Variants</span>
            <input v-model.number="form.variants" type="number" min="1" step="1" />
            <span v-if="formErrs.variants" class="danger-text field-error">{{ formErrs.variants }}</span>
          </label>
          <label class="field">
            <span class="micro-label">Seed — blank for random</span>
            <input v-model="form.seed" type="text" placeholder="random" />
            <span v-if="formErrs.seed" class="danger-text field-error">{{ formErrs.seed }}</span>
          </label>
          <label class="field">
            <span class="micro-label">Minutes / round</span>
            <input v-model.number="form.minutes_per_round" type="number" min="1" step="1" />
            <span class="field-hint">sim-clock per round; ~120 sweeps into daytime so the crowd acts</span>
            <span v-if="formErrs.minutes_per_round" class="danger-text field-error">{{ formErrs.minutes_per_round }}</span>
          </label>
          <label class="field">
            <span class="micro-label">Crowd / round — min</span>
            <input v-model.number="form.agents_per_round_min" type="number" min="0" step="1" />
            <span v-if="formErrs.agents_per_round" class="danger-text field-error">{{ formErrs.agents_per_round }}</span>
          </label>
          <label class="field">
            <span class="micro-label">Crowd / round — max</span>
            <input v-model.number="form.agents_per_round_max" type="number" min="0" step="1" />
          </label>
          <label class="field check-field">
            <span class="check-row">
              <input v-model="form.tiered" type="checkbox" />
              <span>Tiered: protagonists + crowd</span>
            </span>
            <span class="field-hint">untiered leaves crowd-LLM agents dormant</span>
          </label>
          <label v-if="form.platform === 'both'" class="field check-field">
            <span class="check-row">
              <input v-model="form.cross_feed" type="checkbox" />
              <span>Cross-feed top posts between platforms</span>
            </span>
          </label>
        </div>

        <!-- initial posts editor -->
        <div class="posts-head">
          <span class="micro-label">Initial posts — seeded into round zero</span>
          <button class="btn btn-small" @click="addPost">+ add post</button>
        </div>
        <p
          v-if="initialPosts.length && !groups.protagonists.length && !groups.crowdLlm.length && !groups.crowdPolicy.length"
          class="hint"
        >
          No population loaded — build one on the Universe stage first.
        </p>
        <div v-for="(post, i) in initialPosts" :key="i" class="post-row">
          <select v-model="post.agent_uid">
            <option value="">— agent —</option>
            <optgroup v-if="groups.protagonists.length" label="protagonists">
              <option v-for="a in groups.protagonists" :key="a.agent_uid" :value="a.agent_uid">
                {{ a.name }} (@{{ a.username }})
              </option>
            </optgroup>
            <optgroup v-if="groups.crowdLlm.length" label="crowd · LLM">
              <option v-for="a in groups.crowdLlm" :key="a.agent_uid" :value="a.agent_uid">
                {{ a.name }} (@{{ a.username }})
              </option>
            </optgroup>
            <optgroup v-if="groups.crowdPolicy.length" label="crowd · policy">
              <option v-for="a in groups.crowdPolicy" :key="a.agent_uid" :value="a.agent_uid">
                {{ a.name }} (@{{ a.username }})
              </option>
            </optgroup>
          </select>
          <textarea
            v-model="post.content"
            rows="2"
            placeholder="post content…"
            spellcheck="false"
          ></textarea>
          <button class="btn btn-small" title="remove" @click="removePost(i)">×</button>
        </div>

        <div class="form-actions">
          <button class="btn btn-primary" :disabled="!formValid || launching" @click="launch">
            {{ launching ? 'Launching…' : 'Launch' }}
          </button>
          <span v-if="launchedNote" class="success-text">{{ launchedNote }}</span>
        </div>
        <p v-if="launchError" class="danger-text">
          {{ launchError }}
          <template v-if="launchNeedsBrain">
            — <router-link to="/settings">bind a protagonist_brain profile in Settings</router-link>
          </template>
        </p>
      </div>

      <hr class="rule" />

      <!-- ============ run list ============ -->
      <div class="micro-label">Runs</div>
      <p v-if="runsError" class="danger-text">{{ runsError }}</p>
      <p v-if="!runs.length" class="hint">No runs yet — launch one above.</p>
      <div v-else class="panel table-panel">
        <table class="data-table">
          <thead>
            <tr>
              <th class="micro-label">Run</th>
              <th class="micro-label">State</th>
              <th class="micro-label num-col">Round</th>
              <th class="micro-label">Created</th>
              <th class="micro-label">Batch</th>
              <th class="micro-label action-col"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in runs"
              :key="r.run_id"
              class="click-row"
              :class="{ 'row-selected': r.run_id === selectedRunId }"
              @click="selectRun(r.run_id)"
            >
              <td>{{ r.run_id }}</td>
              <td>
                <span class="state" :class="`state-${runDisplayStatus(r)}`">
                  <span class="status-dot"></span>
                  {{ runDisplayStatus(r) }}
                </span>
              </td>
              <td class="num-col">
                <template v-if="r.phase === 'waiting'">done</template>
                <template v-else-if="r.status === 'running' && runRounds[r.run_id] !== undefined">
                  r{{ runRounds[r.run_id] }}
                </template>
                <template v-else>—</template>
              </td>
              <td class="muted">{{ (r.created_at || '').slice(0, 19).replace('T', ' ') }}</td>
              <td class="muted batch-col">{{ r.batch_id }}</td>
              <td class="action-col" @click.stop>
                <template v-if="r.status === 'queued' || r.status === 'running'">
                  <button
                    v-if="stopConfirm !== r.run_id"
                    class="btn btn-small"
                    :disabled="stopping === r.run_id"
                    @click="askStop(r.run_id)"
                  >
                    {{ stopping === r.run_id ? 'Stopping…' : 'Stop' }}
                  </button>
                  <button v-else class="btn btn-small btn-danger" @click="confirmStop(r.run_id)">
                    Confirm stop?
                  </button>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ============ live monitor ============ -->
      <template v-if="selectedRunId">
        <hr class="rule" />
        <div class="monitor-head">
          <span class="micro-label">Monitor — {{ selectedRunId }}</span>
          <span v-if="selectedRun" class="state" :class="`state-${runDisplayStatus(selectedRun)}`">
            <span class="status-dot"></span>
            {{ runDisplayStatus(selectedRun) }}
            <template v-if="selectedRun.phase !== 'waiting' && selectedRun.status === 'running' && runRounds[selectedRunId] !== undefined">
              · r{{ runRounds[selectedRunId] }}
            </template>
          </span>
        </div>
        <p v-if="selectedRun?.message" class="danger-text">{{ selectedRun.message }}</p>
        <p v-if="monitorError" class="danger-text">{{ monitorError }}</p>
        <div class="panel feed-panel">
          <div :key="pollTick" class="poll-tick" aria-hidden="true"></div>
          <p v-if="!events.length" class="hint feed-empty">
            No events yet{{ selectedRun?.status === 'queued' ? ' — waiting for a worker slot' : '' }}.
          </p>
          <div v-else class="feed">
            <div
              v-for="row in events"
              :key="row.seq"
              class="feed-row"
              :class="{ 'feed-system': row.system }"
            >
              <template v-if="row.system">
                <span class="muted">{{ row.round !== null ? `[r${row.round}]` : '[—]' }}</span>
                <span :class="row.danger ? 'danger-text' : 'muted'">{{ row.text }}</span>
              </template>
              <template v-else>
                <span class="muted">[r{{ row.round }}]</span>
                <span class="feed-user" :class="`tier-${row.tier}`">{{ row.username }}</span>
                <span class="muted">{{ row.actionType }}{{ row.detail ? ':' : '' }}</span>
                <span v-if="row.detail">{{ row.detail }}</span>
              </template>
            </div>
          </div>
        </div>
      </template>
    </template>
  </section>
</template>

<style scoped>
.view {
  padding: 24px;
}

.hint,
.muted {
  color: var(--text-muted);
}

.success-text {
  color: var(--success);
}

.danger-text {
  color: var(--danger);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field-error {
  font-size: 11px;
}

.field-hint {
  color: var(--text-dim);
  font-size: 11px;
}

.form-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* --- launch panel --- */
.launch-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.launch-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px 24px;
  max-width: 920px;
}

.check-field {
  justify-content: center;
}

.check-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

input[type='checkbox'] {
  accent-color: var(--accent);
  width: 14px;
  height: 14px;
}

.posts-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}

.post-row {
  display: grid;
  grid-template-columns: 240px 1fr 32px;
  gap: 10px;
  align-items: start;
}

.post-row textarea {
  resize: vertical;
}

.btn-small {
  height: 24px;
  padding: 0 10px;
  font-size: 11px;
}

/* --- run list --- */
.table-panel {
  padding: 12px 16px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  text-align: left;
  padding: 6px 10px;
  border-bottom: 1px dashed rgba(53, 90, 102, 0.5);
}

.data-table td {
  padding: 7px 10px;
  vertical-align: middle;
}

.data-table tbody tr {
  border-bottom: 1px dashed rgba(53, 90, 102, 0.25);
}

.click-row {
  cursor: pointer;
}

.click-row:hover td {
  color: var(--text);
}

.row-selected td:first-child {
  color: var(--accent);
}

.num-col {
  text-align: right;
  width: 70px;
}

.action-col {
  width: 110px;
  text-align: right;
}

.batch-col {
  font-size: 11px;
}

/* --- run state: colored dot + word, never a wash --- */
.state {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.state-queued {
  color: var(--text-dim);
}

.state-running {
  color: var(--accent);
}

.state-interviewable {
  color: var(--info);
}

.state-running .status-dot {
  animation: run-pulse 1.6s ease-in-out infinite;
}

.state-finished {
  color: var(--success);
}

.state-failed {
  color: var(--danger);
}

.state-stopped {
  color: var(--warn);
}

@keyframes run-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

/* --- live monitor --- */
.monitor-head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 10px;
}

.feed-panel {
  padding: 0;
  overflow: hidden;
}

/* the poll-tick: a 1px accent flash on every refresh (TrueTrader signature) */
.poll-tick {
  height: 1px;
  background: var(--accent);
  opacity: 0;
  animation: tick-fade 700ms ease-out;
}

@keyframes tick-fade {
  0% {
    opacity: 0.9;
  }
  100% {
    opacity: 0;
  }
}

.feed-empty {
  padding: 14px 16px;
}

.feed {
  max-height: 480px;
  overflow-y: auto;
  padding: 8px 0;
}

.feed-row {
  padding: 3px 16px;
  font-size: 12px;
  line-height: 1.6;
  word-break: break-word;
}

/* explicit gaps — Vue's whitespace condensing eats text-node spaces */
.feed-row > span + span {
  margin-left: 7px;
}

.feed-system {
  font-size: 11px;
}

/* tier colors match the Universe agent browser */
.tier-protagonist {
  color: var(--accent);
}

.tier-crowd_llm {
  color: var(--info);
}

.tier-crowd_policy {
  color: var(--text-muted);
}

.tier-unknown {
  color: var(--text-dim);
}
</style>
