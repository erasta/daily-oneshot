# Daily Putt

A one-screen, top-down mini-golf hole generated deterministically from the
date — pull back from the ball slingshot-style to aim and set power, then
release to putt past walls and sand traps into the cup in as few strokes as
possible.

The course layout (ball start, hole, obstacle blocks, sand, and par) is derived
entirely from the date in the folder/URL slug, so everyone gets the same hole on
the same day with no server. Real ball physics — bounce, roll, and friction —
are handled by [matter.js](https://brm.io/matter-js/); your best score is saved
in `localStorage` (namespaced by the app slug).

## Controls

- **Drag back** from the ball and **release** to putt — the further you pull,
  the more power (the arrow shows aim + strength).
- Sand traps sharply slow the ball; bounce off walls and obstacles to set up
  the next shot.
- Fully touch-first (tap / drag); works with a mouse too.

## Run locally

```bash
npm install
npm run dev      # development
npm run build    # production build into dist/
npm run preview  # serve the production build
```

## Live URL

Not deployed (served from `apps/<slug>/dist/` on the project's GitHub Pages site).
