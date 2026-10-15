<script setup>
/*
 * Story Feed: watch a run unfold as a threaded social feed.
 *
 * The backend GET /runs/<id>/feed returns the whole feed render-ready (posts
 * with nested comments, each tagged with the round it was authored in + a
 * resolved author card). The feed is small, so it ships in one payload and the
 * "unfold round by round" experience is a CLIENT-side playback: a scrubber /
 * play button reveals everything authored at or before the current round.
 *
 * All non-trivial logic lives in ../storyfeed.js (pure, unit-tested); this view
 * fetches, polls live runs, and renders.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { api, errorMessage } from '../api.js'
import RoundInstrument from '../components/RoundInstrument.vue'
import { useProject } from '../composables/useProject.js'
import { renderMarkdown } from '../md.js'
import { isRunLive, resultsPickerOrder, runDisplayStatus } from '../runs.js'
import {
  feedThroughRound,
  normalizeFaction,
  roundActivity,
  sortPosts,
} from '../storyfeed.js'

const { projectId } = useProject()
const metrics = ref(null) // for the synced instrument strip (mood + lean)
const POLL_MS = 2000
const PLAY_MS = 1200 // round auto-advance cadence

/* ===== run picker ===== */
const runs = ref([])
const runsError = ref('')
const selectedRunId = ref('')
const pickerRuns = computed(() => resultsPickerOrder(runs.value))
const selectedRun = computed(
  () => runs.value.find((r) => r.run_id === selectedRunId.value) ?? null,
)

async function loadRuns() {
  const id = projectId.value
  if (!id) return
  try {
    const data = await api.get(`/api/projects/${id}/runs`)
    if (projectId.value !== id) return
    runs.value = data?.runs ?? []
    runsError.value = ''
    // auto-select the most artifact-complete run (finished first)
    if (!selectedRunId.value && pickerRuns.value.length) {
      await selectRun(pickerRuns.value[0].run_id)
    }
  } catch (err) {
    if (projectId.value !== id) return
    runsError.value = errorMessage(err)
  }
}

/* ===== feed + playback ===== */
const feed = ref(null)
const feedError = ref('')
const feedLoading = ref(false)
const currentRound = ref(0)
const playing = ref(false)
const sortMode = ref('active') // active | latest | top
const followLive = ref(true) // live runs: keep the scrubber pinned to newest
const pollTick = ref(0)

// clamp to >= 0: a fresh/queued run with no round events yet reports
// max_round = -1, which must not leak into the slider (min>max) or read-out.
const maxRound = computed(() => {
  const m = feed.value?.max_round
  return Number.isInteger(m) && m > 0 ? m : 0
})
const activity = computed(() => roundActivity(feed.value))
const peakActivity = computed(() =>
  activity.value.reduce((m, r) => Math.max(m, r.posts + r.comments), 0),
)
const visiblePosts = computed(() =>
  sortPosts(feedThroughRound(feed.value, currentRound.value), sortMode.value),
)
const shownPosts = computed(() => visiblePosts.value.length)
const shownComments = computed(() =>
  visiblePosts.value.reduce((n, p) => n + p.comments.length, 0),
)
const totalPosts = computed(() =>
  Array.isArray(feed.value?.posts) ? feed.value.posts.length : 0,
)
// "Live" = still producing content (queued or mid-rounds). A wait-mode run
// ("interviewable") is done and must not be polled/refetched — that fought
// playback. The predicate is isRunLive() in runs.js (unit-tested) so the
// wait-mode exclusion can't silently regress.
const isLive = computed(() => isRunLive(selectedRun.value))

