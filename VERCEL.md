# Deploy to Vercel

Wario Dashboard can be deployed as a static site to Vercel, but note: the live data API requires a backend. If you want remote read, see the "push-based" approach below.

## Option 1: Local‑only (default)

Run the server locally:

```bash
./wario-dashboard
# Open http://localhost:8080
```

No Vercel needed.

## Option 2: Vercel + Push (remote read)

1. In `server.py`, the `/api/status` endpoint reads local files. For Vercel we need a proxy. Instead:
   - Add a script `push_status.py` that writes `public/status.json` (committed to repo).
   - Run that script via cron every minute on your Mac.
2. Change `app.js` to fetch `/status.json` instead of `/api/status`.
3. Connect this repo to Vercel. It will deploy the static site.
4. The `status.json` updates every minute via your local push script.

That gives you a read‑only remote dashboard.

## Steps for Option 2 (coming soon)

- [ ] Create `scripts/push_status.py` to generate `public/status.json`
- [ ] Add cron: `* * * * * bash ~/.openclaw/workspace/scripts/push_status.sh`
- [ ] Update frontend to fetch relative `status.json`
