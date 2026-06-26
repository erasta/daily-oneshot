# Daily Oneshot

A new small React app, built and shipped each day by an LLM.

## Daily flow
1. Run `/clear` first for a fresh context, then paste this to Claude:
   ```
   Do the daily oneshot: read DAILY_PROMPT.md and follow it.
   ```
   It reads [`DAILY_PROMPT.md`](./DAILY_PROMPT.md) and follows it.
2. Claude invents a fresh app, scaffolds it with Vite + React + TypeScript,
   builds it, and verifies it runs.
3. The app lands in `apps/YYYY-MM-DD-<slug>/` with its own `README.md`.
4. You push it.

## Run an app locally
```bash
cd apps/YYYY-MM-DD-<slug>
npm install
npm run dev      # local dev server
npm run build    # production bundle in dist/
npm run preview  # serve the built bundle
```

## Layout
```
daily-oneshot/
├── DAILY_PROMPT.md          # the prompt, pasted daily
├── README.md                # this file
└── apps/
    └── YYYY-MM-DD-<slug>/    # one self-contained app per day
```
