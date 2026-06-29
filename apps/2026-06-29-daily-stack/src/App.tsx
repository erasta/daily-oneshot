import { useEffect, useMemo, useRef, useState } from 'react'
import { getDaily } from './daily'
import { StackGame, type Snapshot } from './game'

export default function App() {
  const daily = useMemo(() => getDaily(), [])
  const mountRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<StackGame | null>(null)
  const [snap, setSnap] = useState<Snapshot>({
    score: 0,
    best: 0,
    combo: 0,
    target: daily.target,
    reached: false,
    state: 'playing',
    perfectFlash: 0,
  })
  const [started, setStarted] = useState(false)

  useEffect(() => {
    if (!mountRef.current) return
    const game = new StackGame(mountRef.current, daily, setSnap)
    gameRef.current = game
    return () => {
      game.dispose()
      gameRef.current = null
    }
  }, [daily])

  // Hide the "tap to drop" hint as soon as the first block is placed.
  useEffect(() => {
    if (snap.score > 0) setStarted(true)
  }, [snap.score])

  const playing = snap.state === 'playing'

  return (
    <div
      className="stage"
      ref={mountRef}
      style={{ background: `linear-gradient(${daily.bgTop}, ${daily.bgBottom})` }}
    >
      <div className="hud">
        <div className="hud-top">
          <div className="score">
            <span className="score-num">{snap.score}</span>
            <span className="score-label">height</span>
          </div>
          <div className="stats">
            <div className="stat">
              <span className="stat-val">{snap.best}</span>
              <span className="stat-key">best</span>
            </div>
            <div className={`stat ${snap.reached ? 'hit' : ''}`}>
              <span className="stat-val">{snap.target}</span>
              <span className="stat-key">target</span>
            </div>
          </div>
        </div>

        <div className="theme">{daily.themeName} · {daily.date}</div>

        {snap.combo > 1 && playing && (
          <div className="combo">{snap.combo}× perfect</div>
        )}

        {snap.perfectFlash > 0 && playing && (
          <div key={snap.perfectFlash} className="perfect">PERFECT</div>
        )}

        {!started && playing && (
          <div className="hint">tap to drop the block</div>
        )}
      </div>

      {!playing && (
        <div className="overlay">
          <div className="card">
            <h1>Tower toppled</h1>
            <p className="final">
              height <b>{snap.score}</b>
            </p>
            <p className="sub">
              {snap.reached
                ? `cleared today's target of ${snap.target} 🎉`
                : `today's target: ${snap.target}`}
              {' · '}best {snap.best}
            </p>
            <button type="button" onClick={() => gameRef.current?.restart()}>
              Play again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
