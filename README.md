# alo-bunici

Waitlist landing page (direction A) for the voice ordering service. Tracked in SuroshAhmadZobair/voice-agent-demo#27.

- `index.html`: the page, served by GitHub Pages.
- `worker/`: Cloudflare Worker + D1 that stores signups (`POST /signup`).
- `scripts/alo-bunici-store`: one command that signs in to Cloudflare (browser), creates D1, applies the schema, deploys the Worker, points `FORM_ENDPOINT` at it, pushes, waits for Pages and runs a live `test-lead` proof (insert, read, delete), then prints PASS or FAIL. Safe to rerun. `--dry-run` does it all locally with throwaway git remotes.

Until the store is deployed the live form shows an error and stores nothing.
