import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { analyze, buildPuzzle, scramble, type Pt } from './untangle'
import './App.css'

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const slug =
  location.pathname.match(/\d{4}-\d{2}-\d{2}-[^/]+/)?.[0] ?? '2026-06-26-daily-untangle'
const date = slug.slice(0, 10)

function prettyDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number)
  if (!y || !m || !day) return d
  return `${MONTHS[m - 1]} ${day}, ${y}`
}

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000)
  const mm = Math.floor(total / 60)
  const ss = total % 60
  return `${mm}:${ss.toString().padStart(2, '0')}`
}

type Best = { time: number; moves: number }

function loadBest(): Best | null {
  const raw = localStorage.getItem(slug)
  if (!raw) return null
  const parsed = JSON.parse(raw) as Best
  return typeof parsed?.time === 'number' ? parsed : null
}

const NODE_R = 11 // visible node radius in px
const HIT_R = 26 // invisible touch target radius in px (52px diameter)

export default function App() {
  const puzzle = useMemo(() => buildPuzzle(date), [])
  const [positions, setPositions] = useState<Pt[]>(() => puzzle.start.map((p) => ({ ...p })))
  const [box, setBox] = useState({ side: 320, ox: 0, oy: 0 })
  const [drag, setDrag] = useState<number | null>(null)
  const [moves, setMoves] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [solved, setSolved] = useState(false)
  const [best, setBest] = useState<Best | null>(() => loadBest())

  const wrapRef = useRef<HTMLDivElement>(null)
  const startRef = useRef(0)
  const movedRef = useRef(false)

  // Fit a centered square play area inside the available space.
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      const side = Math.max(120, Math.min(w, h))
      setBox({ side, ox: (w - side) / 2, oy: (h - side) / 2 })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Tick the clock while playing.
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setElapsed(performance.now() - startRef.current), 100)
    return () => clearInterval(id)
  }, [running])

  const { crossings, tangled } = useMemo(
    () => analyze(positions, puzzle.edges),
    [positions, puzzle.edges],
  )

  // Win when the last crossing is removed.
  useEffect(() => {
    if (running && !solved && crossings === 0) {
      const finalTime = performance.now() - startRef.current
      setElapsed(finalTime)
      setRunning(false)
      setSolved(true)
      const result: Best = { time: finalTime, moves }
      setBest((prev) => {
        const better =
          !prev || finalTime < prev.time || (finalTime === prev.time && moves < prev.moves)
        const next = better ? result : prev
        localStorage.setItem(slug, JSON.stringify(next))
        return next
      })
    }
  }, [crossings, running, solved, moves])

  const inset = NODE_R + 6
  const span = box.side - inset * 2
  const toPx = useCallback(
    (p: Pt) => ({ x: box.ox + inset + p.x * span, y: box.oy + inset + p.y * span }),
    [box, span, inset],
  )

  const onPointerDown = (i: number) => (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag(i)
    movedRef.current = false
    if (!running && !solved) {
      startRef.current = performance.now()
      setRunning(true)
    }
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (drag === null) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left - box.ox - inset) / span
    const y = (e.clientY - rect.top - box.oy - inset) / span
    movedRef.current = true
    setPositions((prev) => {
      const next = prev.slice()
      next[drag] = { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) }
      return next
    })
  }

  const endDrag = () => {
    if (drag !== null && movedRef.current) setMoves((m) => m + 1)
    setDrag(null)
  }

  const replay = () => {
    setPositions(scramble(puzzle.n, puzzle.edges, Math.random).map((p) => ({ ...p })))
    setMoves(0)
    setElapsed(0)
    setRunning(false)
    setSolved(false)
    setDrag(null)
  }

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <h1>Untangle</h1>
          <span className="date">{prettyDate(date)}</span>
        </div>
        <div className="stats">
          <Stat
            label="left"
            value={solved ? '0' : String(crossings)}
            accent={!solved && crossings > 0}
          />
          <Stat label="moves" value={String(moves)} />
          <Stat label="time" value={formatTime(elapsed)} />
        </div>
      </header>

      <div className="board" ref={wrapRef}>
        <svg
          className="canvas"
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <g className="edges">
            {puzzle.edges.map(([a, b], i) => {
              const pa = toPx(positions[a])
              const pb = toPx(positions[b])
              return (
                <line
                  key={i}
                  x1={pa.x}
                  y1={pa.y}
                  x2={pb.x}
                  y2={pb.y}
                  className={tangled[i] ? 'edge tangled' : 'edge clean'}
                />
              )
            })}
          </g>
          <g className="nodes">
            {positions.map((p, i) => {
              const c = toPx(p)
              const active = drag === i
              return (
                <g key={i} className={active ? 'node active' : 'node'}>
                  <circle cx={c.x} cy={c.y} r={NODE_R} className="node-dot" />
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r={HIT_R}
                    className="node-hit"
                    onPointerDown={onPointerDown(i)}
                  />
                </g>
              )
            })}
          </g>
        </svg>

        {solved && (
          <div className="win">
            <div className="win-card">
              <div className="win-spark">✦</div>
              <h2>Untangled!</h2>
              <p className="win-line">
                {formatTime(elapsed)} · {moves} moves
              </p>
              {best && (
                <p className="win-best">
                  best today: {formatTime(best.time)} · {best.moves} moves
                </p>
              )}
              <button className="btn primary" onClick={replay}>
                Play again
              </button>
            </div>
          </div>
        )}
      </div>

      <footer className="bottom">
        <p className="hint">Drag the dots so no lines cross.</p>
        <button className="btn" onClick={replay} disabled={drag !== null}>
          Reshuffle
        </button>
      </footer>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={accent ? 'stat accent' : 'stat'}>
      <span className="stat-val">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}
