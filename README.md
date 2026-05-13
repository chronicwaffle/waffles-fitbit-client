# waffles-fitbit-client

Personal app to give insights on health data.

This application is for personal use only. No data is shared with third parties.

## OAuth login flow (phone-friendly)

This repo now supports an **ephemeral local callback server** for OAuth login:

1. Set `FITBIT_REDIRECT_URI` to a reverse-proxied URL (for example `https://auth.jasonminiserver.local/fitbit`).
2. Route that path to `localhost:3000` on the machine running this CLI (for example with Caddy + Tailscale/LAN).
3. Run:

```bash
npm run login
```

The CLI prints an authorization URL, starts a tiny one-shot Node HTTP server on port 3000, waits for `?code=...`, exchanges it for tokens, then shuts the server down immediately.

No Express callback server is required for this login path.
