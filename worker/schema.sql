CREATE TABLE IF NOT EXISTS signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  for_whom TEXT,
  city TEXT,
  lives TEXT,
  price TEXT,
  variant TEXT,
  page TEXT,
  utm TEXT,
  ip_country TEXT
);