async function loadFeed(initial = false) {
  const id = projectId.value
  const runId = selectedRunId.value
  if (!id || !runId) return
  feedLoading.value = true
  try {
    const data = await api.get(`/api/projects/${id}/runs/${runId}/feed`)
    if (projectId.value !== id || selectedRunId.value !== runId) return
    feed.value = data
    feedError.value = ''
    if (initial || (followLive.value && !playing.value)) {
      // initial load / live-follow: reveal the whole story up to newest
      currentRound.value = maxRound.value
    } else {
      // a background refresh must not clobber an in-progress playback or a
      // manual scrub — only clamp to the (possibly grown) round range
      currentRound.value = Math.min(currentRound.value, maxRound.value)
    }
  } catch (err) {
    if (projectId.value !== id || selectedRunId.value !== runId) return
    feed.value = null
    feedError.value = errorMessage(err)
  } finally {
    if (projectId.value === id && selectedRunId.value === runId) {
      feedLoading.value = false
    }
  }
}

async function selectRun(runId) {
  if (selectedRunId.value === runId) return
  pause()
  selectedRunId.value = runId
  feed.value = null
  feedError.value = ''
  currentRound.value = 0
  followLive.value = true
  loadMetrics(runId)
  await loadFeed(true)
  schedulePoll()
}

async function loadMetrics(runId) {
  const id = projectId.value
  metrics.value = null
  try {
    const data = await api.get(`/api/projects/${id}/runs/${runId}/metrics`)
    if (projectId.value !== id || selectedRunId.value !== runId) return
    metrics.value = data
  } catch {
    if (projectId.value === id && selectedRunId.value === runId) metrics.value = null
  }
}

function onPickRun(event) {
  const runId = event.target.value
  if (runId) selectRun(runId)
}

/* ===== round playback (rewind + auto-advance) ===== */
let playTimer = null

function clearPlay() {
  if (playTimer !== null) clearTimeout(playTimer)
  playTimer = null
}

function pause() {
  playing.value = false
  clearPlay()
}

function play() {
  if (maxRound.value <= 0) return
  followLive.value = false
  if (currentRound.value >= maxRound.value) currentRound.value = 0 // rewind
  playing.value = true
  scheduleAdvance()
}

function togglePlay() {
  playing.value ? pause() : play()
}

function scheduleAdvance() {
  clearPlay()
  playTimer = setTimeout(() => {
    playTimer = null
    if (!playing.value) return
    if (currentRound.value >= maxRound.value) {
      pause()
      return
    }
    currentRound.value += 1
    scheduleAdvance()
  }, PLAY_MS)
}

function scrubTo(round) {
  pause()
  followLive.value = false
  currentRound.value = Math.max(0, Math.min(round, maxRound.value))
}

function onScrub(event) {
  scrubTo(Number(event.target.value))
}

function setSort(mode) {
  sortMode.value = mode
}

function toggleFollow() {
  followLive.value = !followLive.value
  if (followLive.value) {
    pause()
    currentRound.value = maxRound.value
  }
}

/* ===== 2s poll — only while the selected run is live ===== */
let pollTimer = null
const pollNeeded = computed(() => isLive.value)

function schedulePoll() {
  if (pollTimer !== null) return
  if (!pollNeeded.value) return
  pollTimer = setTimeout(pollOnce, POLL_MS)
}

async function pollOnce() {
  pollTimer = null
  const id = projectId.value
  if (!id) return
  // capture liveness BEFORE the status refresh so the final round (written just
  // before the run flips to wait-mode/finished) still triggers one last fetch.
  const wasLive = isLive.value
  await loadRuns()
  if (projectId.value !== id) return
  if (selectedRunId.value && (isLive.value || wasLive)) {
    try {
      await loadFeed(false) // preserves playback/scrub position; follows live
      loadMetrics(selectedRunId.value) // keep the instrument current on a live run
      pollTick.value += 1
    } catch (err) {
      feedError.value = errorMessage(err)
    }
  }
  schedulePoll()
}

watch(pollNeeded, () => schedulePoll())

onBeforeUnmount(() => {
  clearPlay()
  if (pollTimer !== null) clearTimeout(pollTimer)
  pollTimer = null
})

/* ===== project switch reset ===== */
watch(
  projectId,
  () => {
    pause()
    runs.value = []
    runsError.value = ''
    selectedRunId.value = ''
    feed.value = null
    feedError.value = ''
    metrics.value = null
    currentRound.value = 0
    followLive.value = true
    const id = projectId.value
    if (!id) return
    loadRuns().then(() => schedulePoll())
  },
  { immediate: true },
)

