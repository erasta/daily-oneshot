// Deterministic daily maze generation.
//
// Everything here is a pure function of a numeric seed, so the same date
// always produces the same maze. No randomness, no backend.

// A single cell knows which of its four walls are still standing.
export type Cell = {
  top: boolean
  right: boolean
  bottom: boolean
  left: boolean
  visited: boolean
}

export type Maze = {
  width: number
  height: number
  cells: Cell[] // row-major: index = y * width + x
}

// A tiny seeded pseudo-random number generator (mulberry32). Given the same
// seed it always emits the same stream of numbers in [0, 1).
function makeRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Turn a YYYY-MM-DD string into a stable numeric seed.
export function seedFromDate(date: string): number {
  let h = 2166136261
  for (let i = 0; i < date.length; i++) {
    h ^= date.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// Format a Date as YYYY-MM-DD in the local timezone.
export function todayString(now: Date): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Carve a perfect maze (exactly one path between any two cells) using a
// randomized depth-first search driven by the seeded generator.
export function generateMaze(
  width: number,
  height: number,
  seed: number,
): Maze {
  const random = makeRandom(seed)
  const cells: Cell[] = Array.from({ length: width * height }, () => ({
    top: true,
    right: true,
    bottom: true,
    left: true,
    visited: false,
  }))

  const at = (x: number, y: number) => cells[y * width + x]
  const stack: Array<[number, number]> = [[0, 0]]
  at(0, 0).visited = true

  while (stack.length) {
    const [x, y] = stack[stack.length - 1]
    const neighbors: Array<[number, number, keyof Cell, keyof Cell]> = []
    if (y > 0 && !at(x, y - 1).visited)
      neighbors.push([x, y - 1, 'top', 'bottom'])
    if (x < width - 1 && !at(x + 1, y).visited)
      neighbors.push([x + 1, y, 'right', 'left'])
    if (y < height - 1 && !at(x, y + 1).visited)
      neighbors.push([x, y + 1, 'bottom', 'top'])
    if (x > 0 && !at(x - 1, y).visited)
      neighbors.push([x - 1, y, 'left', 'right'])

    if (!neighbors.length) {
      stack.pop()
      continue
    }

    const [nx, ny, wall, opposite] =
      neighbors[Math.floor(random() * neighbors.length)]
    at(x, y)[wall] = false
    at(nx, ny)[opposite] = false
    at(nx, ny).visited = true
    stack.push([nx, ny])
  }

  return { width, height, cells }
}

// Whether a move from (x, y) in a direction is allowed (no wall in the way).
export function canMove(
  maze: Maze,
  x: number,
  y: number,
  dir: 'up' | 'down' | 'left' | 'right',
): boolean {
  const cell = maze.cells[y * maze.width + x]
  if (dir === 'up') return !cell.top
  if (dir === 'down') return !cell.bottom
  if (dir === 'left') return !cell.left
  return !cell.right
}
