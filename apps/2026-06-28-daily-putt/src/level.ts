import { makeRng, rand, randInt, type Rng } from './seed'

// The playfield is a fixed portrait rectangle in "world units". The canvas is
// scaled to fit the screen, so gameplay is identical on every device.
export const WORLD = { w: 300, h: 440 }
export const BALL_R = 8
export const HOLE_R = 13
export const WALL_T = 14 // border thickness

export type Rect = { x: number; y: number; w: number; h: number }
export type Circle = { x: number; y: number; r: number }

export type Level = {
  date: string
  par: number
  ball: { x: number; y: number }
  hole: { x: number; y: number }
  walls: Rect[] // interior obstacle blocks (border walls added separately)
  sand: Circle[]
}

const rectsOverlap = (a: Rect, b: Rect, pad: number) =>
  a.x - a.w / 2 - pad < b.x + b.w / 2 &&
  a.x + a.w / 2 + pad > b.x - b.w / 2 &&
  a.y - a.h / 2 - pad < b.y + b.h / 2 &&
  a.y + a.h / 2 + pad > b.y - b.h / 2

const pointInRect = (px: number, py: number, r: Rect, pad: number) =>
  Math.abs(px - r.x) < r.w / 2 + pad && Math.abs(py - r.y) < r.h / 2 + pad

export function generateLevel(date: string): Level {
  const rng: Rng = makeRng(date + '-putt')
  const inset = WALL_T + BALL_R + 4

  // Ball starts in the bottom area, hole sits in the top area.
  const ball = {
    x: rand(rng, inset + 30, WORLD.w - inset - 30),
    y: rand(rng, WORLD.h - 90, WORLD.h - inset - 20),
  }
  const hole = {
    x: rand(rng, inset + 30, WORLD.w - inset - 30),
    y: rand(rng, inset + 30, 130),
  }

  // Obstacle blocks across the middle band.
  const walls: Rect[] = []
  const target = randInt(rng, 2, 4)
  let guard = 0
  while (walls.length < target && guard++ < 200) {
    const horizontal = rng() > 0.5
    const w = horizontal ? rand(rng, 70, 150) : rand(rng, 14, 20)
    const h = horizontal ? rand(rng, 14, 20) : rand(rng, 70, 150)
    const cand: Rect = {
      x: rand(rng, inset + w / 2, WORLD.w - inset - w / 2),
      y: rand(rng, 150, WORLD.h - 150),
      w,
      h,
    }
    // Keep clear of the ball, the hole, and other blocks.
    if (pointInRect(ball.x, ball.y, cand, BALL_R + 24)) continue
    if (pointInRect(hole.x, hole.y, cand, HOLE_R + 24)) continue
    if (walls.some((r) => rectsOverlap(cand, r, 26))) continue
    walls.push(cand)
  }

  // Sand traps: slow the ball down a lot if it rolls through them.
  const sand: Circle[] = []
  const sandCount = randInt(rng, 1, 2)
  guard = 0
  while (sand.length < sandCount && guard++ < 200) {
    const cand: Circle = {
      x: rand(rng, inset + 20, WORLD.w - inset - 20),
      y: rand(rng, 130, WORLD.h - 120),
      r: rand(rng, 26, 40),
    }
    if (Math.hypot(cand.x - ball.x, cand.y - ball.y) < cand.r + 30) continue
    if (Math.hypot(cand.x - hole.x, cand.y - hole.y) < cand.r + 30) continue
    if (walls.some((r) => pointInRect(cand.x, cand.y, r, cand.r + 6))) continue
    sand.push(cand)
  }

  // Par scales with how much stuff is in the way.
  const par = Math.min(6, 2 + Math.round((walls.length + sand.length) / 2))

  return { date, par, ball, hole, walls, sand }
}