/* ===== render helpers ===== */
function md(text) {
  return renderMarkdown(text)
}
function facKey(faction) {
  return normalizeFaction(faction)
}
function authorTitle(author) {
  const bits = [author.profession, author.country].filter(Boolean)
  return bits.join(' · ') || author.username || ''
}
function barHeight(row) {
  const peak = peakActivity.value
  if (!peak) return 2
  return 2 + Math.round((26 * (row.posts + row.comments)) / peak)
}
</script>

<template>
  <section class="view">
    <div class="micro-label">Story Feed</div>
    <hr class="rule" />

    <p v-if="!projectId" class="hint">Select a project from the top bar first.</p>

    <template v-else>
      <!-- run picker -->
      <div class="picker-row">
        <label class="micro-label" for="story-run">Run</label>
        <select id="story-run" :value="selectedRunId" @change="onPickRun">
          <option value="" disabled>— select a run —</option>
          <option v-for="r in pickerRuns" :key="r.run_id" :value="r.run_id">
            {{ r.run_id }} · {{ runDisplayStatus(r) }}
          </option>
        </select>
        <span v-if="selectedRun" class="state" :class="`state-${runDisplayStatus(selectedRun)}`">
          <span class="status-dot"></span>
          <span class="micro-label">{{ runDisplayStatus(selectedRun) }}</span>
        </span>
      </div>

      <p v-if="runsError" class="danger-text">{{ runsError }}</p>
      <p v-else-if="!pickerRuns.length" class="hint">
        No runs yet — launch one from the Run stage, then come back to watch it.
      </p>

      <template v-else-if="selectedRunId">
        <!-- playback controls -->
        <div class="panel control-panel">
          <div class="control-row">
            <button class="btn btn-primary play-btn" type="button" @click="togglePlay"
              :disabled="maxRound <= 0">
              {{ playing ? '❚❚ Pause' : '▶ Play' }}
            </button>
            <div class="scrub">
              <input type="range" min="0" :max="maxRound" :value="currentRound"
                @input="onScrub" aria-label="Round" />
              <span class="round-read">
                Round <strong>{{ currentRound }}</strong> / {{ maxRound }}
              </span>
            </div>
            <div class="sort-toggle" role="group" aria-label="Sort posts">
              <button v-for="m in ['active', 'latest', 'top']" :key="m" type="button"
                class="seg" :class="{ 'seg-on': sortMode === m }" @click="setSort(m)">
                {{ m }}
              </button>
            </div>
          </div>

          <!-- clickable activity timeline: where the conversation lives. The
               labeled range slider already covers keyboard scrubbing, so these
               decorative bars are mouse-only (tabindex -1) under aria-hidden. -->
          <div class="timeline" aria-hidden="true">
            <button v-for="row in activity" :key="row.round" type="button" class="tl-bar"
              tabindex="-1"
              :class="{ 'tl-past': row.round <= currentRound, 'tl-now': row.round === currentRound }"
              :style="{ height: barHeight(row) + 'px' }" @click="scrubTo(row.round)"
              :title="`round ${row.round}: ${row.posts} posts, ${row.comments} replies`"></button>
          </div>

          <div class="control-meta">
            <span class="muted">
              showing {{ shownPosts }}/{{ totalPosts }} posts · {{ shownComments }} replies
            </span>
            <label v-if="isLive" class="follow-live">
              <input type="checkbox" :checked="followLive" @change="toggleFollow" />
              <span class="micro-label">follow live</span>
            </label>
          </div>
        </div>

        <!-- synced instrument: mood + discourse-lean move with the scrubber -->
        <div v-if="metrics" class="panel instrument-panel">
          <RoundInstrument :metrics="metrics" :current-round="currentRound" :max-round="maxRound" />
        </div>

        <!-- the feed -->
        <div class="panel feed-panel">
          <div :key="pollTick" class="poll-tick" aria-hidden="true"></div>
          <p v-if="feedError" class="danger-text feed-pad">{{ feedError }}</p>
          <p v-else-if="feedLoading && !feed" class="hint feed-pad">Loading feed…</p>
          <p v-else-if="!visiblePosts.length" class="hint feed-pad">
            Nothing posted by round {{ currentRound }} yet.
          </p>
          <div v-else class="feed">
            <article v-for="post in visiblePosts" :key="`${post.platform}-${post.post_id}`"
              class="post" :class="{ fresh: post.round === currentRound }">
              <header class="node-head">
                <span class="author" :class="`tier-${post.author.tier}`"
                  :title="authorTitle(post.author)">
                  <span v-if="post.author.protagonist" class="proto" title="protagonist">★</span>
                  {{ post.author.name || post.author.username }}
                  <span class="handle">@{{ post.author.username }}</span>
                </span>
                <span v-if="post.author.faction" class="fac" :class="`fac-${facKey(post.author.faction)}`"
                  :title="`faction: ${post.author.faction}`">{{ post.author.faction }}</span>
                <span v-if="post.kind === 'repost'" class="recast" title="repost">↻ reposted</span>
                <span v-else-if="post.kind === 'quote'" class="recast" title="quote post">❝ quoting</span>
                <span class="round-pill">r{{ post.round }}</span>
                <span class="spacer"></span>
                <span class="score" :title="`${post.num_likes} likes · ${post.num_dislikes} dislikes`">
                  ↑{{ post.num_likes }} ↓{{ post.num_dislikes }}
                </span>
              </header>
              <!-- eslint-disable-next-line vue/no-v-html — renderMarkdown HTML-escapes raw LLM text first -->
              <div v-if="post.content" class="body" v-html="md(post.content)"></div>
              <!-- eslint-disable-next-line vue/no-v-html — escaped by renderMarkdown -->
              <blockquote v-if="post.quoted_content" class="quoted" v-html="md(post.quoted_content)"></blockquote>

              <div v-if="post.comments.length" class="replies">
                <div v-for="c in post.comments" :key="`${c.platform}-${c.comment_id}`" class="reply"
                  :class="{ fresh: c.round === currentRound }">
                  <header class="node-head">
                    <span class="author" :class="`tier-${c.author.tier}`"
                      :title="authorTitle(c.author)">
                      <span v-if="c.author.protagonist" class="proto" title="protagonist">★</span>
                      {{ c.author.name || c.author.username }}
                      <span class="handle">@{{ c.author.username }}</span>
                    </span>
                    <span v-if="c.author.faction" class="fac" :class="`fac-${facKey(c.author.faction)}`"
                      :title="`faction: ${c.author.faction}`">{{ c.author.faction }}</span>
                    <span class="round-pill">r{{ c.round }}</span>
                    <span class="spacer"></span>
                    <span class="score">↑{{ c.num_likes }} ↓{{ c.num_dislikes }}</span>
                  </header>
                  <!-- eslint-disable-next-line vue/no-v-html — escaped by renderMarkdown -->
                  <div class="body" v-html="md(c.content)"></div>
                </div>
              </div>
            </article>
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

