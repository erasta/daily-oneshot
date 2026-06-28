import { useEffect, useRef, useState } from 'react'
import Matter from 'matter-js'
import { BALL_R, HOLE_R, WALL_T, WORLD, generateLevel, type Level } from './level'

const MAX_PULL = 150 // world units of drag at which power maxes out
const LAUNCH_SCALE = 0.13 // pull distance -> launch speed
const REST_SPEED = 0.35 // below this the ball is "stopped"
const SINK_SPEED = 2.6 // must be this slow to drop into the hole

type Phase = 'aim' | 'rolling' | 'sunk'

type Pull = { x: number; y: number } | null

const scoreLabel = (strokes: number, par: number) => {
  const d = strokes - par
  if (strokes === 1) return 'Hole in one!'
  if (d <= -2) return 'Eagle!'
  if (d === -1) return 'Birdie!'
  if (d === 0) return 'Par'
  if (d === 1) return 'Bogey'
  if (d === 2) return 'Double bogey'
  return `+${d}`
}

export default function Game({ slug, date }: { slug: string; date: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [strokes, setStrokes] = useState(0)
  const [phase, setPhase] = useState<Phase>('aim')
  const [level] = useState<Level>(() => generateLevel(date))
  const [best, setBest] = useState<number | null>(() => {
    const raw = localStorage.getItem(slug)
    return raw ? Number(raw) : null
  })

  // Mutable game state kept out of React so the render loop stays cheap.
  const g = useRef({
    engine: null as Matter.Engine | null,
    ball: null as Matter.Body | null,
    pull: null as Pull,
    phase: 'aim' as Phase,
    strokes: 0,
    sinkT: 0, // animation progress when dropping into the hole
  })

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const engine = Matter.Engine.create({ gravity: { x: 0, y: 0, scale: 0 } })
    g.current.engine = engine

    const wallOpts = { isStatic: true, restitution: 0.55, friction: 0 }
    const borders = [
      Matter.Bodies.rectangle(WORLD.w / 2, WALL_T / 2, WORLD.w, WALL_T, wallOpts),
      Matter.Bodies.rectangle(WORLD.w / 2, WORLD.h - WALL_T / 2, WORLD.w, WALL_T, wallOpts),
      Matter.Bodies.rectangle(WALL_T / 2, WORLD.h / 2, WALL_T, WORLD.h, wallOpts),
      Matter.Bodies.rectangle(WORLD.w - WALL_T / 2, WORLD.h / 2, WALL_T, WORLD.h, wallOpts),
    ]
    const blocks = level.walls.map((r) =>
      Matter.Bodies.rectangle(r.x, r.y, r.w, r.h, wallOpts),
    )
    const ball = Matter.Bodies.circle(level.ball.x, level.ball.y, BALL_R, {
      restitution: 0.5,
      friction: 0,
      frictionAir: 0.02,
      density: 0.001,
    })
    g.current.ball = ball
    Matter.Composite.add(engine.world, [...borders, ...blocks, ball])

    // ---- pointer / aiming -------------------------------------------------
    const toWorld = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect()
      return {
        x: ((clientX - rect.left) / rect.width) * WORLD.w,
        y: ((clientY - rect.top) / rect.height) * WORLD.h,
      }
    }
    const onDown = (e: PointerEvent) => {
      if (g.current.phase !== 'aim') return
      e.preventDefault()
      canvas.setPointerCapture(e.pointerId)
      const p = toWorld(e.clientX, e.clientY)
      g.current.pull = { x: p.x - ball.position.x, y: p.y - ball.position.y }
    }
    const onMove = (e: PointerEvent) => {
      if (!g.current.pull) return
      const p = toWorld(e.clientX, e.clientY)
      g.current.pull = { x: p.x - ball.position.x, y: p.y - ball.position.y }
    }
    const onUp = () => {
      const pull = g.current.pull
      g.current.pull = null
      if (!pull || g.current.phase !== 'aim') return
      const dist = Math.min(Math.hypot(pull.x, pull.y), MAX_PULL)
      if (dist < 8) return // a tap, not a shot
      const ang = Math.atan2(pull.y, pull.x)
      // Launch opposite the pull, slingshot-style.
      const speed = dist * LAUNCH_SCALE
      Matter.Body.setVelocity(ball, {
        x: -Math.cos(ang) * speed,
        y: -Math.sin(ang) * speed,
      })
      g.current.strokes += 1
      setStrokes(g.current.strokes)
      g.current.phase = 'rolling'
      setPhase('rolling')
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)

    // ---- main loop --------------------------------------------------------
    let raf = 0
    let last = 0
    const inSand = (x: number, y: number) =>
      level.sand.some((s) => Math.hypot(x - s.x, y - s.y) < s.r)

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame)
      const dt = last ? Math.min(t - last, 40) : 16.7
      last = t

      const gs = g.current
      if (gs.phase === 'rolling') {
        // Sand multiplies rolling resistance.
        ball.frictionAir = inSand(ball.position.x, ball.position.y) ? 0.16 : 0.02
        const dh = Math.hypot(
          ball.position.x - level.hole.x,
          ball.position.y - level.hole.y,
        )
        const speed = Math.hypot(ball.velocity.x, ball.velocity.y)
        // Gentle gravity toward the hole when the ball is near it.
        if (dh < HOLE_R * 2.4) {
          const f = 0.0000016 * ball.mass
          Matter.Body.applyForce(ball, ball.position, {
            x: (level.hole.x - ball.position.x) * f,
            y: (level.hole.y - ball.position.y) * f,
          })
        }
        // Sink it if it arrives slowly enough over the cup.
        if (dh < HOLE_R - 2 && speed < SINK_SPEED) {
          gs.phase = 'sunk'
          gs.sinkT = 0
          Matter.Body.setVelocity(ball, { x: 0, y: 0 })
          setPhase('sunk')
          const prevBest = best
          if (prevBest === null || gs.strokes < prevBest) {
            localStorage.setItem(slug, String(gs.strokes))
            setBest(gs.strokes)
          }
        } else if (speed < REST_SPEED) {
          Matter.Body.setVelocity(ball, { x: 0, y: 0 })
          gs.phase = 'aim'
          setPhase('aim')
        }
        Matter.Engine.update(engine, dt)
      } else if (gs.phase === 'sunk') {
        gs.sinkT = Math.min(1, gs.sinkT + dt / 350)
      }

      draw(ctx, canvas, level, ball, gs.pull, gs.phase, gs.sinkT)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      Matter.Engine.clear(engine)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  const replay = () => {
    const ball = g.current.ball!
    Matter.Body.setPosition(ball, { x: level.ball.x, y: level.ball.y })
    Matter.Body.setVelocity(ball, { x: 0, y: 0 })
    g.current.strokes = 0
    g.current.phase = 'aim'
    g.current.pull = null
    setStrokes(0)
    setPhase('aim')
  }

  return (
    <div className="game">
      <header className="hud">
        <div className="hud-item">
          <span className="hud-label">Hole</span>
          <span className="hud-value">{date}</span>
        </div>
        <div className="hud-item">
          <span className="hud-label">Strokes</span>
          <span className="hud-value">{strokes}</span>
        </div>
        <div className="hud-item">
          <span className="hud-label">Par</span>
          <span className="hud-value">{level.par}</span>
        </div>
        <div className="hud-item">
          <span className="hud-label">Best</span>
          <span className="hud-value">{best ?? '—'}</span>
        </div>
      </header>

      <div className="stage">
        <canvas
          ref={canvasRef}
          width={WORLD.w * 2}
          height={WORLD.h * 2}
          className="board"
        />
        {phase === 'sunk' && (
          <div className="overlay">
            <div className="card">
              <div className="card-score">{scoreLabel(strokes, level.par)}</div>
              <div className="card-sub">
                {strokes} {strokes === 1 ? 'stroke' : 'strokes'} · par {level.par}
              </div>
              <button className="btn" onClick={replay}>
                Play again
              </button>
            </div>
          </div>
        )}
      </div>

      <footer className="foot">
        {phase === 'sunk' ? (
          <span>Come back tomorrow for a new hole.</span>
        ) : (
          <span>Pull back from the ball and release to putt.</span>
        )}
        {phase !== 'sunk' && strokes > 0 && (
          <button className="btn-ghost" onClick={replay}>
            Reset
          </button>
        )}
      </footer>
    </div>
  )
}

