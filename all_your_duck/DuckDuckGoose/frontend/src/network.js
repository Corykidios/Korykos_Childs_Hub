/**
 * Pure layout for the reply network ("who talked to whom"). A deterministic
 * radial layout: nodes are placed on a ring, GROUPED by faction bucket so
 * same-side figures cluster, sized by engagement; edges resolve to node
 * positions. No force simulation, no randomness (so it never jitters between
 * renders) and no chart library. Mirrors the backend /network payload.
 */
import { normalizeFaction } from './storyfeed.js'

function round1(n) {
  return Math.round(n * 10) / 10
}

export function radialLayout(nodes, edges, opts = {}) {
  const arr = Array.isArray(nodes) ? nodes : []
  if (!arr.length) return { nodes: [], edges: [] }
  const { w = 520, h = 440, ringRatio = 0.42, minR = 3, maxR = 15 } = opts
  const cx = w / 2
  const cy = h / 2
  const ring = Math.min(w, h) * ringRatio

  // group same-faction nodes adjacently (cluster by side), then by engagement
  const ordered = arr
    .map((n) => ({ ...n, bucket: normalizeFaction(n.faction) }))
    .sort((a, b) =>
      a.bucket.localeCompare(b.bucket) || (b.engagement || 0) - (a.engagement || 0)
      || String(a.agent_uid).localeCompare(String(b.agent_uid)),
    )

  const maxEng = Math.max(...ordered.map((n) => n.engagement || 0), 1)
  const positioned = ordered.map((n, i) => {
    const ang = (i / ordered.length) * Math.PI * 2 - Math.PI / 2
    const radius = minR + Math.sqrt((n.engagement || 0) / maxEng) * (maxR - minR)
    return {
      ...n,
      x: round1(cx + Math.cos(ang) * ring),
      y: round1(cy + Math.sin(ang) * ring),
      radius: round1(radius),
    }
  })

  const pos = Object.fromEntries(positioned.map((n) => [n.agent_uid, n]))
  const layEdges = (Array.isArray(edges) ? edges : [])
    .map((e) => {
      const s = pos[e.source]
      const t = pos[e.target]
      if (!s || !t) return null
      return { ...e, x1: s.x, y1: s.y, x2: t.x, y2: t.y }
    })
    .filter(Boolean)

  return { nodes: positioned, edges: layEdges }
}
