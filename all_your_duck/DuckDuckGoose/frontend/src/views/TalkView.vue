<script setup>
// Stage 5 — live interviews (running runs) + post-hoc persona chat.
import { computed, nextTick, ref, watch } from 'vue'
import { api, ApiError, errorMessage } from '../api.js'
import { sanitizeLeakedTokens } from '../md.js'
import { useProject } from '../composables/useProject.js'
import {
  agentGroups,
  interviewAvailable,
  resolveTalkMode,
  runDisplayStatus,
  splitTranscript,
  talkPickerOrder,
} from '../runs.js'

const { projectId } = useProject()
// strip leaked chat/format tokens cheap models emit (interview path is the most
// prone — OASIS feeds the agent its whole run-length memory)
const clean = (text) => sanitizeLeakedTokens(text)

/* ============ pickers ============ */
const runs = ref([])
const runsError = ref('')
const selectedRunId = ref('')
const population = ref(null)
const selectedAgentUid = ref('')

const pickerRuns = computed(() => talkPickerOrder(runs.value))
const selectedRun = computed(() => runs.value.find((r) => r.run_id === selectedRunId.value) ?? null)
const groups = computed(() => agentGroups(population.value))
const selectedAgent = computed(
  () =>
    (population.value?.agents ?? []).find((a) => a.agent_uid === selectedAgentUid.value) ?? null,
)

// Persona-chat (clean persona rebuilt from artifacts) is the RELIABLE path and
// works on ANY started run — including a wait-mode ("interviewable") run —
// because it never touches the live worker. The live interview only works while
// the worker is alive (status "running", incl. wait mode) and can be slow/empty
// (OASIS feeds the agent its whole run-length memory). So: chat is always
// offered; interview is an opt-in toggle available only when the worker is live.
const talkMode = ref('chat')
const interviewLive = computed(() => interviewAvailable(selectedRun.value))
const started = computed(() => mode.value !== 'unavailable' && mode.value !== '')
const mode = computed(() => resolveTalkMode(selectedRun.value, talkMode.value))

async function loadRuns(id) {
  try {
    const data = await api.get(`/api/projects/${id}/runs`)
    if (projectId.value !== id) return
    runs.value = data?.runs ?? []
    runsError.value = ''
    if (!selectedRunId.value && pickerRuns.value.length) {
      selectedRunId.value = pickerRuns.value[0].run_id
    }
  } catch (err) {
    if (projectId.value !== id) return
    runsError.value = errorMessage(err)
  }
}

async function loadPopulation(id) {
  try {
    const data = await api.get(`/api/projects/${id}/population`)
    if (projectId.value !== id) return
    population.value = data
    // default to the first protagonist
    if (!selectedAgentUid.value) {
      const first = agentGroups(data).protagonists[0] ?? data?.agents?.[0]
      if (first) selectedAgentUid.value = first.agent_uid
    }
  } catch {
    if (projectId.value !== id) return
    population.value = null
  }
}

/* ============ interview (running runs) ============ */
const interviewPrompt = ref('')
const interviewing = ref(false)
const interviewWarn = ref('')
const interviewError = ref('')
const interviews = ref([]) // newest-top {prompt, response}

const INTERVIEW_504 =
  'worker busy or run not in wait mode — try again or use chat on a finished run'

async function askInterview() {
  const prompt = interviewPrompt.value.trim()
  if (!prompt || !selectedAgentUid.value || interviewing.value) return
  interviewWarn.value = ''
  interviewError.value = ''
  interviewing.value = true
  try {
    const res = await api.post(
      `/api/projects/${projectId.value}/runs/${selectedRunId.value}/interview`,
      { agent_uid: selectedAgentUid.value, prompt },
    )
    if (res?.status === 'failed') {
      interviewError.value = res?.error || 'interview failed'
    } else {
      interviews.value = [
        { prompt, response: res?.result?.response ?? '(no response captured)' },
        ...interviews.value,
      ]
      interviewPrompt.value = ''
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 504) {
      interviewWarn.value = INTERVIEW_504
    } else {
      interviewError.value = errorMessage(err)
    }
  } finally {
    interviewing.value = false
  }
}

