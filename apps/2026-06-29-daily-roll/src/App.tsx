import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  buildLevel,
  occupied,
  roll,
  type BlockState,
  type Dir,
  type Level,
} from './level'
import './style.css'

// Resolve the day's slug + date from the URL folder name (never the clock).
const slug =
  location.pathname.match(/\d{4}-\d{2}-\d{2}-[^/]+/)?.[0] ?? '2026-06-29-daily-roll'
const date = slug.slice(0, 10)
const prettyDate = new Date(date + 'T00:00:00').toLocaleDateString(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

const ROLL_MS = 135
const DIR_OF_KEY: Record<string, Dir> = {
  ArrowUp: 'nz',
  ArrowDown: 'pz',
  ArrowLeft: 'nx',
  ArrowRight: 'px',
  w: 'nz',
  s: 'pz',
  a: 'nx',
  d: 'px',
  W: 'nz',
  S: 'pz',
  A: 'nx',
  D: 'px',
}

// Canonical world transform of the block mesh for a given state.
function applyState(group: THREE.Object3D, s: BlockState) {
  if (s.axis === 'up') {
    group.position.set(s.x, 1, s.z)
    group.quaternion.identity()
  } else if (s.axis === 'x') {
    group.position.set(s.x + 0.5, 0.5, s.z)
    group.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)
  } else {
    group.position.set(s.x, 0.5, s.z + 0.5)
    group.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)
  }
}

// Pivot edge + rotation axis/angle to roll one tile in a direction.
function rollPivot(s: BlockState, dir: Dir) {
  const cells = occupied(s)
  const xs = cells.map((c) => c.x)
  const zs = cells.map((c) => c.z)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2
  if (dir === 'px')
    return { pivot: new THREE.Vector3(maxX + 0.5, 0, cz), axis: new THREE.Vector3(0, 0, 1), angle: -Math.PI / 2 }
  if (dir === 'nx')
    return { pivot: new THREE.Vector3(minX - 0.5, 0, cz), axis: new THREE.Vector3(0, 0, 1), angle: Math.PI / 2 }
  if (dir === 'pz')
    return { pivot: new THREE.Vector3(cx, 0, maxZ + 0.5), axis: new THREE.Vector3(1, 0, 0), angle: Math.PI / 2 }
  return { pivot: new THREE.Vector3(cx, 0, minZ - 0.5), axis: new THREE.Vector3(1, 0, 0), angle: -Math.PI / 2 }
}

