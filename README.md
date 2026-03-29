# Wario Dashboard

Local dashboard for the Wario Life Agent.

## Quick Start

```bash
# From the wario-dashboard folder:
./wario-dashboard
# Then open http://localhost:8080 in your browser
```

The dashboard shows:
- Cron job health (✅/❌, last run times)
- Dispatcher queue status (backlog count)
- Recent logs (dispatcher, cron errors)
- System info (last git commit, memory files)

## Dark Mode

Click the 🌙 button to toggle.

## Architecture

- `server.py` — Python HTTP server that reads your `~/.openclaw/workspace` and serves a JSON API.
- `index.html` + `style.css` + `app.js` — frontend.

## Deployment (Optional)

To deploy static version to Vercel (no live data), see VERICELL.md.

## Related

Part of the Wario Life Agent system. See `~/.openclaw/workspace/` for core agents, cron jobs, memory, and upgrades.
