# Daily Oneshot — Prompt

Just tell Claude **"do the daily oneshot"** and it will read and follow the
block below. (You can also paste the block verbatim if you prefer.)

---

```
DAILY ONESHOT

Build and ship a small web app today. Rules:

1. PICK A NOVEL IDEA
   - First list ./apps/ to see every app built so far (each folder is
     named YYYY-MM-DD-<slug>). Read an app's own README.md if you need
     more than the slug. Your idea must be meaningfully different from all
     of them — different category, mechanic, purpose, and visual medium
     (e.g. don't ship two plain-React/SVG apps in a row). No near-dupes.
   - Invent ONE app. It must be fully completable and deployable in a
     single session. Favor self-contained apps with no backend: if it
     needs "daily"/changing content, derive it deterministically from the
     date so no server is required.
   - When an app's content depends on "today's date", the date must live
     ONLY in the app's folder name. Don't hardcode a date literal anywhere
     (no `const date = '2026-06-26'`) and don't read the system clock (no
     `new Date()`). Instead derive the full slug at runtime from the folder
     name in the URL path and take the date from it, e.g.
     `const slug = location.pathname.match(/\d{4}-\d{2}-\d{2}-[^/]+/)?.[0] ?? '<this-app-slug>'`
     then `const date = slug.slice(0, 10)`, so the built app always shows
     that day's content no matter when it's opened.
   - Don't ask me to choose or approve the idea. Just pick the best one
     and go. Tell me what you chose in one sentence before building.

2. CONSTRAINTS
   - Stack is always Vite + React + TypeScript. No exceptions.
   - Lean on popular, well-loved client-side libraries to make the app look
     and feel great — don't build everything from scratch in plain React.
     Pick whatever best fits the idea, and vary the choice day to day so the
     collection stays diverse. Some good ones (not a closed list):
       - three.js (3D / WebGL), or react-three-fiber for a React-friendly API
       - pixi.js (fast 2D / WebGL canvas), p5.js (creative coding)
       - leaflet / maplibre-gl (interactive maps), d3 (data viz)
       - matter.js / rapier (physics), tone.js / howler (audio)
       - framer-motion / gsap (animation), pixi-filters, regl, etc.
     Install them as normal npm deps. Keep it client-side only (no API keys,
     no paid tiers); for maps use a free no-key tile source. Make sure every
     added dep still passes the type-check / lint / build gates below.
   - Keep scope ruthlessly small: one screen, one core interaction,
     something genuinely fun or useful. Polish over feature count.
   - No accounts, no database, no paid services. localStorage is fine, but
     all apps are served from one origin (the GitHub Pages domain), so they
     share one localStorage. Namespace every key with the full folder slug
     (e.g. use the `slug` derived above as the key, or prefix keys with it)
     so apps can't clobber each other's saved state.

3. BUILD IT — ZERO ERRORS
   - Put each day's app in its own folder: ./apps/YYYY-MM-DD-<slug>/
   - Make it actually run: install, build, and verify it works before
     calling it done. Fix what's broken.
   - It MUST pass all three with zero errors and zero warnings before you
     call it done — fix every issue, no suppressions or `// @ts-ignore`:
       - type check:  `tsc --noEmit`
       - lint:        use whatever linter the Vite scaffold ships by
                      default (e.g. `oxlint`); don't swap it out
       - build:       `vite build`

4. BUILD IT FOR PRODUCTION
   - Always produce a working production bundle with `vite build` and
     confirm it actually serves (e.g. `vite preview`). I'll push/deploy it
     myself.
   - Set Vite `base` to './' (relative) so the built app works no matter
     what subpath it's served from.
   - The built `dist/` MUST be committed (the landing page links to
     `apps/<slug>/dist/`). Vite scaffolds a per-app `.gitignore` that
     ignores `dist` — delete that file. The repo-root `.gitignore`
     already ignores `node_modules` for every app, so nothing else in the
     app folder needs its own `.gitignore`.

5. RECORD IT
   - Write a README.md inside the day's app folder with: the app name, a
     one-sentence description, how to run it, and the live URL (or "not
     deployed"). Don't restate the date in the README — the folder name
     already carries it. The folder name + this README is what stops you
     from repeating ideas.

6. WRAP UP
   - End with: what you built, how to run it locally, the deploy status,
     and a ready-to-use commit message for the day's changes.
```

---

## Notes

- **Everything lives in this project folder** — the `apps/` folders and
  nothing outside. No external/persistent memory is used.
- **Each app is self-describing.** Its own `README.md` holds the one-line
  description; the `apps/` listing is the history that prevents repeats.
  There's no central index file to maintain.
- **Deploy credentials:** if you want auto-deploy, set up a free static
  host (e.g. Netlify/Vercel/GitHub Pages) once and tell me the method.
  Until then I'll hand you a build + one-line deploy command.
- **Tech stack is fixed:** Vite + React + TypeScript, every day.
