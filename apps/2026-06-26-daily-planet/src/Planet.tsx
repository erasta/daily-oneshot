import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BackSide,
  Color,
  DoubleSide,
  Group,
  ShaderMaterial,
} from 'three'
import { buildPlanetGeometry, type PlanetConfig } from './planet'

// A soft fresnel glow around the planet to fake an atmosphere: brighter at the
// silhouette edge, fading to nothing where we look straight at the surface.
const makeAtmosphere = (color: string) =>
  new ShaderMaterial({
    transparent: true,
    blending: AdditiveBlending,
    side: BackSide,
    depthWrite: false,
    uniforms: { uColor: { value: new Color(color) } },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      uniform vec3 uColor;
      void main() {
        float intensity = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
        gl_FragColor = vec4(uColor, 1.0) * intensity;
      }
    `,
  })

export const Planet = ({
  rand,
  config,
}: {
  rand: () => number
  config: PlanetConfig
}) => {
  const group = useRef<Group>(null)

  const { geometry, atmosphere } = useMemo(() => {
    const { geometry } = buildPlanetGeometry(rand, config)
    return { geometry, atmosphere: makeAtmosphere(config.biome.atmosphere) }
  }, [rand, config])

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.08
  })

  return (
    <group rotation={[0, 0, config.tilt]}>
      <group ref={group}>
        {/* Solid terrain */}
        <mesh geometry={geometry}>
          <meshStandardMaterial
            vertexColors
            flatShading
            roughness={0.85}
            metalness={0.05}
          />
        </mesh>

        {/* Ocean at sea level */}
        <mesh>
          <sphereGeometry args={[1.001, 96, 96]} />
          <meshStandardMaterial
            color={config.biome.water}
            transparent
            opacity={0.82}
            roughness={0.25}
            metalness={0.2}
          />
        </mesh>

        {/* Saturn-style ring, only on some planets */}
        {config.hasRing && (
          <mesh rotation={[Math.PI / 2.1, 0, 0]}>
            <ringGeometry args={[1.5, 2.2, 96]} />
            <meshBasicMaterial
              color={config.ringColor}
              transparent
              opacity={0.35}
              side={DoubleSide}
            />
          </mesh>
        )}
      </group>

      {/* Atmosphere shell (does not rotate with the surface) */}
      <mesh material={atmosphere} scale={1.22}>
        <sphereGeometry args={[1, 48, 48]} />
      </mesh>
    </group>
  )
}
