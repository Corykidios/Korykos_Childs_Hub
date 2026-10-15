<script setup>
// Stage 4 — metrics dashboard, report panel, batch comparison.
import { computed, ref, watch } from 'vue'
import { api, ApiError, errorMessage } from '../api.js'
import TaskProgress from '../components/TaskProgress.vue'
import ReplyNetwork from '../components/ReplyNetwork.vue'
import { useProject } from '../composables/useProject.js'
import { renderMarkdown, sanitizeLeakedTokens } from '../md.js'
import { batchRows, EMPTY_CELL, fmtCell } from '../results.js'
import { resultsPickerOrder, runDisplayStatus } from '../runs.js'
import { factionScoreboard } from '../factions.js'
import {
  chartCaptions,
  inflections,
  nightRounds,
  storyBeats,
  verdictExplain,
  volumeForChart,
} from '../insights.js'
import { bandRects, playheadX, polylinePoints, segmentPoints, signSegments } from '../sparkline.js'

const { projectId } = useProject()

/* ============ run picker (finished first) ============ */
const runs = ref([])
const runsError = ref('')
const selectedRunId = ref('')

const pickerRuns = computed(() => resultsPickerOrder(runs.value))
const selectedRun = computed(() => runs.value.find((r) => r.run_id === selectedRunId.value) ?? null)

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

/* ============ metrics dashboard ============ */
const SPARK_W = 560
const SPARK_H = 64
const BAR_H = 80

const metrics = ref(null)
const metricsError = ref('')
const highlights = ref([]) // top posts by score — the verdict panel's evidence quotes

async function loadMetrics(runId) {
  metrics.value = null
  metricsError.value = ''
  const id = projectId.value
  try {
    const data = await api.get(`/api/projects/${id}/runs/${runId}/metrics`)
    if (projectId.value !== id || selectedRunId.value !== runId) return
    metrics.value = data
  } catch (err) {
    if (projectId.value !== id || selectedRunId.value !== runId) return
    metricsError.value = errorMessage(err)
  }
}

async function loadHighlights(runId) {
  highlights.value = []
  const id = projectId.value
  try {
    const data = await api.get(`/api/projects/${id}/runs/${runId}/highlights?limit=3`)
    if (projectId.value !== id || selectedRunId.value !== runId) return
    highlights.value = data?.highlights ?? []
  } catch {
    if (projectId.value === id && selectedRunId.value === runId) highlights.value = []
  }
}

const narrative = ref(null) // optional richer prose (dek + story beats), free
async function loadNarrative(runId) {
  narrative.value = null
  const id = projectId.value
  try {
    const data = await api.get(`/api/projects/${id}/runs/${runId}/narrative`)
    if (projectId.value !== id || selectedRunId.value !== runId) return
    narrative.value = data && Object.keys(data).length ? data : null
  } catch {
    if (projectId.value === id && selectedRunId.value === runId) narrative.value = null
  }
}

const network = ref(null)
async function loadNetwork(runId) {
  network.value = null
  const id = projectId.value
  try {
    const data = await api.get(`/api/projects/${id}/runs/${runId}/network`)
    if (projectId.value !== id || selectedRunId.value !== runId) return
    network.value = data
  } catch {
    if (projectId.value === id && selectedRunId.value === runId) network.value = null
  }
}
const hasNetwork = computed(() => (network.value?.nodes?.length ?? 0) > 0)

// richer prose beats from narrative.json when present, else the deterministic ones
const beats = computed(() => {
  const nb = narrative.value?.story_beats
  if (Array.isArray(nb) && nb.length) {
    return nb.map((b) => ({ round: Number(b?.round ?? 0), text: String(b?.text ?? '') }))
  }
  return storyBeats(metrics.value)
})
function truncateQuote(text, n = 180) {
  const t = sanitizeLeakedTokens(text).replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}

const sentimentScores = computed(() =>
  (metrics.value?.sentiment_trend ?? []).map((s) => Number(s?.score ?? 0)),
)
/* sign-colored segments over a pinned [-1, 1] domain: positive runs in
 * --success, negative in --danger (data colors, never the accent) */