type Anim =
  | { kind: 'roll'; t: number; to: BlockState; axis: THREE.Vector3; angle: number; onDone: () => void }
  | { kind: 'fall'; t: number; axis: THREE.Vector3; angle: number; onDone: () => void }

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<{ move: (d: Dir) => void; reset: () => void; undo: () => void } | null>(null)

  const [level] = useState<Level>(() => buildLevel(slug))
  const [moves, setMoves] = useState(0)
  const [won, setWon] = useState(false)
  const [best, setBest] = useState<number | null>(() => {
    const v = localStorage.getItem(slug + ':best')
    return v ? Number(v) : null
  })
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0d1020')
    scene.fog = new THREE.Fog('#0d1020', 18, 42)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    // ---- Lights ----
    scene.add(new THREE.HemisphereLight('#9fb4ff', '#0a0c18', 0.7))
    const sun = new THREE.DirectionalLight('#fff3e0', 1.15)
    sun.position.set(6, 12, 7)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 60
    const sc = sun.shadow.camera as THREE.OrthographicCamera
    sc.left = -20
    sc.right = 20
    sc.top = 20
    sc.bottom = -20
    sc.updateProjectionMatrix()
    scene.add(sun)

    // ---- World centroid for framing ----
    const cxs = level.floor.map((c) => c.x)
    const czs = level.floor.map((c) => c.z)
    const minX = Math.min(...cxs)
    const maxX = Math.max(...cxs)
    const minZ = Math.min(...czs)
    const maxZ = Math.max(...czs)
    const center = new THREE.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2)
    const spanX = maxX - minX + 3
    const spanZ = maxZ - minZ + 3

    const world = new THREE.Group()
    world.position.set(-center.x, 0, -center.z) // recenter scene at origin
    scene.add(world)

    // ---- Tiles ----
    const floorKey = (x: number, z: number) => `${x},${z}`
    const goalKey = floorKey(level.goal.x, level.goal.z)
    const tileGeo = new THREE.BoxGeometry(0.92, 0.3, 0.92)
    const tileMat = new THREE.MeshStandardMaterial({ color: '#33457e', roughness: 0.85, metalness: 0.1 })
    const goalMat = new THREE.MeshStandardMaterial({
      color: '#0f3d3a',
      emissive: '#2dd4bf',
      emissiveIntensity: 0.9,
      roughness: 0.5,
    })
    for (const c of level.floor) {
      const isGoal = floorKey(c.x, c.z) === goalKey
      const tile = new THREE.Mesh(tileGeo, isGoal ? goalMat : tileMat)
      tile.position.set(c.x, -0.15, c.z)
      tile.receiveShadow = true
      world.add(tile)
    }

    // Glowing goal beam
    const beamMat = new THREE.MeshBasicMaterial({ color: '#2dd4bf', transparent: true, opacity: 0.22, depthWrite: false })
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 6, 24, 1, true), beamMat)
    beam.position.set(level.goal.x, 3, level.goal.z)
    world.add(beam)

    // ---- Block ----
    const blockGroup = new THREE.Group()
    const blockMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.96, 1.96, 0.96),
      new THREE.MeshStandardMaterial({ color: '#ffb454', emissive: '#3a1e00', emissiveIntensity: 0.5, roughness: 0.45, metalness: 0.2 }),
    )
    blockMesh.castShadow = true
    blockMesh.receiveShadow = true
    blockGroup.add(blockMesh)
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(blockMesh.geometry),
      new THREE.LineBasicMaterial({ color: '#5b2a00' }),
    )
    blockGroup.add(edges)
    world.add(blockGroup)

    let state: BlockState = level.start
    applyState(blockGroup, state)

    // ---- Camera ----
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    const camDir = new THREE.Vector3(0, 0.84, 0.56).normalize()

    function fit() {
      const w = mount!.clientWidth
      const h = mount!.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      const vFov = (camera.fov * Math.PI) / 180
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect)
      const radius = Math.max(spanX / Math.tan(hFov / 2), (spanZ + 2) / Math.tan(vFov / 2)) / 2
      const dist = Math.max(radius * 1.15, 7)
      camera.position.copy(camDir).multiplyScalar(dist)
      camera.lookAt(0, 0, 0)
      camera.updateProjectionMatrix()
    }
    fit()

    // ---- Animation / input ----
    let anim: Anim | null = null
    let finished = false

    const pivotObj = new THREE.Object3D()
    world.add(pivotObj)

    const onFloor = (s: BlockState) => occupied(s).every((c) => level.floorSet.has(floorKey(c.x, c.z)))
    const isWin = (s: BlockState) => s.axis === 'up' && s.x === level.goal.x && s.z === level.goal.z

    const history: BlockState[] = []

    function startRoll(dir: Dir) {
      if (anim || finished) return
      const next = roll(state, dir)
      const { pivot, axis, angle } = rollPivot(state, dir)
      pivotObj.position.copy(pivot)
      pivotObj.quaternion.identity()
      pivotObj.attach(blockGroup)
      if (onFloor(next)) {
        history.push(state)
        anim = {
          kind: 'roll', t: 0, to: next, axis, angle,
          onDone: () => {
            state = next
            if (isWin(state)) finishWin()
            else setMoves(history.length)
          },
        }
      } else {
        // Tips over the edge and falls into the void, then resets.
        anim = {
          kind: 'fall', t: 0, axis, angle,
          onDone: () => {
            state = level.start
            applyState(blockGroup, state)
            history.length = 0
            setMoves(0)
          },
        }
      }
    }

    function finishWin() {
      const total = history.length
      finished = true
      setWon(true)
      setMoves(total)
      const prev = localStorage.getItem(slug + ':best')
      if (!prev || total < Number(prev)) {
        localStorage.setItem(slug + ':best', String(total))
        setBest(total)
      }
    }

    function reset() {
      if (anim) return
      world.attach(blockGroup)
      state = level.start
      applyState(blockGroup, state)
      history.length = 0
      finished = false
      setMoves(0)
      setWon(false)
    }

    function undo() {
      if (anim || finished || history.length === 0) return
      world.attach(blockGroup)
      state = history.pop()!
      applyState(blockGroup, state)
      setMoves(history.length)
    }

    apiRef.current = { move: startRoll, reset, undo }

    // Keyboard
    const onKey = (e: KeyboardEvent) => {
      const d = DIR_OF_KEY[e.key]
      if (d) {
        e.preventDefault()
        startRoll(d)
      } else if (e.key === 'z' || e.key === 'Z') {
        undo()
      } else if (e.key === 'r' || e.key === 'R') {
        reset()
      }
    }
    window.addEventListener('keydown', onKey)

    // Swipe on the canvas
    let downX = 0
    let downY = 0
    let downT = 0
    const el = renderer.domElement
    const onDown = (e: PointerEvent) => {
      downX = e.clientX
      downY = e.clientY
      downT = e.timeStamp
    }
    const onUp = (e: PointerEvent) => {
      const dx = e.clientX - downX
      const dy = e.clientY - downY
      const dist = Math.hypot(dx, dy)
      if (dist < 24 || e.timeStamp - downT > 800) return
      if (Math.abs(dx) > Math.abs(dy)) startRoll(dx > 0 ? 'px' : 'nx')
      else startRoll(dy > 0 ? 'pz' : 'nz')
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)

    // ---- Resize ----
    const ro = new ResizeObserver(fit)
    ro.observe(mount)

    // ---- Render loop ----
    const clock = new THREE.Clock()
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const dt = clock.getDelta()
      const time = clock.elapsedTime

      beamMat.opacity = 0.16 + 0.12 * (0.5 + 0.5 * Math.sin(time * 2.4))
      beam.rotation.y = time * 0.6
      goalMat.emissiveIntensity = 0.75 + 0.35 * (0.5 + 0.5 * Math.sin(time * 2.4))

      if (anim) {
        if (anim.kind === 'roll') {
          anim.t = Math.min(1, anim.t + (dt * 1000) / ROLL_MS)
          const e = anim.t < 0.5 ? 2 * anim.t * anim.t : 1 - Math.pow(-2 * anim.t + 2, 2) / 2
          pivotObj.quaternion.setFromAxisAngle(anim.axis, anim.angle * e)
          if (anim.t >= 1) {
            world.attach(blockGroup)
            applyState(blockGroup, anim.to)
            const done = anim.onDone
            anim = null
            done()
          }
        } else {
          // fall: tip over the edge first, then drop away into the void
          anim.t = Math.min(1, anim.t + (dt * 1000) / 520)
          const tipT = Math.min(1, anim.t / 0.32)
          pivotObj.quaternion.setFromAxisAngle(anim.axis, anim.angle * tipT)
          if (anim.t > 0.32) {
            const dropT = (anim.t - 0.32) / 0.68
            blockGroup.position.y = -16 * dropT * dropT
          }
          if (anim.t >= 1) {
            world.attach(blockGroup)
            const done = anim.onDone
            anim = null
            done()
          }
        }
      }

      renderer.render(scene, camera)
    }
    tick()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('keydown', onKey)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [level])

  const dpad = (d: Dir, label: string, cls: string) => (
    <button
      className={`dpad-btn ${cls}`}
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault()
        apiRef.current?.move(d)
      }}
    >
      <span>{label}</span>
    </button>
  )

  return (
    <div className="app">
      <div className="scene" ref={mountRef} />

      <header className="hud-top">
        <div className="title">
          <h1>Daily Roll</h1>
          <span className="date">{prettyDate}</span>
        </div>
        <div className="stats">
          <div className="stat">
            <b>{moves}</b>
            <small>moves</small>
          </div>
          <div className="stat">
            <b>{level.par}</b>
            <small>par</small>
          </div>
          {best !== null && (
            <div className="stat">
              <b>{best}</b>
              <small>best</small>
            </div>
          )}
        </div>
      </header>

      <div className="controls">
        <div className="dpad">
          {dpad('nz', '▲', 'up')}
          {dpad('nx', '◀', 'left')}
          {dpad('px', '▶', 'right')}
          {dpad('pz', '▼', 'down')}
        </div>
        <div className="side-btns">
          <button className="txt-btn" onPointerDown={(e) => { e.preventDefault(); apiRef.current?.undo() }}>
            Undo
          </button>
          <button className="txt-btn" onPointerDown={(e) => { e.preventDefault(); apiRef.current?.reset() }}>
            Reset
          </button>
          <button className="txt-btn" onPointerDown={(e) => { e.preventDefault(); setShowHelp((v) => !v) }}>
            ?
          </button>
        </div>
      </div>

      {showHelp && (
        <div className="overlay" onPointerDown={() => setShowHelp(false)}>
          <div className="card" onPointerDown={(e) => e.stopPropagation()}>
            <h2>How to play</h2>
            <p>
              Roll the amber block across the floating tiles and land it standing
              upright in the glowing teal hole.
            </p>
            <ul>
              <li>Swipe on the board, tap the arrows, or use arrow / WASD keys.</li>
              <li>Roll off an edge and the block falls — it resets to the start.</li>
              <li>Par is the fewest moves possible. Can you match it?</li>
            </ul>
            <button className="primary" onPointerDown={(e) => { e.stopPropagation(); setShowHelp(false) }}>
              Got it
            </button>
          </div>
        </div>
      )}

      {won && (
        <div className="overlay">
          <div className="card">
            <h2>Solved!</h2>
            <p>
              You landed it in <b>{moves}</b> {moves === 1 ? 'move' : 'moves'}.
              {moves === level.par
                ? ' That ties par — perfect!'
                : ` Par is ${level.par}.`}
            </p>
            <button className="primary" onPointerDown={(e) => { e.preventDefault(); apiRef.current?.reset() }}>
              Play again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
