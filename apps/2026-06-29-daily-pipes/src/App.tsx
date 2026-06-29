import { useEffect, useMemo, useRef, useState } from 'react'
import { PipesGame, type Stats } from './PipesGame'
import './App.css'

const COLS = 5
const ROWS = 7

function useSlug() {
  return useMemo(() => {
    const match = location.pathname.match(/\d{4}-\d{2}-\d{2}-[^/]+/)
    return match?.[0] ?? '2026-06-29-daily-pipes'
  }, [])
}

function prettyDate(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ]
  return `${months[m - 1]} ${d}, ${y}`
}

export default function App() {
  const slug = useSlug()
  const date = slug.slice(0, 10)
  const bestKey = `${slug}:best`

  const [stats, setStats] = useState<Stats>({ moves: 0, solved: false })
  const [best, setBest] = useState<number | null>(() => {
    const raw = localStorage.getItem(bestKey)
    return raw == null ? null : Number(raw)
  })
  const wasSolved = useRef(false)

  useEffect(() => {
    if (stats.solved && !wasSolved.current) {
      wasSolved.current = true
      setBest((prev) => {
        const next = prev == null ? stats.moves : Math.min(prev, stats.moves)
        localStorage.setItem(bestKey, String(next))
        return next
      })
    }
    if (!stats.solved) wasSolved.current = false
  }, [stats.solved, stats.moves, bestKey])

  return (
    <div className="app">
      <header className="bar">
        <div className="title">
          <span className="logo">⌁</span>
          <div>
            <h1>Daily Pipes</h1>
            <p className="sub">{prettyDate(date)}</p>
          </div>
        </div>
        <div className="stats">
          <div className="stat">
            <span className="num">{stats.moves}</span>
            <span className="lbl">taps</span>
          </div>
          <div className="stat">
            <span className="num">{best ?? '—'}</span>
            <span className="lbl">best</span>
          </div>
        </div>
      </header>

      <main className="stage">
        <PipesGame date={date} cols={COLS} rows={ROWS} onStats={setStats} />
        <div className={`win ${stats.solved ? 'show' : ''}`}>
          <div className="win-card">
            <div className="win-glyph">⌁</div>
            <h2>Network online</h2>
            <p>
              Solved in <strong>{stats.moves}</strong> taps
            </p>
          </div>
        </div>
      </main>

      <footer className="hint">
        Tap a tile to rotate it. Wire every pipe into one connected grid.
      </footer>
    </div>
  )
}