const sentimentSegments = computed(() =>
  signSegments(sentimentScores.value).map((seg) => ({
    sign: seg.sign,
    points: segmentPoints(seg, sentimentScores.value.length, SPARK_W, SPARK_H, {
      min: -1,
      max: 1,
    }),
  })),
)
const lastSentiment = computed(() => {
  const scores = sentimentScores.value
  return scores.length ? scores[scores.length - 1] : null
})

/* volume with the r0 follow-burst broken off-scale so the real rounds are
 * legible (insights.volumeForChart detects the burst structurally) */
const vol = computed(() => volumeForChart(metrics.value))
const volBars = computed(() => {
  const per = metrics.value?.per_round ?? []
  if (!per.length) return []
  const maxRest = Math.max(...vol.value.values, 1)
  const step = SPARK_W / per.length
  const width = Math.max(step - 2, 1)
  return per.map((r, i) => {
    const isBurst = vol.value.burst != null && r.round === vol.value.burst.round
    const raw = isBurst ? BAR_H : Math.max(1, Math.round((Number(r.actions || 0) / maxRest) * BAR_H))
    const h = Math.min(raw, BAR_H)
    return { round: r.round, x: i * step, y: BAR_H - h, width, height: h, isBurst, actions: Number(r.actions || 0) }
  })
})

const divergenceShares = computed(() =>
  (metrics.value?.divergence ?? []).map((d) => Number(d?.protagonist_share ?? 0)),
)
const divergencePoints = computed(() =>
  polylinePoints(divergenceShares.value, SPARK_W, SPARK_H, { min: 0, max: 1 }),
)

const cascadeCells = computed(() => {
  const m = metrics.value
  if (!m) return []
  const cascade = m.cascade ?? {}
  return [
    { label: 'Total actions', value: fmtCell(m.total_actions) },
    { label: 'Agents engaged', value: fmtCell(cascade.agents_engaged) },
    {
      label: 'Engaged share',
      value:
        typeof cascade.engaged_share === 'number'
          ? `${Math.round(cascade.engaged_share * 100)}%`
          : EMPTY_CELL,
    },
    { label: 'Half engaged by', value: fmtCell(cascade.first_round_half_engaged) },
  ]
})

const topicRows = computed(() =>
  Object.entries(metrics.value?.topic_totals ?? {}).sort((a, b) => b[1] - a[1]),
)

/* --- regime + self-explaining layer (insights.js, all deterministic) --- */
const roundsCount = computed(
  () => metrics.value?.rounds_observed || (metrics.value?.per_round?.length ?? 0),
)
const nights = computed(() => nightRounds(metrics.value))
const captions = computed(() => chartCaptions(metrics.value))
// night/day bands behind the line charts (SPARK_H) and the volume chart (BAR_H)
const sparkBands = computed(() => bandRects(nights.value, roundsCount.value, SPARK_W, SPARK_H))
const volBands = computed(() => bandRects(nights.value, roundsCount.value, SPARK_W, BAR_H))
const hasNights = computed(() => nights.value.length > 0)

// labelled inflection pins on the sentiment line (global low/high + key turns)
function pinY(score) {
  return SPARK_H * (1 - (Math.max(-1, Math.min(1, score)) + 1) / 2)
}
const sentPins = computed(() => {
  // exclude the r0 follow-burst round — it's the bootstrap we tell the operator
  // to ignore elsewhere, so pinning its sentiment as "the high" would mislead.
  const burstRound = vol.value.burst?.round
  const trend = (metrics.value?.sentiment_trend ?? []).filter((p) => p?.round !== burstRound)
  return inflections(trend, 5).map((p) => ({
    ...p,
    x: playheadX(p.round, roundsCount.value, SPARK_W),
    y: pinY(p.score),
    night: nights.value.includes(p.round),
  }))
})

// faction scoreboard — the readable replacement for the 6-line chart
const scoreboard = computed(() => factionScoreboard(metrics.value))

/* ============ report panel ============ */
const report = ref(null) // {report: md text, meta} | null
const reportError = ref('')
const reportNeedsWriter = ref(false)
const reportTaskId = ref('')
const generating = ref(false)

