import { createNoise3D } from 'simplex-noise'
import {
  BufferAttribute,
  Color,
  IcosahedronGeometry,
  type BufferGeometry,
} from 'three'

// A biome is a colour ramp from deep ocean floor up to mountain peaks, plus a
// few tuning knobs that change the planet's overall character.
type Biome = {
  label: string
  // Colour stops sampled by surface height (0 = ocean floor, 1 = peak).
  ramp: { at: number; color: string }[]
  water: string
  atmosphere: string
  seaLevel: number // shifts how much of the surface is underwater
  roughness: number // amplitude of the terrain noise
}

const BIOMES: Biome[] = [
  {
    label: 'Terran',
    ramp: [
      { at: 0.0, color: '#0a2a3a' },
      { at: 0.42, color: '#1c5a4a' },
      { at: 0.48, color: '#c2b280' },
      { at: 0.55, color: '#3f7d3a' },
      { at: 0.72, color: '#6b8e3a' },
      { at: 0.85, color: '#7a6a55' },
      { at: 1.0, color: '#f5f7fa' },
    ],
    water: '#2b6fb3',
    atmosphere: '#6db4ff',
    seaLevel: 0.46,
    roughness: 0.13,
  },
  {
    label: 'Desert',
    ramp: [
      { at: 0.0, color: '#3a2310' },
      { at: 0.4, color: '#7a4a1f' },
      { at: 0.5, color: '#b5793a' },
      { at: 0.68, color: '#d6a45a' },
      { at: 0.85, color: '#e8c98a' },
      { at: 1.0, color: '#f3e6c4' },
    ],
    water: '#2f7a6b',
    atmosphere: '#ffb46d',
    seaLevel: 0.28,
    roughness: 0.16,
  },
  {
    label: 'Glacial',
    ramp: [
      { at: 0.0, color: '#11324a' },
      { at: 0.5, color: '#3a6b8c' },
      { at: 0.58, color: '#8fb6cf' },
      { at: 0.75, color: '#cfe2ee' },
      { at: 1.0, color: '#ffffff' },
    ],
    water: '#2f5d8a',
    atmosphere: '#bfe6ff',
    seaLevel: 0.55,
    roughness: 0.1,
  },
  {
    label: 'Verdant',
    ramp: [
      { at: 0.0, color: '#0c2e23' },
      { at: 0.42, color: '#15533a' },
      { at: 0.5, color: '#2f7d3f' },
      { at: 0.65, color: '#5aa83f' },
      { at: 0.82, color: '#9ad04a' },
      { at: 1.0, color: '#e8f7c4' },
    ],
    water: '#1f8f7a',
    atmosphere: '#8dffb0',
    seaLevel: 0.4,
    roughness: 0.14,
  },
  {
    label: 'Volcanic',
    ramp: [
      { at: 0.0, color: '#1a0a0a' },
      { at: 0.45, color: '#3a1410' },
      { at: 0.55, color: '#5e1f12' },
      { at: 0.72, color: '#8a2a14' },
      { at: 0.86, color: '#d94a1a' },
      { at: 1.0, color: '#ffd24a' },
    ],
    water: '#b5341a',
    atmosphere: '#ff7a3a',
    seaLevel: 0.34,
    roughness: 0.18,
  },
  {
    label: 'Alien',
    ramp: [
      { at: 0.0, color: '#1a0a2e' },
      { at: 0.44, color: '#3a1a6b' },
      { at: 0.52, color: '#6b2fa8' },
      { at: 0.7, color: '#a84ad9' },
      { at: 0.85, color: '#d97ae8' },
      { at: 1.0, color: '#f5d4ff' },
    ],
    water: '#5a2fa8',
    atmosphere: '#c06dff',
    seaLevel: 0.42,
    roughness: 0.15,
  },
]

export type PlanetConfig = {
  biome: Biome
  hasRing: boolean
  ringColor: string
  tilt: number
}

export const buildConfig = (rand: () => number): PlanetConfig => {
  const biome = BIOMES[Math.floor(rand() * BIOMES.length)]
  return {
    biome,
    hasRing: rand() < 0.4,
    ringColor: biome.atmosphere,
    tilt: (rand() - 0.5) * 0.8,
  }
}

const sampleRamp = (ramp: Biome['ramp'], t: number, out: Color): Color => {
  if (t <= ramp[0].at) return out.set(ramp[0].color)
  for (let i = 1; i < ramp.length; i++) {
    if (t <= ramp[i].at) {
      const a = ramp[i - 1]
      const b = ramp[i]
      const f = (t - a.at) / (b.at - a.at)
      return out.set(a.color).lerp(new Color(b.color), f)
    }
  }
  return out.set(ramp[ramp.length - 1].color)
}

// Layered noise ("fractal Brownian motion"): several octaves of simplex noise
// summed together, giving large continents plus small surface detail.
const fbm = (
  noise: (x: number, y: number, z: number) => number,
  x: number,
  y: number,
  z: number,
): number => {
  let value = 0
  let amplitude = 1
  let frequency = 1
  let max = 0
  for (let o = 0; o < 5; o++) {
    value += amplitude * noise(x * frequency, y * frequency, z * frequency)
    max += amplitude
    amplitude *= 0.5
    frequency *= 2.1
  }
  return value / max
}

// Displace an icosphere by the noise field and paint each vertex by height.
// Returns the deformed geometry (already non-indexed + flat-shaded) and the
// peak height so the water/ring can be scaled to match.
export const buildPlanetGeometry = (
  rand: () => number,
  config: PlanetConfig,
): { geometry: BufferGeometry } => {
  const noise = createNoise3D(rand)
  const detail = 48
  const geometry = (new IcosahedronGeometry(1, detail) as BufferGeometry).toNonIndexed()

  const pos = geometry.attributes.position
  const count = pos.count
  const colors = new Float32Array(count * 3)
  const { roughness, seaLevel, ramp } = config.biome
  const tmp = new Color()

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    // The icosphere points are already unit-length (direction from centre).
    const noisy = fbm(noise, x * 1.6, y * 1.6, z * 1.6)
    // Push values toward continents-and-oceans rather than gentle hills.
    const raw = Math.sign(noisy) * Math.pow(Math.abs(noisy), 0.85)
    const height = (raw + 1) / 2 // 0..1

    // Land rises above sea level; ocean floor is flattened a little.
    const aboveSea = height > seaLevel
    const elevation = aboveSea
      ? (height - seaLevel) * roughness
      : (height - seaLevel) * roughness * 0.4
    const r = 1 + elevation
    pos.setXYZ(i, x * r, y * r, z * r)

    sampleRamp(ramp, height, tmp)
    colors[i * 3] = tmp.r
    colors[i * 3 + 1] = tmp.g
    colors[i * 3 + 2] = tmp.b
  }

  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return { geometry }
}