// --------------------------------------------------------------------------
// Rendering. Everything is drawn in world units scaled to the backing canvas.
function draw(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  level: Level,
  ball: Matter.Body,
  pull: Pull,
  phase: Phase,
  sinkT: number,
) {
  const sx = canvas.width / WORLD.w
  const sy = canvas.height / WORLD.h
  ctx.save()
  ctx.scale(sx, sy)
  ctx.clearRect(0, 0, WORLD.w, WORLD.h)

  // Felt with a soft vignette.
  const grad = ctx.createRadialGradient(
    WORLD.w / 2,
    WORLD.h * 0.4,
    40,
    WORLD.w / 2,
    WORLD.h / 2,
    WORLD.h * 0.75,
  )
  grad.addColorStop(0, '#3aa564')
  grad.addColorStop(1, '#1f7a45')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, WORLD.w, WORLD.h)

  // Mowing stripes.
  ctx.fillStyle = 'rgba(255,255,255,0.035)'
  for (let i = 0; i < WORLD.h / 28; i += 2) {
    ctx.fillRect(0, i * 28, WORLD.w, 28)
  }

  // Sand traps.
  for (const s of level.sand) {
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
    ctx.fillStyle = '#e8d39a'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(150,120,60,0.45)'
    ctx.stroke()
  }

  // Border + obstacle blocks.
  const drawBlock = (x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = '#5a3b25'
    roundRect(ctx, x - w / 2, y - h / 2, w, h, 4)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    roundRect(ctx, x - w / 2, y - h / 2, w, Math.min(h, 5), 4)
    ctx.fill()
  }
  // Border frame.
  ctx.fillStyle = '#4a2f1d'
  ctx.fillRect(0, 0, WORLD.w, WALL_T)
  ctx.fillRect(0, WORLD.h - WALL_T, WORLD.w, WALL_T)
  ctx.fillRect(0, 0, WALL_T, WORLD.h)
  ctx.fillRect(WORLD.w - WALL_T, 0, WALL_T, WORLD.h)
  for (const r of level.walls) drawBlock(r.x, r.y, r.w, r.h)

  // Hole with flag.
  const hx = level.hole.x
  const hy = level.hole.y
  ctx.beginPath()
  ctx.arc(hx, hy, HOLE_R, 0, Math.PI * 2)
  ctx.fillStyle = '#0c2417'
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.stroke()
  // Flag (hide once the ball has dropped).
  if (phase !== 'sunk') {
    ctx.strokeStyle = '#f4f4f4'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(hx, hy)
    ctx.lineTo(hx, hy - 34)
    ctx.stroke()
    ctx.fillStyle = '#e23b3b'
    ctx.beginPath()
    ctx.moveTo(hx, hy - 34)
    ctx.lineTo(hx + 20, hy - 28)
    ctx.lineTo(hx, hy - 22)
    ctx.closePath()
    ctx.fill()
  }

  // Aim guide.
  if (pull && phase === 'aim') {
    const dist = Math.min(Math.hypot(pull.x, pull.y), MAX_PULL)
    const ang = Math.atan2(pull.y, pull.x)
    const power = dist / MAX_PULL
    const len = 30 + power * 120
    const bx = ball.position.x
    const by = ball.position.y
    const ex = bx - Math.cos(ang) * len
    const ey = by - Math.sin(ang) * len
    ctx.setLineDash([6, 6])
    ctx.lineWidth = 3
    ctx.strokeStyle = `rgba(255,255,255,${0.4 + power * 0.5})`
    ctx.beginPath()
    ctx.moveTo(bx, by)
    ctx.lineTo(ex, ey)
    ctx.stroke()
    ctx.setLineDash([])
    // Arrowhead.
    ctx.fillStyle = `rgb(${255},${Math.round(220 - power * 180)},${Math.round(120 - power * 120)})`
    ctx.save()
    ctx.translate(ex, ey)
    ctx.rotate(ang + Math.PI)
    ctx.beginPath()
    ctx.moveTo(8, 0)
    ctx.lineTo(-4, 5)
    ctx.lineTo(-4, -5)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  // Ball.
  const r = phase === 'sunk' ? BALL_R * (1 - sinkT * 0.6) : BALL_R
  if (!(phase === 'sunk' && sinkT >= 1)) {
    ctx.beginPath()
    ctx.arc(ball.position.x + 1.5, ball.position.y + 2, r, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(ball.position.x, ball.position.y, r, 0, Math.PI * 2)
    const bg = ctx.createRadialGradient(
      ball.position.x - r * 0.3,
      ball.position.y - r * 0.3,
      r * 0.2,
      ball.position.x,
      ball.position.y,
      r,
    )
    bg.addColorStop(0, '#ffffff')
    bg.addColorStop(1, '#cfd4d8')
    ctx.fillStyle = bg
    ctx.fill()
  }

  ctx.restore()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}