const reportHtml = computed(() => (report.value ? renderMarkdown(report.value.report) : ''))
const direction = computed(() => report.value?.meta?.direction ?? null)
const verdict = computed(() => verdictExplain(direction.value))
const sections = computed(() => report.value?.meta?.sections ?? [])

function sectionChip(section) {
  if (section.status === 'failed') return { text: 'failed', warn: true }
  if (section.ungrounded) return { text: 'ungrounded', warn: true }
  return { text: 'ok', warn: false }
}

async function loadReport(runId) {
  report.value = null
  const id = projectId.value
  try {
    const data = await api.get(`/api/projects/${id}/runs/${runId}/report`)
    if (projectId.value !== id || selectedRunId.value !== runId) return
    report.value = data
  } catch (err) {
    if (projectId.value !== id || selectedRunId.value !== runId) return
    // 404 = not generated yet — an expected state, not an error
    if (!(err instanceof ApiError && err.status === 404)) {
      reportError.value = errorMessage(err)
    }
  }
}

async function generateReport() {
  reportError.value = ''
  reportNeedsWriter.value = false
  try {
    const res = await api.post(
      `/api/projects/${projectId.value}/runs/${selectedRunId.value}/report`,
    )
    reportTaskId.value = res.task_id
    generating.value = true
  } catch (err) {
    reportNeedsWriter.value =
      err instanceof ApiError && err.status === 409 && /report_writer/i.test(errorMessage(err))
    reportError.value = errorMessage(err)
  }
}

async function onReportDone() {
  generating.value = false
  await loadReport(selectedRunId.value)
}

function onReportFailed() {
  // TaskProgress already shows the failure message in --danger.
  generating.value = false
}

/* ============ batch comparison ============ */
const batch = ref([]) // assembled display rows
const batchError = ref('')

const batchSiblings = computed(() => {
  const batchId = selectedRun.value?.batch_id
  if (!batchId) return 0
  return runs.value.filter((r) => r.batch_id === batchId).length
})

async function loadBatch(runId) {
  batch.value = []
  batchError.value = ''
  const id = projectId.value
  const batchId = selectedRun.value?.batch_id
  if (!batchId || batchSiblings.value < 2) return
  try {
    const data = await api.get(`/api/projects/${id}/batches/${batchId}`)
    if (projectId.value !== id || selectedRunId.value !== runId) return
    batch.value = batchRows(data)
  } catch (err) {
    if (projectId.value !== id || selectedRunId.value !== runId) return
    batchError.value = errorMessage(err)
  }
}

/* ============ selection + project switch ============ */
watch(selectedRunId, (runId) => {
  metrics.value = null
  metricsError.value = ''
  highlights.value = []
  report.value = null
  reportError.value = ''
  reportNeedsWriter.value = false
  reportTaskId.value = ''
  generating.value = false
  batch.value = []
  batchError.value = ''
  network.value = null
  narrative.value = null
  if (!runId) return
  loadMetrics(runId)
  loadHighlights(runId)
  loadNetwork(runId)
  loadNarrative(runId)
  loadReport(runId)
  loadBatch(runId)
})

watch(
  projectId,
  () => {
    runs.value = []
    runsError.value = ''
    selectedRunId.value = ''
    metrics.value = null
    metricsError.value = ''
    highlights.value = []
    network.value = null
    narrative.value = null
    report.value = null
    reportError.value = ''
    reportNeedsWriter.value = false
    reportTaskId.value = ''
    generating.value = false
    batch.value = []
    batchError.value = ''
    if (projectId.value) loadRuns(projectId.value)
  },
  { immediate: true },
)
</script>

