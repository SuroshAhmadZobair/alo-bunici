# alo-bunici

Waitlist landing page (direction A) for the voice ordering service. Tracked in SuroshAhmadZobair/voice-agent-demo#27.

- `index.html`: the page, served by GitHub Pages. Fonts are self-hosted in `fonts/` (SIL OFL 1.1), so no visitor request leaves for Google. No cookies, no pixels.
- `#privacy`: the GDPR Art. 13 notice (Romanian). Controller: Ahmad Zobair Surosh, Brașov. Contact is the "Scrie-ne" form inside the notice (`POST /message`), no public email.
- `worker/`: Cloudflare Worker + D1 (`alo-bunici-waitlist-eu`, created with `--jurisdiction eu`).
  - `POST /signup` stores a row with a consent record (server timestamp, `consent_v`, SHA-256 of the text shown, `consent_match`, `privacy_v`, utm/fbclid/ttclid) and returns a private `delete_url`. The page shows it after signup.
  - `POST /message` stores a "Scrie-ne" message in `messages` (reply contact + the same consent record) and returns a private `delete_url`.
  - `GET /delete?t=…` shows a confirm page; `POST /delete` deletes the row (signup or message). Only a hash of the token is stored.
  - Both POSTs are rate limited per IP (signup 5/min, message 3/min); the IP is only the counter key.
  - Read messages: `npx wrangler d1 execute alo-bunici-waitlist-eu --remote --command "SELECT created_at, reply, body FROM messages ORDER BY id DESC"`.
  - A daily cron (`17 3 * * *`) deletes signups and messages older than 12 months.
  - Schema lives in `worker/migrations/`; apply with `wrangler d1 migrations apply alo-bunici-waitlist-eu --remote`.
  - Changing the consent text: add a new version to `CONSENT` in `worker/src/index.js` and bump `CONSENT_V` in `index.html`. Never edit an old version.
- `scripts/alo-bunici-store`: one command that signs in to Cloudflare (browser), creates the EU D1, applies migrations, deploys the Worker, points `FORM_ENDPOINT` at it, pushes, waits for Pages and runs a live `test-lead` proof (insert, read, delete through its own delete link), then prints PASS or FAIL. Safe to rerun. `--dry-run` does it all locally with throwaway git remotes.