/* ============ persona chat (finished/stopped runs) ============ */
/* Thread entries: {role: 'user' | 'assistant' | 'error', content}.
 * Only user/assistant turns are sent as history with each message. */
const thread = ref([])
const chatInput = ref('')
const chatting = ref(false)
const threadEl = ref(null)

const history = computed(() =>
  thread.value
    .filter((t) => t.role === 'user' || t.role === 'assistant')
    .map((t) => ({ role: t.role, content: t.content })),
)

async function scrollThread() {
  await nextTick()
  if (threadEl.value) threadEl.value.scrollTop = threadEl.value.scrollHeight
}

async function sendChat() {
  const message = chatInput.value.trim()
  if (!message || !selectedAgentUid.value || chatting.value) return
  const priorHistory = history.value
  thread.value.push({ role: 'user', content: message })
  chatInput.value = ''
  chatting.value = true
  scrollThread()
  try {
    const res = await api.post(
      `/api/projects/${projectId.value}/runs/${selectedRunId.value}/agents/${selectedAgentUid.value}/chat`,
      { message, history: priorHistory },
    )
    thread.value.push({ role: 'assistant', content: res?.reply ?? '' })
  } catch (err) {
    // LLM/backend failure: a danger system line, excluded from history
    thread.value.push({ role: 'error', content: errorMessage(err) })
  } finally {
    chatting.value = false
    scrollThread()
  }
}

function clearChat() {
  thread.value = []
}

/* re-hydrate saved Q&A so switching agents, reloading, or re-opening the
 * project later never loses interview or chat history (persisted server-side). */
async function loadTranscript() {
  const rid = selectedRunId.value
  const aid = selectedAgentUid.value
  if (!rid || !aid) return
  try {
    const data = await api.get(
      `/api/projects/${projectId.value}/runs/${rid}/agents/${aid}/transcript`,
    )
    // ignore a slow response that arrives after another switch
    if (selectedRunId.value !== rid || selectedAgentUid.value !== aid) return
    const { interviews: iv, thread: th } = splitTranscript(data?.turns)
    interviews.value = iv
    thread.value = th
  } catch {
    // best-effort: leave the cleared (empty) state
  }
}

/* ============ selection resets + project switch ============ */
watch([selectedRunId, selectedAgentUid], () => {
  // a different run or agent is a different conversation — clear, then
  // re-hydrate any saved history for the new selection.
  thread.value = []
  chatInput.value = ''
  interviews.value = []
  interviewPrompt.value = ''
  interviewWarn.value = ''
  interviewError.value = ''
  talkMode.value = 'chat' // default to the reliable path on every new selection
  loadTranscript()
})

watch(
  projectId,
  () => {
    runs.value = []
    runsError.value = ''
    selectedRunId.value = ''
    population.value = null
    selectedAgentUid.value = ''
    thread.value = []
    interviews.value = []
    const id = projectId.value
    if (!id) return
    loadRuns(id)
    loadPopulation(id)
  },
  { immediate: true },
)
</script>

