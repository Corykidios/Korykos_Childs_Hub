import { describe, it, expect } from 'vitest'
import { radialLayout } from '../network.js'

// mirrors the backend /network payload
const NET = {
  nodes: [
    { agent_uid: 'a', name: 'Ada', faction: 'pro-reopening', tier: 'protagonist', engagement: 40, protagonist: true },
    { agent_uid: 'b', name: 'Ben', faction: 'hardline-closure', tier: 'protagonist', engagement: 10, protagonist: true },
    { agent_uid: 'c', name: 'Cy', faction: 'neutral', tier: 'crowd_llm', engagement: 4, protagonist: false },
  ],
  edges: [
    { source: 'b', target: 'a', weight: 3 },
    { source: 'c', target: 'a', weight: 1 },
    { source: 'b', target: 'zz', weight: 9 }, // dangling target -> dropped
  ],
}

describe('radialLayout', () => {
  it('places every node on the ring with a size scaled to engagement', () => {
    const { nodes } = radialLayout(NET.nodes, NET.edges, { w: 400, h: 400 })
    expect(nodes).toHaveLength(3)
    for (const n of nodes) {
      expect(Number.isFinite(n.x) && Number.isFinite(n.y)).toBe(true)
      expect(n.radius).toBeGreaterThan(0)
      expect(typeof n.bucket).toBe('string') // normalized faction key for coloring
    }
    // higher engagement -> larger node
    const a = nodes.find((n) => n.agent_uid === 'a')
    const c = nodes.find((n) => n.agent_uid === 'c')
    expect(a.radius).toBeGreaterThan(c.radius)
  })

  it('resolves edge endpoints to node positions and drops dangling edges', () => {
    const { nodes, edges } = radialLayout(NET.nodes, NET.edges, { w: 400, h: 400 })
    expect(edges).toHaveLength(2) // the b->zz dangling edge is dropped
    const a = nodes.find((n) => n.agent_uid === 'a')
    const ba = edges.find((e) => e.source === 'b' && e.target === 'a')
    expect(ba.x2).toBe(a.x)
    expect(ba.y2).toBe(a.y)
  })

  it('is deterministic (same input -> identical positions)', () => {
    const r1 = radialLayout(NET.nodes, NET.edges, { w: 400, h: 400 })
    const r2 = radialLayout(NET.nodes, NET.edges, { w: 400, h: 400 })
    expect(r1).toEqual(r2)
  })

  it('tolerates empty / junk input', () => {
    expect(radialLayout(null, null)).toEqual({ nodes: [], edges: [] })
    expect(radialLayout([], [])).toEqual({ nodes: [], edges: [] })
  })
})
