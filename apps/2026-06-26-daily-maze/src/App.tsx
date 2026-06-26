import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  canMove,
  generateMaze,
  seedFromDate,
  type Maze,
} from './maze'

type Dir = 'up' | 'down' | 'left' | 'right'

const GRID = 15 // maze is GRID x GRID cells

// How long the player has spent on today's maze, persisted so a refresh
// doesn't reset the run.
type Saved = {
  date: string
  steps: number
  finishedMs: number | null // elapsed time when solved, or null if unsolved
}

const storageKey = 'daily-maze'

function loadSaved(date: string): Saved {
  try {
    const raw = localStorage.getItem(storageKey)
    if (raw) {
      const parsed = JSON.parse(raw) as Saved
      if (parsed.date === date) return parsed
    }
  } catch {
    // ignore unreadable storage; start fresh
  }
  return { date, steps: 0, finishedMs: null }
}

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function App() {
  // The date lives only in the folder name (.../YYYY-MM-DD-slug/); read it
  // back from the URL so nothing here hardcodes a date.
  const date = location.pathname.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? ''
  const maze: Maze = useMemo(
    () => generateMaze(GRID, GRID, seedFromDate(date)),
    [date],
  )

  const goal = useMemo(() => ({ x: GRID - 1, y: GRID - 1 }), [])

  const [saved, setSaved] = useState<Saved>(() => loadSaved(date))
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [trail, setTrail] = useState<Set<number>>(() => new Set([0]))
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const solved = saved.finishedMs !== null

  // Persist progress whenever it changes.
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(saved))
  }, [saved])

  // Tick the clock a few times a second while a run is in progress.
  useEffect(() => {
    if (startedAt === null || solved) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [startedAt, solved])

  const move = useCallback(
    (dir: Dir) => {
      if (solved) return
      setPos((p) => {
        if (!canMove(maze, p.x, p.y, dir)) return p
        const next = {
          x: p.x + (dir === 'left' ? -1 : dir === 'right' ? 1 : 0),
          y: p.y + (dir === 'up' ? -1 : dir === 'down' ? 1 : 0),
        }
        if (startedAt === null) setStartedAt(Date.now())
        setTrail((t) => {
          const n = new Set(t)
          n.add(next.y * GRID + next.x)
          return n
        })
        setSaved((s) => ({ ...s, steps: s.steps + 1 }))
        if (next.x === goal.x && next.y === goal.y) {
          const elapsed = startedAt === null ? 0 : Date.now() - startedAt
          setSaved((s) => ({ ...s, finishedMs: elapsed }))
        }
        return next
      })
    },
    [maze, solved, startedAt, goal.x, goal.y],
  )

  // Keyboard controls.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
        w: 'up',
        s: 'down',
        a: 'left',
        d: 'right',
      }
      const dir = map[e.key]
      if (dir) {
        e.preventDefault()
        move(dir)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [move])

  // Touch / swipe controls.
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left')
    else move(dy > 0 ? 'down' : 'up')
    touchStart.current = null
  }

  const reset = () => {
    setPos({ x: 0, y: 0 })
    setTrail(new Set([0]))
    setStartedAt(null)
    setNow(Date.now())
    setSaved({ date, steps: 0, finishedMs: null })
  }

  const elapsed = solved
    ? (saved.finishedMs as number)
    : startedAt === null
      ? 0
      : now - startedAt

  return (
    <div className="app" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <header className="head">
        <h1>Daily Maze</h1>
        <p className="date">{date}</p>
      </header>

      <div className="stats">
        <div className="stat">
          <span className="label">Time</span>
          <span className="value">{formatTime(elapsed)}</span>
        </div>
        <div className="stat">
          <span className="label">Steps</span>
          <span className="value">{saved.steps}</span>
        </div>
      </div>

      <MazeBoard
        maze={maze}
        pos={pos}
        goal={goal}
        trail={trail}
        solved={solved}
      />

      {solved ? (
        <div className="win">
          <strong>Solved!</strong> {formatTime(elapsed)} · {saved.steps} steps
        </div>
      ) : (
        <p className="hint">
          Arrow keys, WASD, or swipe to reach the gold square.
        </p>
      )}

      <button className="reset" onClick={reset}>
        {solved ? 'Play again' : 'Restart'}
      </button>

      <footer className="foot">
        Same maze for everyone today. A fresh one is generated each day.
      </footer>
    </div>
  )
}

function MazeBoard({
  maze,
  pos,
  goal,
  trail,
  solved,
}: {
  maze: Maze
  pos: { x: number; y: number }
  goal: { x: number; y: number }
  trail: Set<number>
  solved: boolean
}) {
  const size = 100 / maze.width // each cell as a percentage of the board

  return (
    <div className={`board${solved ? ' solved' : ''}`}>
      <svg viewBox="0 0 100 100" className="maze-svg">
        {/* trail of visited cells */}
        {[...trail].map((idx) => {
          const x = idx % maze.width
          const y = Math.floor(idx / maze.width)
          return (
            <rect
              key={`t-${idx}`}
              x={x * size}
              y={y * size}
              width={size}
              height={size}
              className="trail"
            />
          )
        })}

        {/* goal */}
        <rect
          x={goal.x * size + size * 0.18}
          y={goal.y * size + size * 0.18}
          width={size * 0.64}
          height={size * 0.64}
          rx={size * 0.14}
          className="goal"
        />

        {/* walls */}
        {maze.cells.map((cell, idx) => {
          const x = (idx % maze.width) * size
          const y = Math.floor(idx / maze.width) * size
          return (
            <g key={`w-${idx}`} className="walls">
              {cell.top && <line x1={x} y1={y} x2={x + size} y2={y} />}
              {cell.left && <line x1={x} y1={y} x2={x} y2={y + size} />}
              {cell.right && (
                <line x1={x + size} y1={y} x2={x + size} y2={y + size} />
              )}
              {cell.bottom && (
                <line x1={x} y1={y + size} x2={x + size} y2={y + size} />
              )}
            </g>
          )
        })}

        {/* player */}
        <circle
          cx={pos.x * size + size / 2}
          cy={pos.y * size + size / 2}
          r={size * 0.3}
          className="player"
        />
      </svg>
    </div>
  )
}
