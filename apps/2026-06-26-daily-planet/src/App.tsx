import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import { Planet } from './Planet'
import { buildConfig } from './planet'
import { getDate, getSlug, makeName, makeRandom } from './seed'
import './App.css'

const formatDate = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number)
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]
  return `${months[m - 1]} ${d}, ${y}`
}

const App = () => {
  const slug = useMemo(getSlug, [])
  const date = useMemo(getDate, [])

  // Everything below is derived from the slug, so the same day always renders
  // the same world. Separate seed streams keep the name and the terrain noise
  // independent of each other.
  const { config, name, rand } = useMemo(() => {
    const config = buildConfig(makeRandom(slug))
    const name = makeName(makeRandom(slug + ':name'))
    return { config, name, rand: makeRandom(slug + ':surface') }
  }, [slug])

  return (
    <div className="stage">
      <Canvas camera={{ position: [0, 0.6, 3.2], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={['#05060f']} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[5, 3, 4]} intensity={2.4} color="#fff6e6" />
        <Stars
          radius={60}
          depth={40}
          count={3500}
          factor={3}
          saturation={0}
          fade
          speed={0.4}
        />
        <Planet rand={rand} config={config} />
        <OrbitControls
          enablePan={false}
          minDistance={1.8}
          maxDistance={6}
          autoRotate
          autoRotateSpeed={0.3}
        />
      </Canvas>

      <div className="hud">
        <div className="hud__top">
          <span className="hud__label">DAILY PLANET</span>
          <span className="hud__date">{formatDate(date)}</span>
        </div>
        <div className="hud__bottom">
          <h1 className="hud__name">{name}</h1>
          <p className="hud__class">{config.biome.label} class world</p>
          <p className="hud__hint">drag to orbit · scroll to zoom</p>
        </div>
      </div>
    </div>
  )
}

export default App