.danger-text {
  color: var(--danger);
}

/* --- run picker --- */
.picker-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.picker-row select {
  min-width: 320px;
  height: 32px;
}

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

.state-running .status-dot {
  animation: run-pulse 1.6s ease-in-out infinite;
}

.state-interviewable {
  color: var(--info);
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

/* --- playback control panel --- */
.control-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px;
  margin-bottom: 14px;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.play-btn {
  min-width: 96px;
}

.scrub {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 240px;
}

.scrub input[type='range'] {
  flex: 1;
  accent-color: var(--accent);
  cursor: pointer;
}

.round-read {
  color: var(--text-muted);
  font-size: 12px;
  white-space: nowrap;
}

.round-read strong {
  color: var(--text);
}

/* segmented sort toggle */
.sort-toggle {
  display: inline-flex;
  border: 1px solid var(--border-mid);
  border-radius: var(--radius);
  overflow: hidden;
}

.seg {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 5px 11px;
  cursor: pointer;
  transition: color 150ms ease-out, background 150ms ease-out;
}

.seg:hover {
  color: var(--text);
}

.seg-on {
  background: var(--accent-bg);
  color: var(--accent);
}

.seg + .seg {
  border-left: 1px solid var(--border);
}

/* activity timeline — a clickable per-round histogram */
.timeline {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 30px;
  padding-top: 2px;
}

.tl-bar {
  flex: 1;
  min-width: 3px;
  background: var(--border-mid);
  border: none;
  padding: 0;
  border-radius: 1px;
  cursor: pointer;
  transition: background 150ms ease-out;
}

.tl-bar:hover {
  background: var(--text-muted);
}

.tl-past {
  background: var(--info);
}

.tl-now {
  background: var(--accent);
}

.control-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}

