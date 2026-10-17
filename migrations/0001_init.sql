-- 0001: base schema (identical to the local SQLite schema of the Node server).
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  doc TEXT NOT NULL,
  sort REAL NOT NULL DEFAULT 0,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  doc TEXT NOT NULL,
  date TEXT NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_courses_sort ON courses(sort);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
