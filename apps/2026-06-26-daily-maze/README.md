# Daily Maze

**Date:** 2026-06-26

A fresh 15×15 maze generated deterministically from today's date — solve it with
arrow keys, WASD, or swipe, racing a timer to reach the gold square.

Everyone gets the same maze on the same day (the date seeds the generator), so
there's no server and no randomness — and a brand new maze appears each day.
Your time and step count persist in `localStorage`, so a refresh won't lose a
finished run.

## How to run

```bash
cd apps/2026-06-26-daily-maze
npm install
npm run dev      # local dev server
npm run build    # production bundle in dist/
npm run preview  # serve the built bundle
```

## Controls

- **Arrow keys** or **WASD** — move
- **Swipe** (touch devices) — move in the swipe direction
- **Restart / Play again** — reset the current day's run

## Live URL

Not deployed (build committed in `dist/`; ready to push to any static host).
