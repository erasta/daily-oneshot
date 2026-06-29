// Everything that makes a given day's tower unique is derived here, purely from
// the date in the folder/URL slug — no system clock, no server. The same date
// always produces the same colors, pace, and target, so everyone shares a day.

export type Daily = {
  slug: string
  date: string
  seed: number
  /** Starting hue (degrees) for the bottom block. */
  baseHue: number
  /** How much the hue rotates per stacked block (degrees, may be negative). */
  hueStep: number
  blockSat: number
  blockLight: number
  /** CSS colors for the vertical sky gradient and fog. */
  bgTop: string
  bgBottom: string
  fogColor: string
  /** Hemisphere light tints. */
  skyLight: string
  groundLight: string
  /** Height to beat for the day. */
  target: number
  /** Per-day pace multiplier on the block's sliding speed. */
  speedFactor: number
  /** Flavor name for the day's palette, e.g. "Electric Cobalt". */
  themeName: string
}

// Fowler–Noll–Vo string hash → a stable 32-bit seed from the slug.
function hashString(str: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// Small deterministic pseudo-random generator (mulberry32). Same seed → same
// stream of numbers in [0, 1).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MOODS = [
  'Electric', 'Velvet', 'Neon', 'Cosmic', 'Sunset', 'Arctic',
  'Mellow', 'Lunar', 'Tropic', 'Retro', 'Pastel', 'Midnight',
]

// Map a hue (degrees) to a human color word for the theme name.
function hueName(h: number): string {
  const table: [number, string][] = [
    [18, 'Ember'], [45, 'Amber'], [70, 'Citrus'], [95, 'Lime'],
    [150, 'Jade'], [195, 'Teal'], [225, 'Cobalt'], [265, 'Violet'],
    [300, 'Magenta'], [335, 'Rose'], [360, 'Ember'],
  ]
  for (const [max, name] of table) if (h <= max) return name
  return 'Ember'
}

export function getDaily(): Daily {
  const slug =
    location.pathname.match(/\d{4}-\d{2}-\d{2}-[^/]+/)?.[0] ?? '2026-06-29-daily-stack'
  const date = slug.slice(0, 10)
  const seed = hashString(slug)
  const rnd = mulberry32(seed)

  const baseHue = Math.floor(rnd() * 360)
  const dir = rnd() < 0.5 ? -1 : 1
  const hueStep = dir * (7 + rnd() * 9) // 7..16 degrees per level
  const blockSat = 0.5 + rnd() * 0.14
  const blockLight = 0.55 + rnd() * 0.06

  const bgHue = Math.round(baseHue + 180 + (rnd() * 60 - 30)) % 360
  const warmHue = (bgHue + 35) % 360
  const bgTop = `hsl(${bgHue}, 42%, 13%)`
  const bgBottom = `hsl(${warmHue}, 50%, 30%)`
  const fogColor = `hsl(${warmHue}, 50%, 26%)`
  const skyLight = `hsl(${bgHue}, 30%, 80%)`
  const groundLight = `hsl(${baseHue % 360}, 35%, 28%)`

  const target = 10 + Math.floor(rnd() * 16) // 10..25
  const speedFactor = 0.85 + rnd() * 0.4 // 0.85..1.25
  const themeName = `${MOODS[Math.floor(rnd() * MOODS.length)]} ${hueName(baseHue)}`

  return {
    slug, date, seed, baseHue, hueStep, blockSat, blockLight,
    bgTop, bgBottom, fogColor, skyLight, groundLight,
    target, speedFactor, themeName,
  }
}
