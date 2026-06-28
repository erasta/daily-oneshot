// Deterministic pseudo-random number generator seeded from a string (the date).
// Same date -> same course for everyone, with no server.

function hashString(str: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function makeRng(seed: string) {
  let a = hashString(seed)
  // mulberry32
  return function next(): number {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Rng = ReturnType<typeof makeRng>

export const rand = (rng: Rng, min: number, max: number) => min + rng() * (max - min)
export const randInt = (rng: Rng, min: number, max: number) =>
  Math.floor(rand(rng, min, max + 1))
