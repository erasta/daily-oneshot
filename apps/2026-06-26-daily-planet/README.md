# Daily Planet

A procedurally generated low-poly 3D world — terrain, oceans, an atmospheric
glow, and a starfield — that you can orbit and zoom, uniquely seeded from
today's date so everyone sees the same planet on the same day.

The date drives a deterministic seed, which picks the biome (Terran, Desert,
Glacial, Verdant, Volcanic, or Alien), sculpts the continents and mountains with
layered simplex noise, names the world, and occasionally gives it a ring. No
server, no randomness at runtime — a brand new planet appears each day. Built
with react-three-fiber / three.js.

## How to run

From this app's folder:

```bash
npm install
npm run dev      # local dev server
npm run build    # production bundle in dist/
npm run preview  # serve the built bundle
```

## Controls

- **Drag** — orbit the camera around the planet
- **Scroll / pinch** — zoom in and out
- The planet and camera also drift on their own

## Live URL

Not deployed (build committed in `dist/`; ready to push to any static host).
