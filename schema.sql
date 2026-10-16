CREATE TABLE titles (
  id INTEGER PRIMARY KEY,           -- id do AniList
  mangadex_id TEXT,
  title TEXT NOT NULL,
  synopsis TEXT,
  cover_url TEXT,
  genres TEXT,                      -- JSON array
  status TEXT
);
CREATE TABLE reading_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title_id INTEGER NOT NULL REFERENCES titles(id),
  platform TEXT NOT NULL,
  url TEXT NOT NULL,
  is_free INTEGER NOT NULL DEFAULT 0,
  access_type TEXT,                 -- free | purchase
  official_status TEXT NOT NULL CHECK (official_status IN ('official','author_published','unknown')),
  last_checked_at TEXT,
  UNIQUE(title_id, url)
);
