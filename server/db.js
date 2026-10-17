// Persistent storage layer (SQLite). Single-user data model:
// profile/settings live in `settings`, course hierarchy lives as one JSON document per course,
// calendar events live in their own table. All writes are synchronous and durable.
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'platform.db'));
db.pragma('journal_mode = WAL');

db.exec(`
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
`);

const getSettingStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
const setSettingStmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');

function getSetting(key, fallback = null) {
  const row = getSettingStmt.get(key);
  return row ? row.value : fallback;
}
function setSetting(key, value) {
  setSettingStmt.run(key, String(value));
}

const listCourses = db.prepare('SELECT doc FROM courses ORDER BY sort ASC');
const getCourses = db.prepare('SELECT doc FROM courses WHERE id = ?');
const upsertCourse = db.prepare('INSERT INTO courses (id, doc, sort, updatedAt) VALUES (@id, @doc, @sort, @updatedAt) ON CONFLICT(id) DO UPDATE SET doc = @doc, sort = @sort, updatedAt = @updatedAt');
const deleteCourse = db.prepare('DELETE FROM courses WHERE id = ?');

const listEvents = db.prepare('SELECT doc FROM events ORDER BY date ASC');
const getEvent = db.prepare('SELECT doc FROM events WHERE id = ?');
const upsertEvent = db.prepare('INSERT INTO events (id, doc, date, updatedAt) VALUES (@id, @doc, @date, @updatedAt) ON CONFLICT(id) DO UPDATE SET doc = @doc, date = @date, updatedAt = @updatedAt');
const deleteEvent = db.prepare('DELETE FROM events WHERE id = ?');

const api = {
  db,
  getSetting,
  setSetting,
  getCourses() {
    return listCourses.all().map((r) => JSON.parse(r.doc));
  },
  getCourse(id) {
    const r = getCourses.get(id);
    return r ? JSON.parse(r.doc) : null;
  },
  saveCourse(doc, sort) {
    const cur = getCourses.get(doc.id);
    upsertCourse.run({
      id: doc.id,
      doc: JSON.stringify(doc),
      sort: typeof sort === 'number' ? sort : cur ? cur.sort : Date.now(),
      updatedAt: Date.now(),
    });
  },
  removeCourse(id) {
    deleteCourse.run(id);
  },
  getEvents() {
    return listEvents.all().map((r) => JSON.parse(r.doc));
  },
  getEventById(id) {
    const r = getEvent.get(id);
    return r ? JSON.parse(r.doc) : null;
  },
  saveEvent(doc) {
    upsertEvent.run({ id: doc.id, doc: JSON.stringify(doc), date: doc.date || '', updatedAt: Date.now() });
  },
  removeEvent(id) {
    deleteEvent.run(id);
  },
  exportAll() {
    return {
      exportedAt: new Date().toISOString(),
      version: 1,
      profile: JSON.parse(getSetting('profile', '{}')),
      settings: JSON.parse(getSetting('settings', '{}')),
      courses: api.getCourses(),
      events: api.getEvents(),
    };
  },
  importAll(payload) {
    const errors = [];
    const tx = db.transaction(() => {
      if (payload.profile && typeof payload.profile === 'object') setSetting('profile', JSON.stringify(payload.profile));
      if (payload.settings && typeof payload.settings === 'object') setSetting('settings', JSON.stringify(payload.settings));
      for (const c of payload.courses || []) {
        if (!c || !c.id) { errors.push('course without id skipped'); continue; }
        api.saveCourse(c, typeof c.sort === 'number' ? c.sort : undefined);
      }
      for (const e of payload.events || []) {
        if (!e || !e.id) { errors.push('event without id skipped'); continue; }
        api.saveEvent(e);
      }
    });
    tx();
    return errors;
  },
  replaceAll(payload) {
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM courses').run();
      db.prepare('DELETE FROM events').run();
      if (payload.profile) setSetting('profile', JSON.stringify(payload.profile));
      if (payload.settings) setSetting('settings', JSON.stringify(payload.settings));
      for (const c of payload.courses || []) api.saveCourse(c, c.sort);
      for (const e of payload.events || []) api.saveEvent(e);
    });
    tx();
  },
};

module.exports = api;
