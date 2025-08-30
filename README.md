## TimeSlice (Vite + React)

### Scripts

- Dev (HMR): `npm run dev` → http://127.0.0.1:5173
- Build: `npm run build`
- Preview (static build): `npm run preview` → http://127.0.0.1:4173
- Build & Preview: `npm run serve`

Preview is pinned to host 127.0.0.1 and port 4173 so your browser URL remains stable between changes.

### Stable preview during iterations

If the page doesn’t load or shows stale assets:

1) Hard refresh to bypass the service worker cache: Ctrl+F5
2) If still stale, open DevTools → Application → Service Workers → Unregister → refresh
3) Make sure only one preview is running; close extra terminals and re-run `npm run preview`
4) Rebuild to bump the cache manifest: `npm run build`

### Troubleshooting

- ERR_CONNECTION_REFUSED on 127.0.0.1:4173: ensure preview is running (one process) and the port isn’t blocked by another app.
- Switching between dev and preview: dev uses 5173, preview uses 4173; use the correct URL for each.
