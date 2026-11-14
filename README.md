# alo-bunici

Waitlist landing page (direction A) for the voice ordering service. Tracked in SuroshAhmadZobair/voice-agent-demo#27.

- `index.html`: the page, served by GitHub Pages.
- `worker/`: Cloudflare Worker + D1 that stores signups (`POST /signup`). Not deployed yet: needs a Cloudflare account. Once one exists:

```
cd worker
npx wrangler login
npx wrangler d1 create alo-bunici-waitlist   # put the id in wrangler.toml
npx wrangler d1 execute alo-bunici-waitlist --remote --file=schema.sql
npx wrangler deploy
```

Then set `FORM_ENDPOINT` in `index.html` to `https://alo-bunici-waitlist.<subdomain>.workers.dev/signup`. Until then the live form shows an error and stores nothing.
