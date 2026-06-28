import Game from './Game'
import './App.css'

// The date lives only in the folder/URL slug, derived at runtime.
const FALLBACK_SLUG = '2026-06-28-daily-putt'
const slug =
  location.pathname.match(/\d{4}-\d{2}-\d{2}-[^/]+/)?.[0] ?? FALLBACK_SLUG
const date = slug.slice(0, 10)

export default function App() {
  return (
    <div className="app">
      <h1 className="title">
        Daily <span>Putt</span>
      </h1>
      <Game slug={slug} date={date} />
    </div>
  )
}
