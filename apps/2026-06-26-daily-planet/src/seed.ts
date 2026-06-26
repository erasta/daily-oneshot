// Everything here is deterministic: the same date always produces the same
// planet. The date itself comes only from the folder slug (see getSlug below),
// never from the system clock or a hardcoded literal.

export const getSlug = (): string => {
  const match = location.pathname.match(/\d{4}-\d{2}-\d{2}-[^/]+/)
  return match?.[0] ?? '2026-06-26-daily-planet'
}

export const getDate = (): string => getSlug().slice(0, 10)

// A small, fast pseudo-random generator. Given the same starting number it
// always emits the same stream of values in [0, 1).
const mulberry32 = (a: number) => {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Turn an arbitrary string into a single number we can seed the generator with.
const hashString = (str: string): number => {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export const makeRandom = (str: string) => mulberry32(hashString(str))

// A planet name built from the seed, e.g. "Vorath IX".
const SYLLABLES = [
  'ka', 'vor', 'ze', 'thal', 'myr', 'qua', 'nox', 'el', 'dra', 'sol',
  'ix', 'pho', 'lun', 'ar', 'cy', 'gan', 'tris', 'vel', 'oma', 'ner',
]
const ROMAN = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI']

export const makeName = (rand: () => number): string => {
  const parts = 2 + Math.floor(rand() * 2)
  let name = ''
  for (let i = 0; i < parts; i++) {
    name += SYLLABLES[Math.floor(rand() * SYLLABLES.length)]
  }
  const titled = name.charAt(0).toUpperCase() + name.slice(1)
  return `${titled} ${ROMAN[Math.floor(rand() * ROMAN.length)]}`
}
