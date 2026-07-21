# TimeSlice

TimeSlice is a local-first productivity timer with Session, Daily, Single Activity,
and Flowmodoro modes. It is a Vite + React progressive web app.

## Development

- `npm run dev` — start the development server at `http://127.0.0.1:5173`.
- `npm run build` — create the production bundle.
- `npm run preview` — serve the production bundle at `http://127.0.0.1:4173`.
- `npm run lint` / `npm run typecheck` / `npm run format:check` — static checks.
- `npm run test` — persistence and time-calculation unit tests.
- `npm run test:e2e` — Chromium desktop/mobile workspace smoke tests. Run
  `npx playwright install chromium` once after installing dependencies.

## Local data

TimeSlice now uses IndexedDB as its primary local database. On first launch it
copies the existing `timeslice.state.v2` envelope and any missing legacy
`timeSlice*` values into a versioned database without changing or deleting the
old localStorage keys. Timers use persisted timestamps rather than persisted
per-second counters; an installed PWA can request protected device storage from
Timer Settings. A second open TimeSlice window is view-only until it explicitly
takes control.

## PWA behavior

The service worker uses a network-first app shell and runtime-caches successful
same-origin responses. A normal refresh receives updated deployments; after an
online visit, the last visited shell is also available offline.
