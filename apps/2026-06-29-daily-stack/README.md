# Daily Stack

A one-tap 3D tower-stacking game: a block slides back and forth above the tower —
tap to drop it, the overhang gets sliced off, and you stack as high as you can
before a block misses completely.

The day's color palette, sliding pace, and target height are all derived
deterministically from the date in the folder/URL slug, so everyone gets the same
theme and the same number to beat — no server, no system clock. Land a block dead
center for a **perfect** drop: it snaps, regrows a little, and builds a combo.

Built with **three.js** (WebGL), orthographic "isometric" camera. No sound.

## How to play

- **Tap anywhere** (or press **Space** / **Enter** / **↓**) to drop the moving
  block onto the tower.
- The part hanging over the block below is sliced off and tumbles away — the rest
  becomes the new top, so the tower gets narrower as you climb.
- A near-perfect drop snaps into place, regrows the block slightly, and starts a
  perfect combo.
- Miss the block below entirely and the run ends. Beat the **daily target**, and
  chase your **best** for the day (saved locally).

Fully touch-first and mobile-first; works with a mouse/keyboard on desktop too.

## How it works

- The date is read **only** from the folder name in the URL path
  (`/\d{4}-\d{2}-\d{2}-[^/]+/`), never from a hardcoded literal or the system
  clock, so the built app always shows that day's theme.
- A string hash of the slug seeds a small deterministic generator that picks the
  base hue, per-level hue rotation, sky gradient, pace, target, and theme name.
- Your best height is stored in `localStorage` under the full app slug, so it
  never clobbers the other daily apps sharing the same origin.

## How to run

From this app's folder:

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + production bundle into dist/
npm run preview  # serve the production build
```

## Live URL

Not deployed yet — serve `dist/` from any static host (the repo's landing page
links to `apps/2026-06-29-daily-stack/dist/`).