.follow-live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.follow-live input {
  accent-color: var(--accent);
  width: 13px;
  height: 13px;
}

.instrument-panel {
  margin-bottom: 14px;
  padding: 0;
}

/* --- feed --- */
.feed-panel {
  padding: 0;
  overflow: hidden;
}

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

.feed-pad {
  padding: 16px;
}

.feed {
  max-height: 70vh;
  overflow-y: auto;
  padding: 6px 0;
}

.post {
  padding: 12px 16px;
  border-bottom: 1px dashed rgba(53, 90, 102, 0.25);
}

.node-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  flex-wrap: wrap;
}

.author {
  font-weight: 600;
}

.author .handle {
  font-weight: 400;
  color: var(--text-dim);
  margin-left: 5px;
}

.proto {
  color: var(--accent);
  margin-right: 2px;
}

/* tier colors match the Universe agent browser / RunView monitor */
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

/* faction badge — DATA palette (One Dark hues), never the coral chrome accent */
.fac {
  font-size: 10px;
  padding: 1px 7px;
  border-radius: var(--radius-full);
  border: 1px solid currentColor;
  white-space: nowrap;
  opacity: 0.92;
}
.fac-pro-reopening {
  color: #98c379;
}
.fac-hardline-closure {
  color: #fb7185;
}
.fac-pro-us {
  color: #61afef;
}
.fac-anti-west {
  color: #c678dd;
}
.fac-anti-iran {
  color: #e5c07b;
}
.fac-neutral {
  color: var(--text-muted);
}
.fac-mixed {
  color: #abb2bf;
}
.fac-other,
.fac-unaligned {
  color: var(--text-dim);
}

.round-pill {
  font-size: 10px;
  color: var(--text-dim);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  padding: 1px 7px;
}

.spacer {
  flex: 1;
}

.score {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}

.recast {
  font-size: 10px;
  color: var(--text-muted);
}

.body {
  margin-top: 6px;
  color: var(--text);
  font-size: 12.5px;
  line-height: 1.6;
  word-break: break-word;
}

/* the quoted/reposted original — visually subordinate to the agent's own words */
.quoted {
  margin: 6px 0 0;
  padding: 4px 0 4px 10px;
  border-left: 2px solid var(--border-mid);
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.55;
  word-break: break-word;
}

.body :deep(p) {
  margin: 0 0 6px;
}

.body :deep(p:last-child) {
  margin-bottom: 0;
}

.body :deep(h1),
.body :deep(h2),
.body :deep(h3) {
  font-size: 13px;
  margin: 6px 0 4px;
  color: var(--text);
}

/* replies — one level deep (OASIS reddit threading is flat post->comment) */
.replies {
  margin-top: 10px;
  margin-left: 14px;
  border-left: 2px solid var(--border);
  padding-left: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.reply .body {
  font-size: 12px;
}

/* the just-revealed round glows briefly as playback advances */
.fresh {
  animation: fresh-in 900ms ease-out;
}

.post.fresh {
  box-shadow: inset 3px 0 0 var(--accent-dim);
}

.reply.fresh {
  box-shadow: inset 3px 0 0 var(--accent-dim);
  padding-left: 6px;
  margin-left: -6px;
}

@keyframes fresh-in {
  0% {
    background: var(--accent-bg);
  }
  100% {
    background: transparent;
  }
}
</style>
