import * as THREE from 'three'
import type { Daily } from './daily'

export type GameState = 'playing' | 'over'

export type Snapshot = {
  score: number
  best: number
  combo: number
  target: number
  reached: boolean
  state: GameState
  /** Increments on every perfect drop so the UI can flash. */
  perfectFlash: number
}

type Axis = 'x' | 'z'

type Top = { x: number; z: number; sizeX: number; sizeZ: number; y: number }

type Moving = {
  mesh: THREE.Mesh
  axis: Axis
  dir: number
  pos: number
  speed: number
  sizeX: number
  sizeZ: number
}

type Faller = {
  mesh: THREE.Mesh
  material: THREE.MeshLambertMaterial
  vx: number
  vy: number
  vz: number
  rx: number
  rz: number
  life: number
}

// ---- Tunables -------------------------------------------------------------
const BLOCK_H = 0.72 // block thickness
const BASE_SIZE = 3 // starting footprint (x and z)
const MOVE_RANGE = 3.7 // how far a block slides from centre before bouncing
const BASE_SPEED = 3.0 // world units / second at score 0
const SPEED_RAMP = 0.035 // extra fraction of speed per stacked block
const MAX_SPEED = 8.0
const PERFECT_TOL = 0.14 // |miss| under this counts as a perfect drop
const PERFECT_GROW = 0.22 // how much a perfect drop regrows the block
const GRAVITY = 24

export class StackGame {
  private container: HTMLElement
  private daily: Daily
  private onUpdate: (s: Snapshot) => void

  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private geometry: THREE.BoxGeometry
  private dirLight: THREE.DirectionalLight

  private blocks: THREE.Mesh[] = []
  private fallers: Faller[] = []
  private moving: Moving | null = null
  private top: Top = { x: 0, z: 0, sizeX: BASE_SIZE, sizeZ: BASE_SIZE, y: 0 }

  private score = 0
  private combo = 0
  private best = 0
  private perfectFlash = 0
  private state: GameState = 'playing'
  private overAt = 0

  private clock = new THREE.Clock()
  private raf = 0
  private camFocus = new THREE.Vector3(0, 0, 0)
  private camOffset = new THREE.Vector3()
  private tmp = new THREE.Vector3()

  constructor(
    container: HTMLElement,
    daily: Daily,
    onUpdate: (s: Snapshot) => void,
  ) {
    this.container = container
    this.daily = daily
    this.onUpdate = onUpdate
    this.best = Number(localStorage.getItem(daily.slug) ?? 0) || 0

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.scene.background = makeGradient(daily.bgTop, daily.bgBottom)
    // Camera sits ~60 units out (see camOffset); keep the active top crisp and
    // only let the deep base of the tower fade into the sky.
    this.scene.fog = new THREE.Fog(new THREE.Color(daily.fogColor).getHex(), 64, 120)

    this.geometry = new THREE.BoxGeometry(1, BLOCK_H, 1)

    // Iso-ish viewing direction; distance only matters for clipping in ortho.
    this.camOffset.set(1, 0.82, 1).normalize().multiplyScalar(60)
    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 1, 200)