<template>
  <section class="view">
    <div class="micro-label">Stage 05 — Talk</div>
    <hr class="rule" />

    <p v-if="!projectId" class="hint">Select a project from the top bar first.</p>

    <template v-else>
      <p v-if="runsError" class="danger-text">{{ runsError }}</p>
      <p v-if="!runs.length" class="hint">No runs yet — launch one on the Run stage.</p>

      <template v-else>
        <div class="picker-row">
          <label class="field">
            <span class="micro-label">Run</span>
            <select v-model="selectedRunId">
              <option v-for="r in pickerRuns" :key="r.run_id" :value="r.run_id">
                {{ r.run_id }} · {{ runDisplayStatus(r) }}
              </option>
            </select>
          </label>
          <label class="field">
            <span class="micro-label">Agent</span>
            <select v-model="selectedAgentUid">
              <option value="">— agent —</option>
              <optgroup v-if="groups.protagonists.length" label="● Protagonists — full LLM (best to talk to)">
                <option v-for="a in groups.protagonists" :key="a.agent_uid" :value="a.agent_uid">
                  {{ a.name }} (@{{ a.username }})
                </option>
              </optgroup>
              <optgroup v-if="groups.crowdLlm.length" label="○ Crowd · lightweight LLM">
                <option v-for="a in groups.crowdLlm" :key="a.agent_uid" :value="a.agent_uid">
                  {{ a.name }} (@{{ a.username }})
                </option>
              </optgroup>
              <optgroup v-if="groups.crowdPolicy.length" label="· Crowd · compiled policy (no LLM)">
                <option v-for="a in groups.crowdPolicy" :key="a.agent_uid" :value="a.agent_uid">
                  {{ a.name }} (@{{ a.username }})
                </option>
              </optgroup>
            </select>
          </label>
        </div>

        <hr class="rule" />

        <!-- mode toggle: chat is always available; interview only while live -->
        <div v-if="started" class="talk-mode">
          <div class="talk-toggle" role="group" aria-label="Talk mode">
            <button type="button" class="seg" :class="{ 'seg-on': mode === 'chat' }"
              @click="talkMode = 'chat'">Persona chat</button>
            <button type="button" class="seg" :class="{ 'seg-on': mode === 'interview' }"
              :disabled="!interviewLive" @click="talkMode = 'interview'"
              :title="interviewLive ? 'ask the live agent' : 'only while the run worker is alive'">
              Live interview
            </button>
          </div>
          <span class="hint mode-note">{{
            mode === 'interview'
              ? 'Live: asks the running agent (whole-run memory — can be slow).'
              : interviewLive
                ? 'Reliable: persona rebuilt from this run\'s artifacts. (Live interview available →)'
                : 'Reliable: persona rebuilt from this run\'s artifacts.'
          }}</span>
        </div>

        <!-- ============ interview: run still alive ============ -->
        <template v-if="mode === 'interview'">
          <div class="micro-label">
            Interview — the worker answers live, in character
          </div>
          <div class="panel talk-panel">
            <textarea
              v-model="interviewPrompt"
              rows="3"
              :placeholder="selectedAgent ? `ask @${selectedAgent.username}…` : 'pick an agent first'"
              spellcheck="false"
              @keydown.enter.exact.prevent="askInterview"
            ></textarea>
            <div class="form-actions">
              <button
                class="btn btn-primary"
                :disabled="!interviewPrompt.trim() || !selectedAgentUid || interviewing"
                @click="askInterview"
              >
                {{ interviewing ? 'Asking… (can take a while)' : 'Ask' }}
              </button>
            </div>
            <p v-if="interviewWarn" class="warn-text">{{ interviewWarn }}</p>
            <p v-if="interviewError" class="danger-text">{{ interviewError }}</p>

            <div v-for="(iv, i) in interviews" :key="i" class="interview-pair">
              <div class="micro-label">Q</div>
              <p class="interview-q">{{ iv.prompt }}</p>
              <div class="micro-label">A — @{{ selectedAgent?.username ?? '?' }}</div>
              <p class="interview-a">{{ clean(iv.response) }}</p>
            </div>
          </div>
        </template>

        <!-- ============ persona chat: run over, voice rebuilt from artifacts ============ -->
        <template v-else-if="mode === 'chat'">
          <div class="chat-head">
            <span class="micro-label">
              Persona chat — rebuilt from run artifacts{{ selectedAgent ? ` · @${selectedAgent.username}` : '' }}
            </span>
            <button class="btn btn-small" :disabled="!thread.length" @click="clearChat">
              Clear chat
            </button>
          </div>
          <div class="panel talk-panel chat-panel">
            <div ref="threadEl" class="thread">
              <p v-if="!thread.length" class="hint">
                Ask the agent about what it did and saw during the run.
              </p>
              <template v-for="(turn, i) in thread" :key="i">
                <p v-if="turn.role === 'error'" class="danger-text system-line">
                  × {{ turn.content }}
                </p>
                <div v-else class="bubble-row" :class="turn.role === 'user' ? 'row-user' : 'row-agent'">
                  <div class="bubble" :class="turn.role === 'user' ? 'bubble-user' : 'bubble-agent'">
                    {{ clean(turn.content) }}
                  </div>
                </div>
              </template>
              <p v-if="chatting" class="hint system-line">…thinking</p>
            </div>
            <div class="input-bar">
              <input
                v-model="chatInput"
                type="text"
                class="chat-input"
                :placeholder="selectedAgent ? `message @${selectedAgent.username}…` : 'pick an agent first'"
                :disabled="!selectedAgentUid"
                @keydown.enter="sendChat"
              />
              <button
                class="btn btn-primary"
                :disabled="!chatInput.trim() || !selectedAgentUid || chatting"
                @click="sendChat"
              >
                Send
              </button>
            </div>
          </div>
        </template>

        <p v-else-if="mode === 'unavailable'" class="hint">
          This run is {{ runDisplayStatus(selectedRun) }} —
          {{ selectedRun?.status === 'queued'
            ? 'wait for it to start, then interview live.'
            : 'persona chat needs a finished or stopped run.' }}
        </p>
      </template>
    </template>
  </section>
