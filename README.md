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

The refreshed app writes its state to a versioned `timeslice.state.v2` localStorage
envelope. It intentionally does not import, modify, or delete legacy `timeSlice*`
keys, so rolling back to a previous build remains possible.

## PWA behavior

The service worker uses a network-first app shell and runtime-caches successful
same-origin responses. A normal refresh receives updated deployments; after an
online visit, the last visited shell is also available offline.