    const hemi = new THREE.HemisphereLight(
      new THREE.Color(daily.skyLight).getHex(),
      new THREE.Color(daily.groundLight).getHex(),
      1.05,
    )
    this.scene.add(hemi)
    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.1)
    this.scene.add(this.dirLight)
    this.scene.add(this.dirLight.target)

    this.resize()
    window.addEventListener('resize', this.resize)
    window.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('keydown', this.onKeyDown)

    this.reset()
    this.emit()
    this.loop()
  }

  // ---- public API ---------------------------------------------------------

  drop = () => {
    if (this.state !== 'playing' || !this.moving) return
    const m = this.moving
    const axis = m.axis
    const topPos = axis === 'x' ? this.top.x : this.top.z
    const size = axis === 'x' ? m.sizeX : m.sizeZ
    const delta = m.pos - topPos
    const ad = Math.abs(delta)

    // Complete miss: nothing overlaps the block below — the tower falls.
    if (ad >= size) {
      this.combo = 0
      this.toFaller(m.mesh, Math.sign(delta) || 1, axis, 3.5)
      this.moving = null
      this.endGame()
      return
    }

    const sign = Math.sign(delta) || 1
    let newSize: number
    let newCenter: number
    if (ad <= PERFECT_TOL) {
      // Perfect drop: snap, regrow a little, and build a combo.
      newSize = Math.min(BASE_SIZE, size + PERFECT_GROW)
      newCenter = topPos
      this.combo += 1
      this.perfectFlash += 1
    } else {
      // Slice off the overhang; it tumbles away as a separate piece.
      newSize = size - ad
      newCenter = topPos + delta / 2
      this.combo = 0
      const sliceCenter = newCenter + sign * (newSize / 2 + ad / 2)
      this.spawnSlice(m, axis, sliceCenter, ad, sign)
    }

    // Freeze the moving block into the tower at its sliced size/position.
    const mesh = m.mesh
    if (axis === 'x') {
      mesh.scale.x = newSize
      mesh.position.x = newCenter
      this.top = { x: newCenter, z: this.top.z, sizeX: newSize, sizeZ: m.sizeZ, y: m.mesh.position.y }
    } else {
      mesh.scale.z = newSize
      mesh.position.z = newCenter
      this.top = { x: this.top.x, z: newCenter, sizeX: m.sizeX, sizeZ: newSize, y: m.mesh.position.y }
    }
    this.blocks.push(mesh)
    this.moving = null
    this.score += 1
    if (this.score > this.best) {
      this.best = this.score
      localStorage.setItem(this.daily.slug, String(this.best))
    }
    this.spawnMoving()
    this.emit()
  }

  restart = () => {
    if (this.state !== 'over') return
    this.reset()
    this.emit()
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.resize)
    window.removeEventListener('pointerdown', this.onPointerDown)
    window.removeEventListener('keydown', this.onKeyDown)
    this.clearScene()
    this.geometry.dispose()
    this.renderer.dispose()
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement)
    }
  }

  // ---- input --------------------------------------------------------------

  private onPointerDown = (e: PointerEvent) => {
    // Let real buttons (e.g. "Play again") handle their own clicks.
    if ((e.target as HTMLElement)?.closest('button')) return
    if (this.state === 'playing') {
      this.drop()
    } else if (performance.now() - this.overAt > 350) {
      this.restart()
    }
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code !== 'Space' && e.code !== 'Enter' && e.code !== 'ArrowDown') return
    e.preventDefault()
    if (this.state === 'playing') this.drop()
    else if (performance.now() - this.overAt > 350) this.restart()
  }

  // ---- core ---------------------------------------------------------------

  private reset() {
    this.clearScene()
    this.score = 0
    this.combo = 0
    this.perfectFlash = 0
    this.state = 'playing'

    // Base block.
    const base = this.makeBlock(0)
    base.scale.set(BASE_SIZE, 1, BASE_SIZE)
    base.position.set(0, 0, 0)
    this.scene.add(base)
    this.blocks.push(base)
    this.top = { x: 0, z: 0, sizeX: BASE_SIZE, sizeZ: BASE_SIZE, y: 0 }

    this.camFocus.set(0, 0, 0)
    this.updateCamera(true)
    this.spawnMoving()
  }

  private spawnMoving() {
    const level = this.score + 1
    const axis: Axis = this.score % 2 === 0 ? 'x' : 'z'
    const mesh = this.makeBlock(level)
    const y = this.top.y + BLOCK_H
    mesh.scale.set(this.top.sizeX, 1, this.top.sizeZ)
    if (axis === 'x') mesh.position.set(-MOVE_RANGE, y, this.top.z)
    else mesh.position.set(this.top.x, y, -MOVE_RANGE)
    this.scene.add(mesh)

    const speed = Math.min(
      MAX_SPEED,
      BASE_SPEED * this.daily.speedFactor * (1 + this.score * SPEED_RAMP),
    )
    this.moving = {
      mesh, axis, dir: 1, pos: -MOVE_RANGE, speed,
      sizeX: this.top.sizeX, sizeZ: this.top.sizeZ,
    }
  }

  private endGame() {
    this.state = 'over'
    this.overAt = performance.now()
    this.emit()
  }

  private update(dt: number) {
    const m = this.moving
    if (m && this.state === 'playing') {
      m.pos += m.dir * m.speed * dt
      if (m.pos > MOVE_RANGE) {
        m.pos = MOVE_RANGE
        m.dir = -1
      } else if (m.pos < -MOVE_RANGE) {
        m.pos = -MOVE_RANGE
        m.dir = 1
      }
      if (m.axis === 'x') m.mesh.position.x = m.pos
      else m.mesh.position.z = m.pos
    }

    // Tumbling sliced pieces.
    for (let i = this.fallers.length - 1; i >= 0; i--) {
      const f = this.fallers[i]
      f.vy -= GRAVITY * dt
      f.mesh.position.x += f.vx * dt
      f.mesh.position.y += f.vy * dt
      f.mesh.position.z += f.vz * dt
      f.mesh.rotation.x += f.rx * dt
      f.mesh.rotation.z += f.rz * dt
      f.life -= dt
      if (f.life < 0.9) f.material.opacity = Math.max(0, f.life / 0.9)
      if (f.life <= 0 || f.mesh.position.y < this.camFocus.y - 30) {
        this.scene.remove(f.mesh)
        f.material.dispose()
        this.fallers.splice(i, 1)
      }
    }

    this.updateCamera(false)
  }

  private updateCamera(immediate: boolean) {
    this.tmp.set(this.top.x, this.top.y, this.top.z)
    if (immediate) this.camFocus.copy(this.tmp)
    else this.camFocus.lerp(this.tmp, Math.min(1, 0.09))
    this.camera.position.copy(this.camFocus).add(this.camOffset)
    this.camera.lookAt(this.camFocus)
    this.dirLight.position.copy(this.camFocus).add(this.tmp.set(7, 13, 3))
    this.dirLight.target.position.copy(this.camFocus)
    this.dirLight.target.updateMatrixWorld()
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(0.05, this.clock.getDelta())
    this.update(dt)
    this.renderer.render(this.scene, this.camera)
  }

  // ---- helpers ------------------------------------------------------------

  private makeBlock(level: number): THREE.Mesh {
    const hue = (((this.daily.baseHue + level * this.daily.hueStep) % 360) + 360) % 360
    const color = new THREE.Color().setHSL(
      hue / 360,
      this.daily.blockSat,
      this.daily.blockLight,
    )
    const material = new THREE.MeshLambertMaterial({ color })
    return new THREE.Mesh(this.geometry, material)
  }

  private spawnSlice(m: Moving, axis: Axis, center: number, width: number, sign: number) {
    const mat = (m.mesh.material as THREE.MeshLambertMaterial).clone()
    mat.transparent = true
    const mesh = new THREE.Mesh(this.geometry, mat)
    mesh.position.copy(m.mesh.position)
    if (axis === 'x') {
      mesh.scale.set(width, 1, m.sizeZ)
      mesh.position.x = center
    } else {
      mesh.scale.set(m.sizeX, 1, width)
      mesh.position.z = center
    }
    this.scene.add(mesh)
    this.fallers.push({
      mesh, material: mat,
      vx: axis === 'x' ? sign * 2.2 : 0,
      vy: 1.2,
      vz: axis === 'z' ? sign * 2.2 : 0,
      rx: axis === 'z' ? sign * 3.5 : 0.6,
      rz: axis === 'x' ? -sign * 3.5 : 0.6,
      life: 2.6,
    })
  }

  // Turn the whole moving block into a tumbling piece (a complete miss).
  private toFaller(mesh: THREE.Mesh, sign: number, axis: Axis, life: number) {
    const mat = (mesh.material as THREE.MeshLambertMaterial)
    mat.transparent = true
    this.fallers.push({
      mesh, material: mat,
      vx: axis === 'x' ? sign * 3 : 0,
      vy: 1.5,
      vz: axis === 'z' ? sign * 3 : 0,
      rx: 2.2, rz: -2.2,
      life,
    })
  }

  private resize = () => {
    const w = this.container.clientWidth || window.innerWidth
    const h = this.container.clientHeight || window.innerHeight
    this.renderer.setSize(w, h)
    const aspect = w / h
    // Guarantee a minimum world width AND height stay visible on any aspect,
    // so the sliding block is never clipped on a narrow phone.
    const minHalfW = 7.5
    const minHalfH = 6
    const halfH = Math.max(minHalfH, minHalfW / aspect)
    const halfW = halfH * aspect
    this.camera.left = -halfW
    this.camera.right = halfW
    this.camera.top = halfH
    this.camera.bottom = -halfH
    this.camera.updateProjectionMatrix()
  }

  private clearScene() {
    for (const b of this.blocks) {
      this.scene.remove(b)
      ;(b.material as THREE.Material).dispose()
    }
    this.blocks = []
    for (const f of this.fallers) {
      this.scene.remove(f.mesh)
      f.material.dispose()
    }
    this.fallers = []
    if (this.moving) {
      this.scene.remove(this.moving.mesh)
      ;(this.moving.mesh.material as THREE.Material).dispose()
      this.moving = null
    }
  }

  private emit() {
    this.onUpdate({
      score: this.score,
      best: this.best,
      combo: this.combo,
      target: this.daily.target,
      reached: this.score >= this.daily.target,
      state: this.state,
      perfectFlash: this.perfectFlash,
    })
  }
}

// A vertical two-stop gradient used as the sky, drawn once into a tiny canvas.
function makeGradient(top: string, bottom: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, top)
  grad.addColorStop(1, bottom)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 4, 256)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
