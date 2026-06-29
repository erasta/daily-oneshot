# Daily Pipes

A neon WebGL pipe-rotation puzzle: tap tiles to spin them and wire every pipe
into one fully-connected network powered from the central source — the board is
generated deterministically from the date, so everyone gets the same puzzle.

## How to play

Tap any tile to rotate it 90°. Lit (cyan) pipes are part of the live network
flowing from the glowing source tile. You win when no pipe end is left dangling
and the whole grid lights up. Fewer taps is better — your best is saved per day.

## Run locally

```bash
npm install
npm run dev      # development
npm run build    # type-check + production build into dist/
npm run preview  # serve the production build
```

Built with Vite + React + TypeScript, rendered with [pixi.js](https://pixijs.com)
(WebGL). The day's puzzle is derived from the `YYYY-MM-DD` in the folder
name/URL — no backend, no date literals, no system clock.

## Live URL

Not deployed (served from `apps/2026-06-29-daily-pipes/dist/`).
