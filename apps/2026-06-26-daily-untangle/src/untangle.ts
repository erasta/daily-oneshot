import { Delaunay } from 'd3-delaunay'

export type Pt = { x: number; y: number }
export type Edge = [number, number]

/** Deterministic string hash → unsigned 32-bit int. */
function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Small seeded pseudo-random generator (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Signed area test: > 0 if c is left of a→b. */
function turn(a: Pt, b: Pt, c: Pt): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

/** True only when segments p1p2 and p3p4 properly cross (not at shared endpoints). */
function segmentsCross(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const d1 = turn(p3, p4, p1)
  const d2 = turn(p3, p4, p2)
  const d3 = turn(p1, p2, p3)
  const d4 = turn(p1, p2, p4)
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  )
}

/** Count edge crossings and flag which edges take part in at least one. */
export function analyze(
  positions: Pt[],
  edges: Edge[],
): { crossings: number; tangled: boolean[] } {
  const tangled = new Array<boolean>(edges.length).fill(false)
  let crossings = 0
  for (let i = 0; i < edges.length; i++) {
    const [a, b] = edges[i]
    for (let j = i + 1; j < edges.length; j++) {
      const [c, d] = edges[j]
      if (a === c || a === d || b === c || b === d) continue
      if (segmentsCross(positions[a], positions[b], positions[c], positions[d])) {
        crossings++
        tangled[i] = true
        tangled[j] = true
      }
    }
  }
  return { crossings, tangled }
}

/** Spread node positions onto a ring in a shuffled order — a reliably tangled start. */
export function scramble(n: number, edges: Edge[], rng: () => number): Pt[] {
  const make = (): Pt[] => {
    const order = Array.from({ length: n }, (_, i) => i)
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[order[i], order[j]] = [order[j], order[i]]
    }
    const out = new Array<Pt>(n)
    const radius = 0.42
    order.forEach((node, pos) => {
      const ang = (pos / n) * Math.PI * 2 - Math.PI / 2
      out[node] = {
        x: 0.5 + radius * Math.cos(ang),
        y: 0.5 + radius * Math.sin(ang),
      }
    })
    return out
  }
  // Avoid handing the player an already-solved board.
  let layout = make()
  for (let attempt = 0; attempt < 12 && analyze(layout, edges).crossings === 0; attempt++) {
    layout = make()
  }
  return layout
}

export type Puzzle = {
  n: number
  edges: Edge[]
  start: Pt[]
}

/** Build the day's planar graph (Delaunay = always untangle-able) from the date. */
export function buildPuzzle(date: string): Puzzle {
  const rng = mulberry32(hash(date))
  const n = 9 + Math.floor(rng() * 7) // 9..15 nodes

  // Best-candidate sampling for a pleasantly even spread.
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    let best: Pt = { x: 0.5, y: 0.5 }
    let bestDist = -1
    for (let t = 0; t < 14; t++) {
      const c = { x: 0.08 + rng() * 0.84, y: 0.08 + rng() * 0.84 }
      let d = pts.length === 0 ? 1 : Infinity
      for (const p of pts) {
        const dx = p.x - c.x
        const dy = p.y - c.y
        d = Math.min(d, dx * dx + dy * dy)
      }
      if (d > bestDist) {
        bestDist = d
        best = c
      }
    }
    pts.push(best)
  }

  const flat = new Float64Array(n * 2)
  pts.forEach((p, i) => {
    flat[i * 2] = p.x
    flat[i * 2 + 1] = p.y
  })
  const tris = new Delaunay(flat).triangles

  const seen = new Set<string>()
  const edges: Edge[] = []
  for (let i = 0; i < tris.length; i += 3) {
    const t = [tris[i], tris[i + 1], tris[i + 2]]
    for (const [u, v] of [
      [t[0], t[1]],
      [t[1], t[2]],
      [t[2], t[0]],
    ]) {
      const a = Math.min(u, v)
      const b = Math.max(u, v)
      const key = `${a}_${b}`
      if (!seen.has(key)) {
        seen.add(key)
        edges.push([a, b])
      }
    }
  }

  return { n, edges, start: scramble(n, edges, rng) }
}
