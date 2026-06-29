// Daily Pipes — board generation and solving logic.
//
// Each cell holds a set of pipe openings encoded as a 4-bit mask:
//   North = 1, East = 2, South = 4, West = 8
// `sol` is the opening mask in its solved orientation; `rot` is how many
// quarter-turns clockwise the player has currently applied. The mask actually
// shown is `sol` rotated by `rot`.

export const N = 1
export const E = 2
export const S = 4
export const W = 8

export type Cell = {
  sol: number // opening mask when correctly oriented
  rot: number // quarter-turns clockwise currently applied (0..3)
}

export type Board = {
  cols: number
  rows: number
  source: number // index of the powered source cell
  cells: Cell[]
}

// Rotate an opening mask 90° clockwise: N->E->S->W->N.
export function rotateCW(mask: number): number {
  return ((mask << 1) | (mask >> 3)) & 0xf
}

export function rotateMask(mask: number, quarters: number): number {
  let m = mask
  for (let i = 0; i < (((quarters % 4) + 4) % 4); i++) m = rotateCW(m)
  return m
}

// The opening mask currently shown for a cell.
export function shownMask(cell: Cell): number {
  return rotateMask(cell.sol, cell.rot)
}

const DIRS = [N, E, S, W]
const opposite = (d: number): number => (d === N ? S : d === S ? N : d === E ? W : E)

function neighbor(index: number, dir: number, cols: number, rows: number): number {
  const x = index % cols
  const y = Math.floor(index / cols)
  let nx = x
  let ny = y
  if (dir === N) ny -= 1
  else if (dir === S) ny += 1
  else if (dir === E) nx += 1
  else nx -= 1
  if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) return -1
  return ny * cols + nx
}

// Small deterministic pseudo-random generator seeded from the date string.
function makeRng(seedStr: string): () => number {
  let h = 1779033703 ^ seedStr.length
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Build a fully-connected network as a random spanning tree, then scramble the
// orientation of every tile so the player has to rotate them back.
export function generateBoard(date: string, cols: number, rows: number): Board {
  const rng = makeRng(`daily-pipes:${date}`)
  const n = cols * rows
  const sol = new Array<number>(n).fill(0)
  const visited = new Array<boolean>(n).fill(false)

  const source = Math.floor(rows / 2) * cols + Math.floor(cols / 2)
  // Randomized depth-first carve of a spanning tree.
  const stack = [source]
  visited[source] = true
  while (stack.length) {
    const cur = stack[stack.length - 1]
    const options: { dir: number; idx: number }[] = []
    for (const d of DIRS) {
      const nb = neighbor(cur, d, cols, rows)
      if (nb !== -1 && !visited[nb]) options.push({ dir: d, idx: nb })
    }
    if (options.length === 0) {
      stack.pop()
      continue
    }
    const pick = options[Math.floor(rng() * options.length)]
    sol[cur] |= pick.dir
    sol[pick.idx] |= opposite(pick.dir)
    visited[pick.idx] = true
    stack.push(pick.idx)
  }

  const cells: Cell[] = sol.map((m) => {
    let rot = Math.floor(rng() * 4)
    // Avoid handing the player an already-correct tile when possible.
    if (rotateMask(m, rot) === m && m !== 0xf) rot = (rot + 1 + Math.floor(rng() * 3)) % 4
    return { sol: m, rot }
  })

  return { cols, rows, source, cells }
}

// Cells reachable from the source through pipes that mutually open into each
// other — used to "light up" the live part of the network.
export function poweredCells(board: Board): boolean[] {
  const { cols, rows, source, cells } = board
  const powered = new Array<boolean>(cells.length).fill(false)
  const queue = [source]
  powered[source] = true
  while (queue.length) {
    const cur = queue.shift() as number
    const mask = shownMask(cells[cur])
    for (const d of DIRS) {
      if (!(mask & d)) continue
      const nb = neighbor(cur, d, cols, rows)
      if (nb === -1 || powered[nb]) continue
      if (shownMask(cells[nb]) & opposite(d)) {
        powered[nb] = true
        queue.push(nb)
      }
    }
  }
  return powered
}

// Solved when there are no dangling pipe ends (every opening connects to a
// matching opening on an in-bounds neighbour) AND the whole grid is powered
// from the source. The power check rejects otherwise-valid arrangements that
// form a closed loop disconnected from the source.
export function isSolved(board: Board): boolean {
  const { cols, rows, cells } = board
  for (let i = 0; i < cells.length; i++) {
    const mask = shownMask(cells[i])
    for (const d of DIRS) {
      if (!(mask & d)) continue
      const nb = neighbor(i, d, cols, rows)
      if (nb === -1) return false
      if (!(shownMask(cells[nb]) & opposite(d))) return false
    }
  }
  return poweredCells(board).every(Boolean)
}
