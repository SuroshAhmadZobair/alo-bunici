-- Waitlist store. Lives in a D1 database created with --jurisdiction eu (stored and processed in the EU).
-- Rows are deleted 12 months after created_at by the Worker's daily cron, or at once through the delete link.
CREATE TABLE IF NOT EXISTS signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),  -- server time (UTC); also the consent timestamp
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  for_whom TEXT,
  city TEXT,
  lives TEXT,
  price TEXT,
  variant TEXT,
  page TEXT,
  utm TEXT,                    -- JSON: utm_*, fbclid, ttclid (which ad brought the signup)
  ip_country TEXT,             -- two-letter country from Cloudflare; the IP itself is not stored
  consent_v TEXT NOT NULL,     -- version key of the consent text (CONSENT in src/index.js)
  consent_hash TEXT NOT NULL,  -- SHA-256 of the consent text the page actually showed
  consent_match INTEGER NOT NULL DEFAULT 0,  -- 1 when consent_hash equals the stored text of consent_v
  privacy_v TEXT,              -- version of the privacy notice on the page
  del_hash TEXT NOT NULL UNIQUE  -- SHA-256 of the private delete token; the token itself is never stored
);
CREATE INDEX IF NOT EXISTS signups_created_at ON signups(created_at);
