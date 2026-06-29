// Deterministic level generation for the date-seeded block-rolling puzzle.
//
// The block is a 1x1x2 cuboid that rolls over its edges across a grid of
// floor tiles. Its state is a grid cell plus an orientation:
//   'up' — standing upright, occupies one cell, two units tall
//   'x'  — lying flat along the x axis, occupies two cells (x, x+1)
//   'z'  — lying flat along the z axis, occupies two cells (z, z+1)

export type Axis = 'up' | 'x' | 'z'
export type Dir = 'px' | 'nx' | 'pz' | 'nz'
export type BlockState = { x: number; z: number; axis: Axis }
export type Cell = { x: number; z: number }

export const DIRS: Dir[] = ['px', 'nx', 'pz', 'nz']

// Tiny deterministic pseudo-random generator (mulberry32) seeded from a string.
function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

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

// The grid cells a block currently sits on.
export function occupied(s: BlockState): Cell[] {
  if (s.axis === 'up') return [{ x: s.x, z: s.z }]
  if (s.axis === 'x') return [{ x: s.x, z: s.z }, { x: s.x + 1, z: s.z }]
  return [{ x: s.x, z: s.z }, { x: s.x, z: s.z + 1 }]
}

const keyOf = (c: Cell) => `${c.x},${c.z}`
const stateKey = (s: BlockState) => `${s.x},${s.z},${s.axis}`

// Roll the block one step in a direction, returning its new state.
export function roll(s: BlockState, dir: Dir): BlockState {
  const { x, z, axis } = s
  if (axis === 'up') {
    if (dir === 'px') return { x: x + 1, z, axis: 'x' }
    if (dir === 'nx') return { x: x - 2, z, axis: 'x' }
    if (dir === 'pz') return { x, z: z + 1, axis: 'z' }
    return { x, z: z - 2, axis: 'z' }
  }
  if (axis === 'x') {
    if (dir === 'px') return { x: x + 2, z, axis: 'up' }
    if (dir === 'nx') return { x: x - 1, z, axis: 'up' }
    if (dir === 'pz') return { x, z: z + 1, axis: 'x' }
    return { x, z: z - 1, axis: 'x' }
  }
  // axis === 'z'
  if (dir === 'pz') return { x, z: z + 2, axis: 'up' }
  if (dir === 'nz') return { x, z: z - 1, axis: 'up' }
  if (dir === 'px') return { x: x + 1, z, axis: 'z' }
  return { x: x - 1, z, axis: 'z' }
}

export type Level = {
  floor: Cell[]
  floorSet: Set<string>
  start: BlockState
  goal: Cell
  par: number
}

// Shortest solution length via breadth-first search over reachable states
// that never leave the floor.
function solveBfs(floorSet: Set<string>, start: BlockState, goal: Cell): number {
  const onFloor = (s: BlockState) => occupied(s).every((c) => floorSet.has(keyOf(c)))
  const isWin = (s: BlockState) => s.axis === 'up' && s.x === goal.x && s.z === goal.z
  const seen = new Set<string>([stateKey(start)])
  let frontier: BlockState[] = [start]
  let depth = 0
  while (frontier.length) {
    const next: BlockState[] = []
    for (const s of frontier) {
      if (isWin(s)) return depth
      for (const dir of DIRS) {
        const ns = roll(s, dir)
        if (!onFloor(ns)) continue
        const k = stateKey(ns)
        if (seen.has(k)) continue
        seen.add(k)
        next.push(ns)
      }
    }
    frontier = next
    depth++
  }
  return -1
}

// Build the day's level. The goal tile is where the block must end standing
// upright; the floor is carved out by a reverse random walk from that goal,
// which guarantees a solvable path exists. A handful of deterministic variants
// are tried so the day never lands on a trivially short puzzle.
export function buildLevel(dateSeed: string): Level {
  let best: Level | null = null
  for (let v = 0; v < 8; v++) {
    const lvl = buildVariant(dateSeed + '#v' + v)
    if (lvl.par >= 7) return lvl
    if (!best || lvl.par > best.par) best = lvl
  }
  return best as Level
}

function buildVariant(dateSeed: string): Level {
  const rng = mulberry32(hashString(dateSeed + '#roll'))
  const goal: Cell = { x: 0, z: 0 }
  const steps = 13 + Math.floor(rng() * 7) // 13..19 reverse moves

  let cur: BlockState = { x: 0, z: 0, axis: 'up' }
  const floorSet = new Set<string>()
  const addCells = (s: BlockState) => occupied(s).forEach((c) => floorSet.add(keyOf(c)))
  addCells(cur)

  let lastDir: Dir | null = null
  const opposite: Record<Dir, Dir> = { px: 'nx', nx: 'px', pz: 'nz', nz: 'pz' }

  for (let i = 0; i < steps; i++) {
    // Prefer not to immediately undo the previous move, so the island spreads.
    const choices = DIRS.filter((d) => d !== (lastDir ? opposite[lastDir] : null))
    const dir = choices[Math.floor(rng() * choices.length)]
    cur = roll(cur, dir)
    addCells(cur)
    lastDir = dir
  }

  const start = cur

  // Reassemble floor cell list and re-center so coordinates are tidy.
  const cells: Cell[] = [...floorSet].map((k) => {
    const [x, z] = k.split(',').map(Number)
    return { x, z }
  })

  const par = solveBfs(floorSet, start, goal)

  return { floor: cells, floorSet, start, goal, par }
}
