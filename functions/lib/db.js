// D1 storage layer. Same logical model as the old better-sqlite3 module:
// settings (key/value), courses (one JSON document per course + sort order), events.

export function getSetting(env, key, fallback = null) {
  return env.DB.prepare('SELECT value FROM settings WHERE key = ?1').bind(key).first().then((r) => (r ? r.value : fallback));
}

export function setSetting(env, key, value) {
  return env.DB.prepare('INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .bind(key, String(value)).run();
}

export function parseJsonSetting(raw, fallback) {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : fallback;
  } catch {
    return fallback;
  }
}

export async function getCourses(env) {
  const { results } = await env.DB.prepare('SELECT doc FROM courses ORDER BY sort ASC').all();
  return (results || []).map((r) => JSON.parse(r.doc));
}

export async function getCourse(env, id) {
  const row = await env.DB.prepare('SELECT doc FROM courses WHERE id = ?1').bind(id).first();
  return row ? JSON.parse(row.doc) : null;
}

export async function saveCourse(env, doc, sort) {
  let s = sort;
  if (typeof s !== 'number') {
    const cur = await env.DB.prepare('SELECT sort FROM courses WHERE id = ?1').bind(doc.id).first();
    s = cur ? cur.sort : Date.now();
  }
  return env.DB.prepare(
    'INSERT INTO courses (id, doc, sort, updatedAt) VALUES (?1, ?2, ?3, ?4) ' +
    'ON CONFLICT(id) DO UPDATE SET doc = excluded.doc, sort = excluded.sort, updatedAt = excluded.updatedAt'
  ).bind(doc.id, JSON.stringify(doc), s, Date.now()).run();
}

export function removeCourse(env, id) {
  return env.DB.prepare('DELETE FROM courses WHERE id = ?1').bind(id).run();
}

export async function getEvents(env) {
  const { results } = await env.DB.prepare('SELECT doc FROM events ORDER BY date ASC').all();
  return (results || []).map((r) => JSON.parse(r.doc));
}

export async function getEventById(env, id) {
  const row = await env.DB.prepare('SELECT doc FROM events WHERE id = ?1').bind(id).first();
  return row ? JSON.parse(row.doc) : null;
}

export function saveEvent(env, doc) {
  return env.DB.prepare(
    'INSERT INTO events (id, doc, date, updatedAt) VALUES (?1, ?2, ?3, ?4) ' +
    'ON CONFLICT(id) DO UPDATE SET doc = excluded.doc, date = excluded.date, updatedAt = excluded.updatedAt'
  ).bind(doc.id, JSON.stringify(doc), doc.date || '', Date.now()).run();
}

export function removeEvent(env, id) {
  return env.DB.prepare('DELETE FROM events WHERE id = ?1').bind(id).run();
}

export async function exportAll(env) {
  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    profile: parseJsonSetting(await getSetting(env, 'profile', '{}'), {}),
    settings: parseJsonSetting(await getSetting(env, 'settings', '{}'), {}),
    courses: await getCourses(env),
    events: await getEvents(env),
  };
}

const UPSERT_SETTING = 'INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value';
const UPSERT_COURSE =
  'INSERT INTO courses (id, doc, sort, updatedAt) VALUES (?1, ?2, ?3, ?4) ' +
  'ON CONFLICT(id) DO UPDATE SET doc = excluded.doc, sort = excluded.sort, updatedAt = excluded.updatedAt';
const UPSERT_EVENT =
  'INSERT INTO events (id, doc, date, updatedAt) VALUES (?1, ?2, ?3, ?4) ' +
  'ON CONFLICT(id) DO UPDATE SET doc = excluded.doc, date = excluded.date, updatedAt = excluded.updatedAt';

export async function importAll(env, payload) {
  const errors = [];
  const batch = [];
  if (payload.profile && typeof payload.profile === 'object') {
    batch.push(env.DB.prepare(UPSERT_SETTING).bind('profile', JSON.stringify(payload.profile)));
  }
  if (payload.settings && typeof payload.settings === 'object') {
    batch.push(env.DB.prepare(UPSERT_SETTING).bind('settings', JSON.stringify(payload.settings)));
  }
  for (const c of payload.courses || []) {
    if (!c || !c.id) { errors.push('course without id skipped'); continue; }
    batch.push(env.DB.prepare(UPSERT_COURSE)
      .bind(c.id, JSON.stringify(c), typeof c.sort === 'number' ? c.sort : Date.now(), Date.now()));
  }
  for (const e of payload.events || []) {
    if (!e || !e.id) { errors.push('event without id skipped'); continue; }
    batch.push(env.DB.prepare(UPSERT_EVENT)
      .bind(e.id, JSON.stringify(e), e.date || '', Date.now()));
  }
  if (batch.length) await env.DB.batch(batch);
  return errors;
}

export async function replaceAll(env, payload) {
  const batch = [env.DB.prepare('DELETE FROM courses'), env.DB.prepare('DELETE FROM events')];
  if (payload.profile) {
    batch.push(env.DB.prepare(UPSERT_SETTING).bind('profile', JSON.stringify(payload.profile)));
  }
  if (payload.settings) {
    batch.push(env.DB.prepare(UPSERT_SETTING).bind('settings', JSON.stringify(payload.settings)));
  }
  for (const c of payload.courses || []) {
    if (!c || !c.id) continue;
    batch.push(env.DB.prepare(UPSERT_COURSE)
      .bind(c.id, JSON.stringify(c), typeof c.sort === 'number' ? c.sort : Date.now(), Date.now()));
  }
  for (const e of payload.events || []) {
    if (!e || !e.id) continue;
    batch.push(env.DB.prepare(UPSERT_EVENT)
      .bind(e.id, JSON.stringify(e), e.date || '', Date.now()));
  }
  await env.DB.batch(batch);
}
