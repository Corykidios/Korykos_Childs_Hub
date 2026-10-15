<script setup>
/*
 * A compact "instrument strip" for the Story feed: a mini net-mood line and a
 * discourse-lean line, both with night/day bands and a shared vertical playhead
 * bound to the feed's current round. As you scrub or play the feed, the playhead
 * moves and the readouts state the round's mood + lean in plain words — the
 * abstract charts and the concrete posts move together (operator pref #1: show
 * the path; pref #2: the numbers explain themselves). Dumb: props in, SVG out.
 */
import { computed } from 'vue'
import { nightRounds } from '../insights.js'
import { verdictLeanSeries } from '../factions.js'
import {
  bandRects,
  gappedPolylines,
  playheadX,
  segmentPoints,
  signSegments,
} from '../sparkline.js'

const props = defineProps({
  metrics: { type: Object, default: null },
  currentRound: { type: Number, default: 0 },
  maxRound: { type: Number, default: 0 },
})

const W = 480
const H = 34

const rounds = computed(
  () => props.metrics?.rounds_observed || props.metrics?.per_round?.length || 0,
)
const bands = computed(() => bandRects(nightRounds(props.metrics), rounds.value, W, H))
const playX = computed(() => playheadX(props.currentRound, rounds.value, W))

const sentScores = computed(() =>
  (props.metrics?.sentiment_trend ?? []).map((p) => Number(p?.score) || 0),
)
const sentSegs = computed(() =>
  signSegments(sentScores.value).map((seg) => ({
    sign: seg.sign,
    points: segmentPoints(seg, sentScores.value.length, W, H, { min: -1, max: 1 }),
  })),
)
const lean = computed(() => verdictLeanSeries(props.metrics))
const leanLines = computed(() =>
  gappedPolylines(lean.value.map((p) => p.lean), W, H, { min: -1, max: 1 }),
)

function at(series, key) {
  const p = series.find((x) => x.round === props.currentRound)
  return p && Number.isFinite(p[key]) ? p[key] : null
}
const moodNow = computed(() => at(props.metrics?.sentiment_trend ?? [], 'score'))
const leanNow = computed(() => at(lean.value, 'lean'))

function fmt(n) {
  const r = Math.round(n * 100) / 100
  return (r >= 0 ? '+' : '') + r.toFixed(2)
}
const moodReadout = computed(() => {
  if (moodNow.value === null) return '—'
  const t = moodNow.value > 0.05 ? 'positive' : moodNow.value < -0.05 ? 'negative' : 'flat'
  return `${fmt(moodNow.value)} · ${t}`
})
const moodClass = computed(() =>
  moodNow.value === null ? 'muted' : moodNow.value >= 0 ? 'success-text' : 'danger-text',
)
const leanReadout = computed(() => {
  if (leanNow.value === null) return 'no stance posts this round'
  const v = leanNow.value
  const side = v > 0.1 ? 'reopening-leaning' : v < -0.1 ? 'closure-leaning' : 'evenly split'
  return `${side} (${fmt(v)})`
})

const hasData = computed(() => sentScores.value.length > 0 || lean.value.length > 0)
</script>

<template>
  <div v-if="hasData" class="instrument">
    <div class="inst-row">
      <span class="inst-label">net mood</span>
      <svg :width="W" :height="H" class="inst-svg">
        <rect v-for="b in bands" :key="`mb${b.x}`" :x="b.x" :y="b.y" :width="b.width"
          :height="b.height" class="inst-band" />
        <line x1="0" :y1="H / 2" :x2="W" :y2="H / 2" class="inst-zero" />
        <polyline v-for="(seg, i) in sentSegs" :key="i" :points="seg.points" fill="none"
          :stroke="seg.sign >= 0 ? 'var(--success)' : 'var(--danger)'" stroke-width="1.25" />
        <line :x1="playX" y1="0" :x2="playX" :y2="H" class="inst-playhead" />
      </svg>
      <span class="inst-readout" :class="moodClass">{{ moodReadout }}</span>
    </div>

    <div class="inst-row">
      <span class="inst-label">discourse lean</span>
      <svg :width="W" :height="H" class="inst-svg">
        <rect v-for="b in bands" :key="`lb${b.x}`" :x="b.x" :y="b.y" :width="b.width"
          :height="b.height" class="inst-band" />
        <line x1="0" :y1="H / 2" :x2="W" :y2="H / 2" class="inst-zero" />
        <polyline v-for="(pts, i) in leanLines" :key="i" :points="pts" fill="none"
          stroke="var(--info)" stroke-width="1.25" />
        <line :x1="playX" y1="0" :x2="playX" :y2="H" class="inst-playhead" />
      </svg>
      <span class="inst-readout muted">{{ leanReadout }}</span>
    </div>
    <p class="inst-foot micro-label">
      ▲ reopening-stance share · ▼ closure-stance · shaded = night (elites only) · line = current round
    </p>
  </div>
</template>

<style scoped>
.instrument {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 14px;
}

.inst-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.inst-label {
  width: 92px;
  flex: none;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
  text-align: right;
}

.inst-svg {
  display: block;
  overflow: visible;
  flex: none;
}

.inst-band {
  fill: rgba(86, 182, 194, 0.1);
}

.inst-zero {
  stroke: var(--border);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}

.inst-playhead {
  stroke: var(--accent);
  stroke-width: 1;
}

.inst-readout {
  font-size: 11px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.muted {
  color: var(--text-muted);
}
.success-text {
  color: var(--success);
}
.danger-text {
  color: var(--danger);
}

.inst-foot {
  color: var(--text-dim);
  margin: 2px 0 0 104px;
}
</style>
