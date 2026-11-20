-- "Scrie-ne" contact messages from the privacy notice. Same retention (12 months, daily cron) and delete link as signups.
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),  -- server time (UTC); also the consent timestamp
  body TEXT NOT NULL,          -- the message, at most 2000 characters
  reply TEXT NOT NULL,         -- email or phone to answer on
  page TEXT,
  ip_country TEXT,             -- two-letter country from Cloudflare; the IP itself is not stored
  consent_v TEXT NOT NULL,     -- version key of the consent text (CONSENT in src/index.js), '' if none sent
  consent_hash TEXT NOT NULL,  -- SHA-256 of the consent text the page sent ("none" if it sent none)
  consent_match INTEGER NOT NULL DEFAULT 0,
  privacy_v TEXT,
  del_hash TEXT NOT NULL UNIQUE  -- SHA-256 of the private delete token
);
CREATE INDEX IF NOT EXISTS messages_created_at ON messages(created_at);