</template>

<style scoped>
.view {
  padding: 24px;
}

.hint {
  color: var(--text-muted);
}

/* --- talk mode toggle --- */
.talk-mode {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.talk-toggle {
  display: inline-flex;
  border: 1px solid var(--border-mid);
  border-radius: var(--radius);
  overflow: hidden;
}

.talk-toggle .seg {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 5px 12px;
  cursor: pointer;
  transition: color 150ms ease-out, background 150ms ease-out;
}

.talk-toggle .seg:hover:not(:disabled) {
  color: var(--text);
}

.talk-toggle .seg.seg-on {
  background: var(--accent-bg);
  color: var(--accent);
}

.talk-toggle .seg:disabled {
  color: var(--text-dim);
  cursor: not-allowed;
}

.talk-toggle .seg + .seg {
  border-left: 1px solid var(--border);
}

.mode-note {
  font-size: 11px;
}

.danger-text {
  color: var(--danger);
}

.warn-text {
  color: var(--warn);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.form-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.picker-row {
  display: flex;
  gap: 24px;
}

.picker-row .field {
  min-width: 280px;
}

.btn-small {
  height: 24px;
  padding: 0 10px;
  font-size: 11px;
}

.talk-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.talk-panel textarea {
  resize: vertical;
}

/* --- interview transcript --- */
.interview-pair {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-top: 10px;
  border-top: 1px dashed rgba(53, 90, 102, 0.5);
}

.interview-q {
  color: var(--text-muted);
}

.interview-a {
  white-space: pre-wrap;
}

/* --- persona chat thread --- */
.chat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.chat-panel {
  gap: 0;
  padding: 0;
}

.thread {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  max-height: 480px;
  overflow-y: auto;
}

.bubble-row {
  display: flex;
}

.row-user {
  justify-content: flex-end;
}

.row-agent {
  justify-content: flex-start;
}

/* Odysseus-style asymmetric bubbles: flat corner points at the speaker */
.bubble {
  max-width: 72%;
  padding: 8px 14px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.bubble-user {
  border-radius: 18px 18px 0 18px;
}

.bubble-agent {
  border-radius: 18px 18px 18px 0;
}

.system-line {
  font-size: 11px;
  text-align: center;
}

/* --- input bar --- */
.input-bar {
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  border-top: 1px dashed rgba(53, 90, 102, 0.5);
}

.chat-input {
  flex: 1;
  border-radius: 16px;
  padding: 7px 14px;
}
</style>
