<script setup>
/*
 * "Who talked to whom" — a reply network. Nodes are agents (sized by
 * engagement, colored by faction bloc, protagonists ringed); edges are
 * commenter→post-author reply links (thicker = more replies). Deterministic
 * radial layout (network.js), hand-rolled SVG, hover to isolate a figure and
 * its conversations. Dumb: props in, SVG out.
 */
import { computed, ref } from 'vue'
import { factionColor } from '../factions.js'
import { radialLayout } from '../network.js'

const props = defineProps({
  data: { type: Object, default: null },
  width: { type: Number, default: 540 },
  height: { type: Number, default: 460 },
})

const layout = computed(() => radialLayout(props.data?.nodes, props.data?.edges, {
  w: props.width, h: props.height,
}))
const maxWeight = computed(() => Math.max(1, ...layout.value.edges.map((e) => e.weight || 1)))

// always-label the most engaged few; the rest label on hover
const topLabelled = computed(() => {
  const top = [...layout.value.nodes].sort((a, b) => (b.engagement || 0) - (a.engagement || 0))
  return new Set(top.slice(0, 8).map((n) => n.agent_uid))
})

const hovered = ref(null)
const neighbors = computed(() => {
  if (!hovered.value) return null
  const s = new Set([hovered.value])
  for (const e of layout.value.edges) {
    if (e.source === hovered.value) s.add(e.target)
    if (e.target === hovered.value) s.add(e.source)
  }
  return s
})
function nodeActive(uid) {
  return !neighbors.value || neighbors.value.has(uid)
}
function edgeActive(e) {
  return !hovered.value || e.source === hovered.value || e.target === hovered.value
}
function showLabel(n) {
  return topLabelled.value.has(n.agent_uid) || hovered.value === n.agent_uid
}
const hoveredNode = computed(
  () => layout.value.nodes.find((n) => n.agent_uid === hovered.value) || null,
)
</script>

<template>
  <div class="net-wrap">
    <svg :width="width" :height="height" class="net" @mouseleave="hovered = null">
      <g>
        <line v-for="(e, i) in layout.edges" :key="i" :x1="e.x1" :y1="e.y1" :x2="e.x2" :y2="e.y2"
          class="net-edge" :class="{ dim: !edgeActive(e), hot: edgeActive(e) && hovered }"
          :stroke-width="0.4 + (e.weight / maxWeight) * 2.6" />
      </g>
      <g>
        <g v-for="n in layout.nodes" :key="n.agent_uid"
          @mouseenter="hovered = n.agent_uid" class="node-g">
          <circle :cx="n.x" :cy="n.y" :r="n.radius" :fill="factionColor(n.faction)"
            class="net-node" :class="{ proto: n.protagonist, dim: !nodeActive(n.agent_uid) }" />
          <text v-if="showLabel(n)" :x="n.x" :y="n.y - n.radius - 3" text-anchor="middle"
            class="net-label" :class="{ dim: !nodeActive(n.agent_uid) }">{{ n.name }}</text>
        </g>
      </g>
    </svg>
    <p class="net-readout micro-label">
      <template v-if="hoveredNode">
        <strong>{{ hoveredNode.name }}</strong> · {{ hoveredNode.faction }} ·
        {{ hoveredNode.posts }} posts, {{ hoveredNode.comments }} replies ·
        engagement {{ hoveredNode.engagement }}
      </template>
      <template v-else>
        node size = engagement · color = faction bloc · ◯ ring = protagonist · line = a reply (thicker = more) · hover a figure
      </template>
    </p>
  </div>
</template>

<style scoped>
.net-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.net {
  display: block;
  overflow: visible;
  max-width: 100%;
}

.net-edge {
  stroke: var(--border-mid);
  opacity: 0.5;
  transition: opacity 120ms ease-out;
}
.net-edge.hot {
  stroke: var(--accent-dim);
  opacity: 0.9;
}
.net-edge.dim {
  opacity: 0.07;
}

.node-g {
  cursor: pointer;
}

.net-node {
  stroke: var(--bg);
  stroke-width: 1;
  transition: opacity 120ms ease-out;
}
.net-node.proto {
  stroke: var(--text);
  stroke-width: 1.5;
}
.net-node.dim {
  opacity: 0.18;
}

.net-label {
  font-size: 9px;
  fill: var(--text-muted);
  font-family: var(--font-mono);
  pointer-events: none;
}
.net-label.dim {
  opacity: 0.15;
}

.net-readout {
  color: var(--text-muted);
  min-height: 14px;
  text-transform: none;
  letter-spacing: 0;
}
.net-readout strong {
  color: var(--text);
}
</style>