<template>
  <section class="view">
    <div class="micro-label">Stage 04 — Results</div>
    <hr class="rule" />

    <p v-if="!projectId" class="hint">Select a project from the top bar first.</p>

    <template v-else>
      <p v-if="runsError" class="danger-text">{{ runsError }}</p>
      <p v-if="!runs.length" class="hint">No runs yet — launch one on the Run stage.</p>

      <template v-else>
        <!-- run picker, finished first -->
        <label class="field picker-field">
          <span class="micro-label">Run</span>
          <select v-model="selectedRunId">
            <option v-for="r in pickerRuns" :key="r.run_id" :value="r.run_id">
              {{ r.run_id }} · {{ runDisplayStatus(r) }}
            </option>
          </select>
        </label>

        <template v-if="selectedRunId">
          <hr class="rule" />

          <!-- ============ answer-first overview ============ -->
          <div v-if="direction" class="panel verdict-panel">
            <div class="micro-label">The verdict</div>
            <p class="verdict-answer">{{ direction.answer }}</p>
            <p v-if="narrative?.dek" class="verdict-dek">{{ narrative.dek }}</p>
            <div class="verdict-conf">
              <span class="conf-gauge" :class="`conf-${verdict.band}`">
                <span class="conf-fill" :style="{ width: (verdict.pct ?? 0) + '%' }"></span>
              </span>
              <span class="verdict-explain">{{ verdict.text }}</span>
            </div>
            <template v-if="highlights.length">
              <div class="micro-label evidence-head">Loudest voices — top posts by net votes</div>
              <div v-for="q in highlights" :key="q.post_id" class="quote">
                <span class="quote-text">“{{ truncateQuote(q.content) }}”</span>
                <span class="quote-by">
                  — <span :class="`tier-${q.author.tier}`">{{ q.author.name || q.author.username }}</span>
                  <span v-if="q.author.faction" class="muted"> ({{ q.author.faction }})</span>
                  <span class="muted"> · round {{ q.round }} · {{ q.num_likes }}↑</span>
                </span>
              </div>
            </template>
          </div>

          <div v-if="beats.length" class="panel beats-panel">
            <div class="micro-label">How it unfolded</div>
            <ol class="beats">
              <li v-for="b in beats" :key="b.round" class="beat">{{ b.text }}</li>
            </ol>
          </div>

          <!-- ============ metrics dashboard ============ -->
          <div class="micro-label">Metrics</div>
          <p v-if="metricsError" class="danger-text">{{ metricsError }}</p>
          <p v-else-if="!metrics" class="hint">loading metrics…</p>
          <template v-else>
            <p v-if="!metrics.total_actions" class="hint">
              No actions recorded yet{{ ['queued', 'running'].includes(runDisplayStatus(selectedRun)) ? ' — the run is still in flight' : '' }}.
            </p>
            <template v-else>
              <!-- cascade stat cells -->
              <div class="stat-row">
                <div v-for="cell in cascadeCells" :key="cell.label" class="stat-cell">
                  <span class="big-num stat-value">{{ cell.value }}</span>
                  <span class="micro-label">{{ cell.label }}</span>
                </div>
              </div>

              <p v-if="hasNights" class="micro-label night-legend">
                <span class="night-key"></span> shaded = "night" rounds — only the {{ '★' }} protagonists posted (the crowd was asleep). Read every dip inside its regime.
              </p>

              <div class="charts">
                <!-- sentiment trend: sign-colored, pinned [-1,1], with night
                     bands behind + labelled inflection pins + a caption -->
                <div class="chart">
                  <span class="micro-label">Sentiment trend — net mood per round</span>
                  <svg :width="SPARK_W" :height="SPARK_H" class="spark">
                    <rect v-for="b in sparkBands" :key="`b${b.x}`" :x="b.x" :y="b.y"
                      :width="b.width" :height="b.height" class="night-band" />
                    <line x1="0" :y1="SPARK_H / 2" :x2="SPARK_W" :y2="SPARK_H / 2" class="zero-line" />
                    <polyline v-for="(seg, i) in sentimentSegments" :key="i" :points="seg.points"
                      fill="none" :stroke="seg.sign >= 0 ? 'var(--success)' : 'var(--danger)'"
                      stroke-width="1.5" />
                    <g v-for="p in sentPins" :key="`p${p.round}`">
                      <circle :cx="p.x" :cy="p.y" :r="p.kind === 'turn' ? 1.5 : 3"
                        :class="`pin pin-${p.kind}`" />
                      <text v-if="p.kind !== 'turn'" :x="p.x" :y="p.kind === 'low' ? p.y + 13 : p.y - 7"
                        text-anchor="middle" :class="`pin-label pin-${p.kind}`">
                        r{{ p.round }} {{ p.kind }}{{ p.night ? ' · night' : '' }}
                      </text>
                    </g>
                  </svg>
                  <span class="micro-label chart-caption">{{ captions.sentiment }}</span>
                </div>

                <!-- action volume: r0 follow-burst broken off-scale -->
                <div class="chart">
                  <span class="micro-label">Action volume per round</span>
                  <svg :width="SPARK_W" :height="BAR_H" class="spark">
                    <rect v-for="b in volBands" :key="`vb${b.x}`" :x="b.x" :y="b.y"
                      :width="b.width" :height="b.height" class="night-band" />
                    <template v-for="r in volBars" :key="`v${r.round}`">
                      <rect :x="r.x" :y="r.y" :width="r.width" :height="r.height"
                        :fill="r.isBurst ? 'var(--text-dim)' : 'var(--info)'"
                        :class="{ 'burst-bar': r.isBurst }" />
                      <text v-if="r.isBurst" :x="r.x + r.width + 4" y="10" class="burst-label">
                        {{ r.actions.toLocaleString() }} follows ⤴ off-scale
                      </text>
                    </template>
                  </svg>
                  <span class="micro-label chart-caption">{{ captions.volume }}</span>
                </div>

                <!-- divergence: protagonist share, with night bands -->
                <div class="chart">
                  <span class="micro-label">Who's talking — protagonist share of each round</span>
                  <svg :width="SPARK_W" :height="SPARK_H" class="spark">
                    <rect v-for="b in sparkBands" :key="`db${b.x}`" :x="b.x" :y="b.y"
                      :width="b.width" :height="b.height" class="night-band" />
                    <polyline :points="divergencePoints" fill="none" stroke="var(--accent-dim)"
                      stroke-width="1.5" />
                  </svg>
                  <span class="micro-label chart-caption">{{ captions.divergence }}</span>
                </div>

                <!-- faction scoreboard: readable replacement for the 6-line chart -->
                <div v-if="scoreboard.length" class="chart">
                  <span class="micro-label">Who won the argument — blocs by share of the debate + net sentiment</span>
                  <div class="scoreboard">
                    <div v-for="b in scoreboard" :key="b.key" class="sb-row">
                      <span class="sb-name" :style="{ color: b.color }">{{ b.label }}</span>
                      <span class="sb-track" :title="`${Math.round(b.share * 100)}% of classified posts`">
                        <span class="sb-fill"
                          :style="{ width: (b.share / scoreboard[0].share * 100) + '%', background: b.color }"></span>
                      </span>
                      <span class="sb-score"
                        :class="b.score >= 0.1 ? 'success-text' : b.score <= -0.1 ? 'danger-text' : 'muted'">
                        {{ (b.score >= 0 ? '+' : '') + b.score.toFixed(2) }}
                      </span>
                      <span class="sb-read muted">{{ b.read }}</span>
                    </div>
                  </div>
                  <span class="micro-label chart-foot">
                    bar = share of the run's classified posts · number = net sentiment ((pos−neg)/posts)
                  </span>
                </div>
              </div>

              <!-- topic engagement -->
              <template v-if="topicRows.length">
                <div class="micro-label topic-head">Topic engagement</div>
                <div class="panel table-panel topic-panel">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th class="micro-label">Topic</th>
                        <th class="micro-label num-col">Mentions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="[topic, count] in topicRows" :key="topic">
                        <td>{{ topic }}</td>
                        <td class="num-col">{{ count }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </template>
            </template>
          </template>

          <!-- ============ reply network ============ -->
          <template v-if="hasNetwork">
            <hr class="rule" />
            <div class="micro-label">Who talked to whom — reply network</div>
            <div class="panel network-panel">
              <ReplyNetwork :data="network" />
            </div>
          </template>

          <hr class="rule" />

          <!-- ============ report panel ============ -->
          <div class="section-head">
            <span class="micro-label">Report</span>
            <button class="btn" :class="{ 'btn-primary': !report }" :disabled="generating" @click="generateReport">
              {{ generating ? 'Generating…' : report ? 'Regenerate' : 'Generate' }}
            </button>
          </div>
          <p v-if="reportError" class="danger-text">
            {{ reportError }}
            <template v-if="reportNeedsWriter">
              — <router-link to="/settings">bind a report_writer profile in Settings</router-link>
            </template>
          </p>
          <TaskProgress
            v-if="reportTaskId"
            :task-id="reportTaskId"
            @done="onReportDone"
            @failed="onReportFailed"
          />
          <p v-if="!report && !generating" class="hint">
            No report yet — Generate writes a grounded multi-section report from this run's
            metrics and posts.
          </p>

          <template v-if="report">
            <!-- direction verdict -->
            <div v-if="direction" class="verdict panel">
              <span class="micro-label">Direction</span>
              <span class="verdict-answer">{{ direction.answer }}</span>
              <span class="big-num verdict-confidence">
                {{ Math.round((direction.confidence ?? 0) * 100) }}%
              </span>
              <span class="micro-label">confidence</span>
            </div>

            <!-- per-section status chips -->
            <div class="section-chips">
              <span v-for="s in sections" :key="s.index" class="section-chip">
                <span class="muted">{{ s.title }}</span>
                <span class="micro-label" :class="sectionChip(s).warn ? 'warn-text' : 'success-text'">
                  {{ sectionChip(s).text }}
                </span>
              </span>
            </div>

            <!-- rendered markdown (md.js escapes all input HTML) -->
            <div class="panel report-body" v-html="reportHtml"></div>
          </template>

          <!-- ============ batch comparison ============ -->
          <template v-if="batchSiblings > 1">
            <hr class="rule" />
            <div class="micro-label">Batch comparison — {{ selectedRun?.batch_id }}</div>
            <p v-if="batchError" class="danger-text">{{ batchError }}</p>
            <div v-else-if="batch.length" class="panel table-panel">
              <table class="data-table">
                <thead>
                  <tr>
                    <th class="micro-label">Run</th>
                    <th class="micro-label num-col">Seed</th>
                    <th class="micro-label">Status</th>
                    <th class="micro-label num-col">Actions</th>
                    <th class="micro-label num-col">Final sentiment</th>
                    <th class="micro-label num-col">Agents engaged</th>
                    <th class="micro-label">Direction</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in batch"
                    :key="row.run_id"
                    :class="{ 'row-current': row.run_id === selectedRunId }"
                  >
                    <td>{{ row.run_id }}</td>
                    <td class="num-col muted">{{ row.seed }}</td>
                    <td>{{ row.status }}</td>
                    <td class="num-col">{{ row.total_actions }}</td>
                    <td class="num-col">{{ row.final_sentiment_score }}</td>
                    <td class="num-col">{{ row.agents_engaged }}</td>
                    <td>{{ row.direction }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </template>
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

.warn-text {
  color: var(--warn);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.picker-field {
  max-width: 360px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

/* --- cascade stat cells: big display numerics --- */
.stat-row {
  display: flex;
  gap: 28px;
  margin: 12px 0 18px;
  flex-wrap: wrap;
}

.stat-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-value {
  font-size: 26px;
  line-height: 1.2;
}

/* --- charts --- */
.charts {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.chart {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.spark {
  display: block;
  overflow: visible;
}

.zero-line {
  stroke: var(--border);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}

/* faction divergence legend + footnote */
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-muted);
}

.swatch {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  display: inline-block;
}

.chart-foot {
  color: var(--text-dim);
}

/* --- night/day regime layer --- */
.night-legend {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--text-muted);
  margin: 4px 0 14px;
}

.night-key {
  display: inline-block;
  width: 22px;
  height: 12px;
  background: var(--night-band, rgba(86, 182, 194, 0.12));
  border: 1px solid var(--border);
  border-radius: 2px;
}

.night-band {
  fill: rgba(86, 182, 194, 0.1); /* sky, very faint — a regime backdrop, not data */
}

/* --- self-explaining caption under each chart (persistent, not a tooltip) --- */
.chart-caption {
  color: var(--text-muted);
  line-height: 1.5;
  max-width: 560px;
  text-transform: none;
  letter-spacing: 0;
  font-size: 11px;
}

/* --- sentiment inflection pins --- */
.pin-low {
  fill: var(--danger);
}
.pin-high {
  fill: var(--success);
}
.pin-turn {
  fill: var(--text-dim);
}
.pin-label {
  font-size: 9px;
  text-transform: none;
  letter-spacing: 0;
}
text.pin-label.pin-low {
  fill: var(--danger);
}
text.pin-label.pin-high {
  fill: var(--success);
}

/* --- volume burst bar (off-scale) --- */
.burst-bar {
  opacity: 0.5;
}
.burst-label {
  fill: var(--text-dim);
  font-size: 9px;
  text-transform: none;
}

/* --- faction scoreboard --- */
.scoreboard {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 620px;
  margin: 4px 0 2px;
}

.sb-row {
  display: grid;
  grid-template-columns: 132px 1fr 48px auto;
  align-items: center;
  gap: 10px;
  font-size: 12px;
}

.sb-name {
  font-weight: 600;
  white-space: nowrap;
}

.sb-track {
  height: 12px;
  background: var(--surface-2);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.sb-fill {
  display: block;
  height: 100%;
  border-radius: var(--radius-full);
  opacity: 0.85;
}

.sb-score {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.sb-read {
  font-size: 11px;
  white-space: nowrap;
}

/* --- answer-first verdict panel + story beats --- */
.verdict-panel {
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin-bottom: 14px;
}

.verdict-answer {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text);
}

.verdict-dek {
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--text-muted);
}

.verdict-conf {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.conf-gauge {
  width: 140px;
  height: 8px;
  background: var(--surface-2);
  border-radius: var(--radius-full);
  overflow: hidden;
  flex: none;
}

.conf-fill {
  display: block;
  height: 100%;
  border-radius: var(--radius-full);
}

.conf-low .conf-fill {
  background: var(--warn);
}
.conf-moderate .conf-fill {
  background: var(--info);
}
.conf-high .conf-fill {
  background: var(--success);
}

.verdict-explain {
  font-size: 11px;
  color: var(--text-muted);
}

.evidence-head {
  margin-top: 4px;
}

.quote {
  font-size: 12px;
  line-height: 1.55;
  padding-left: 11px;
  border-left: 2px solid var(--border);
}

.quote-text {
  color: var(--text);
}

.quote-by {
  display: block;
  font-size: 11px;
  margin-top: 2px;
}

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

.beats-panel {
  margin-bottom: 14px;
}

.network-panel {
  display: flex;
  justify-content: center;
  padding: 14px 16px;
  overflow-x: auto;
}

.beats {
  margin: 6px 0 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.beat {
  font-size: 12px;
  line-height: 1.55;
  color: var(--text);
}

/* --- tables --- */
.table-panel {
  padding: 12px 16px;
}

.topic-head {
  margin-top: 18px;
}

.topic-panel {
  margin-top: 8px;
  max-width: 560px;
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
}

.data-table tbody tr {
  border-bottom: 1px dashed rgba(53, 90, 102, 0.25);
}

.num-col {
  text-align: right;
  width: 110px;
}

.row-current td:first-child {
  color: var(--accent);
}

/* --- report --- */
.verdict {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
}

.verdict-answer {
  font-size: 14px;
}

.verdict-confidence {
  font-size: 22px;
}

.section-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-bottom: 12px;
}

.section-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 3px 8px;
  font-size: 11px;
}

.report-body {
  line-height: 1.65;
}

.report-body :deep(h1) {
  font-size: 16px;
  margin: 4px 0 10px;
}

.report-body :deep(h2) {
  font-size: 14px;
  margin: 16px 0 8px;
  padding-top: 10px;
  border-top: 1px dashed rgba(53, 90, 102, 0.5);
}

.report-body :deep(h3) {
  font-size: 13px;
  margin: 12px 0 6px;
}

.report-body :deep(p) {
  margin: 6px 0;
}

.report-body :deep(ul) {
  margin: 6px 0 6px 20px;
}
</style>
