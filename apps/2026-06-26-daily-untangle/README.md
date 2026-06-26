# Daily Untangle

A fresh neon "constellation" to untangle each day — drag the glowing dots until
no two lines cross, racing the clock and your move count.

Each day's graph is built from a Delaunay triangulation of date-seeded points, so
it is **always** untangle-able, and everyone gets the exact same puzzle on the
same day. Crossed lines glow red, clean lines glow teal, and a live counter shows
how many crossings are left. There's no server and no randomness at runtime — a
brand new tangle appears each day. Your best time and move count for the day
persist in `localStorage` (namespaced by the app's folder slug). Built with React
+ SVG and `d3-delaunay`.

The date is derived only from the folder name in the URL path, so the built app
always shows that day's puzzle no matter when it's opened.

## How to run

From this app's folder:

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + production bundle in dist/
npm run preview  # serve the built bundle
```

## How to play

- Drag any dot. Lines that still cross glow **red**; lines that are clear glow
  **teal**.
- Get the "left" counter to **0** to win — every puzzle is guaranteed solvable.
- **Reshuffle** re-scrambles the same graph for another attempt; the clock starts
  on your first drag.

Touch-first: tap-and-drag with large (≥44px) hit areas, full-height `100dvh`
layout, and safe-area padding. Works in portrait on a ~375px phone and scales up
to desktop.

## Live URL

Not deployed (build is committed in `dist/`).
