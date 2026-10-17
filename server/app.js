// Express application: auth-protected JSON API + static frontend.
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const store = require('./db');
const auth = require('./auth');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(express.json({ limit: '12mb' }));
app.use(cookieParser());

auth.ensureSetup();

// ---- helpers -------------------------------------------------------------
const uid = () => crypto.randomUUID();

// ---- login rate limiting (in-memory) --------------------------------------
const attempts = new Map(); // ip -> { count, ts }
function tooManyAttempts(ip) {
  const a = attempts.get(ip);
  if (!a) return false;
  if (Date.now() - a.ts > 5 * 60 * 1000) { attempts.delete(ip); return false; }
  return a.count >= 8;
}
function registerAttempt(ip, ok) {
  const a = attempts.get(ip) || { count: 0, ts: Date.now() };
  if (ok) attempts.delete(ip);
  else { a.count += 1; a.ts = Date.now(); attempts.set(ip, a); }
}

// ---- session middleware ----------------------------------------------------
function parseSession(req) {
  const token = req.cookies && req.cookies.session;
  if (!token) return null;
  return auth.verifySessionToken(token);
}

function requireAuth(req, res, next) {
  const sess = parseSession(req);
  if (!sess) return res.status(401).json({ error: 'unauthorized' });
  req.session = sess;
  next();
}

function requireCsrf(req, res, next) {
  const sess = req.session || parseSession(req);
  if (!sess) return res.status(401).json({ error: 'unauthorized' });
  const token = req.get('x-csrf-token') || '';
  const expected = auth.createCsrfToken(sess.sid);
  if (token.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
    return res.status(403).json({ error: 'csrf' });
  }
  next();
}

// ---- validation ------------------------------------------------------------
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
function badId(id) { return typeof id !== 'string' || !ID_RE.test(id); }
function str(v, max = 5000) { return typeof v === 'string' ? v.slice(0, max) : ''; }
function DATE_RE(d) { return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d); }

function sanitizeLink(l) {
  if (!l || typeof l !== 'object') return null;
  const url = str(l.url, 2000).trim();
  if (!url) return null;
  if (!/^(https?:\/\/|mailto:)/i.test(url)) return null;
  return { id: badId(l.id) ? uid() : l.id, url, text: str(l.text, 300).trim() };
}

function sanitizeCriterion(c) {
  if (!c || typeof c !== 'object') return null;
  return {
    id: badId(c.id) ? uid() : c.id,
    text: str(c.text, 500),
    done: !!c.done,
    score: typeof c.score === 'number' && c.score >= 0 && c.score <= 5 ? c.score : null,
  };
}

const GRADES = [1, 2, 3, 4, 5];

function sanitizeTask(t) {
  if (!t || typeof t !== 'object') return null;
  const grade = typeof t.grade === 'number' && GRADES.includes(t.grade) ? t.grade : null;
  return {
    id: badId(t.id) ? uid() : t.id,
    title: str(t.title, 300),
    description: str(t.description, 5000),
    date: DATE_RE(t.date) ? t.date : null,
    criteria: Array.isArray(t.criteria) ? t.criteria.map(sanitizeCriterion).filter(Boolean).slice(0, 50) : [],
    links: Array.isArray(t.links) ? t.links.map(sanitizeLink).filter(Boolean).slice(0, 50) : [],
    done: !!t.done,
    grade,
  };
}

function sanitizeTopic(tp) {
  if (!tp || typeof tp !== 'object') return null;
  return {
    id: badId(tp.id) ? uid() : tp.id,
    title: str(tp.title, 300),
    content: str(tp.content, 20000),
    date: DATE_RE(tp.date) ? tp.date : null,
    links: Array.isArray(tp.links) ? tp.links.map(sanitizeLink).filter(Boolean).slice(0, 50) : [],
    done: !!tp.done,
    tasks: Array.isArray(tp.tasks) ? tp.tasks.map(sanitizeTask).filter(Boolean).slice(0, 100) : [],
  };
}

function sanitizeDiscipline(d) {
  if (!d || typeof d !== 'object') return null;
  return {
    id: badId(d.id) ? uid() : d.id,
    title: str(d.title, 300),
    description: str(d.description, 5000),
    topics: Array.isArray(d.topics) ? d.topics.map(sanitizeTopic).filter(Boolean).slice(0, 200) : [],
  };
}

function sanitizeProject(p) {
  if (!p || typeof p !== 'object') return null;
  const icon = /^[\w-]{1,40}$/.test(str(p.icon)) ? p.icon : 'flag';
  return {
    enabled: !!p.enabled,
    title: str(p.title, 300),
    description: str(p.description, 5000),
    dueDate: DATE_RE(p.dueDate) ? p.dueDate : null,
    icon,
    criteria: Array.isArray(p.criteria) ? p.criteria.map(sanitizeCriterion).filter(Boolean).slice(0, 50) : [],
    refs: Array.isArray(p.refs)
      ? p.refs.map((r) => {
          const link = sanitizeLink(r);
          return link ? { ...link, title: str(r.title, 300).trim() } : null;
        }).filter(Boolean).slice(0, 50)
      : [],
    status: ['todo', 'in-progress', 'done'].includes(p.status) ? p.status : 'todo',
    score: typeof p.score === 'number' && p.score >= 1 && p.score <= 5 ? p.score : null,
  };
}

function sanitizeModule(m) {
  if (!m || typeof m !== 'object') return null;
  return {
    id: badId(m.id) ? uid() : m.id,
    title: str(m.title, 300),
    description: str(m.description, 5000),
    tags: Array.isArray(m.tags) ? m.tags.slice(0, 6).map((t) => str(typeof t === 'string' ? t : t.name, 40).trim()).filter(Boolean) : [],
    disciplines: Array.isArray(m.disciplines) ? m.disciplines.map(sanitizeDiscipline).filter(Boolean).slice(0, 100) : [],
    project: sanitizeProject(m.project),
  };
}

function sanitizeCourseDoc(doc) {
  if (!doc || typeof doc !== 'object') return null;
  return {
    id: badId(doc.id) ? uid() : doc.id,
    title: str(doc.title, 300),
    description: str(doc.description, 5000),
    modules: Array.isArray(doc.modules) ? doc.modules.map(sanitizeModule).filter(Boolean).slice(0, 100) : [],
  };
}

function sanitizeEvent(e) {
  if (!e || typeof e !== 'object') return null;
  const color = /^#[0-9a-fA-F]{6}$/.test(str(e.color)) ? e.color : '#3b82f6';
  const icon = /^[\w-]{1,40}$/.test(str(e.icon)) ? e.icon : 'calendar-days';
  const time = typeof e.time === 'string' && /^\d{2}:\d{2}$/.test(e.time) ? e.time : null;
  return {
    id: badId(e.id) ? uid() : e.id,
    title: str(e.title, 300),
    description: str(e.description, 5000),
    date: DATE_RE(e.date) ? e.date : null,
    time,
    icon,
    color,
  };
}

// ---- routes -----------------------------------------------------------------
app.post('/api/login', (req, res) => {
  const ip = req.ip || 'unknown';
  if (tooManyAttempts(ip)) return res.status(429).json({ error: 'too-many-attempts' });
  const password = str(req.body && req.body.password, 200);
  const token = auth.login(password);
  if (!token) { registerAttempt(ip, false); return res.status(401).json({ error: 'bad-password' }); }
  registerAttempt(ip, true);
  const payload = auth.verifySessionToken(token);
  res.cookie('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure || req.get('x-forwarded-proto') === 'https',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
  res.json({ csrf: auth.createCsrfToken(payload.sid), profile: JSON.parse(store.getSetting('profile', '{}')) });
});

app.post('/api/logout', requireAuth, (req, res) => {
  res.clearCookie('session');
  res.json({ ok: true });
});

app.get('/api/session', (req, res) => {
  const sess = parseSession(req);
  if (!sess) return res.status(401).json({ error: 'unauthorized' });
  res.json({
    csrf: auth.createCsrfToken(sess.sid),
    profile: JSON.parse(store.getSetting('profile', '{}')),
    settings: JSON.parse(store.getSetting('settings', '{}')),
    hasPasswordConfigured: store.getSetting('password_configured') === '1',
  });
});

app.get('/api/state', requireAuth, (req, res) => {
  res.json({
    courses: store.getCourses(),
    events: store.getEvents(),
    profile: JSON.parse(store.getSetting('profile', '{}')),
    settings: JSON.parse(store.getSetting('settings', '{}')),
  });
});

app.put('/api/profile', requireAuth, requireCsrf, (req, res) => {
  const p = req.body || {};
  const profile = {
    name: str(p.name, 100).trim() || 'Студент',
    avatar: /^[\w-]{1,40}$/.test(str(p.avatar)) ? p.avatar : 'user',
    avatarColor: /^#[0-9a-fA-F]{6}$/.test(str(p.avatarColor)) ? p.avatarColor : '#6366f1',
    banner: /^[\w-]{1,40}$/.test(str(p.banner)) ? p.banner : 'banner1',
  };
  store.setSetting('profile', JSON.stringify(profile));
  res.json({ profile });
});

app.put('/api/settings', requireAuth, requireCsrf, (req, res) => {
  const s = req.body || {};
  const cur = JSON.parse(store.getSetting('settings', '{}'));
  const next = { ...cur };
  if (typeof s.theme === 'string' && ['light', 'dark'].includes(s.theme)) next.theme = s.theme;
  if (typeof s.primaryCourseId === 'string' || s.primaryCourseId === null) next.primaryCourseId = badId(String(s.primaryCourseId || '')) && s.primaryCourseId ? null : s.primaryCourseId || null;
  if (typeof s.completedHidden === 'boolean') next.completedHidden = s.completedHidden;
  store.setSetting('settings', JSON.stringify(next));
  res.json({ settings: next });
});

app.post('/api/password', requireAuth, requireCsrf, (req, res) => {
  const oldP = str(req.body && req.body.oldPassword, 200);
  const newP = str(req.body && req.body.newPassword, 200);
  const result = auth.changePassword(oldP, newP);
  if (result === 'short') return res.status(400).json({ error: 'password-too-short' });
  if (result !== true) return res.status(400).json({ error: 'wrong-old-password' });
  store.setSetting('password_configured', '1');
  res.json({ ok: true });
});

// Courses CRUD
app.get('/api/courses', requireAuth, (req, res) => res.json({ courses: store.getCourses() }));

app.get('/api/courses/:id', requireAuth, (req, res) => {
  const doc = store.getCourse(req.params.id);
  if (!doc) return res.status(404).json({ error: 'not-found' });
  res.json({ course: doc });
});

app.post('/api/courses', requireAuth, requireCsrf, (req, res) => {
  const doc = sanitizeCourseDoc({ ...req.body, id: uid() });
  if (!doc) return res.status(400).json({ error: 'invalid-course' });
  if (!doc.title) doc.title = 'Новый курс';
  const all = store.getCourses();
  store.saveCourse(doc, all.length ? Math.max(...all.map((c) => c.sort || 0)) + 1 : 1);
  res.json({ course: doc });
});

app.put('/api/courses/:id', requireAuth, requireCsrf, (req, res) => {
  const { id } = req.params;
  if (badId(id)) return res.status(400).json({ error: 'invalid-id' });
  if (!store.getCourse(id)) return res.status(404).json({ error: 'not-found' });
  const doc = sanitizeCourseDoc({ ...req.body, id });
  if (!doc) return res.status(400).json({ error: 'invalid-course' });
  store.saveCourse(doc);
  res.json({ course: doc });
});

app.delete('/api/courses/:id', requireAuth, requireCsrf, (req, res) => {
  const { id } = req.params;
  if (badId(id)) return res.status(400).json({ error: 'invalid-id' });
  store.removeCourse(id);
  const settings = JSON.parse(store.getSetting('settings', '{}'));
  if (settings.primaryCourseId === id) {
    settings.primaryCourseId = null;
    store.setSetting('settings', JSON.stringify(settings));
  }
  res.json({ ok: true });
});

app.post('/api/courses/reorder', requireAuth, requireCsrf, (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  if (ids.some(badId)) return res.status(400).json({ error: 'invalid-id' });
  ids.forEach((id, i) => {
    const doc = store.getCourse(id);
    if (doc) store.saveCourse(doc, i + 1);
  });
  res.json({ ok: true });
});

// Events CRUD
app.get('/api/events', requireAuth, (req, res) => res.json({ events: store.getEvents() }));

app.post('/api/events', requireAuth, requireCsrf, (req, res) => {
  const ev = sanitizeEvent({ ...req.body, id: uid() });
  if (!ev || !ev.date || !ev.title) return res.status(400).json({ error: 'invalid-event' });
  store.saveEvent(ev);
  res.json({ event: ev });
});

app.put('/api/events/:id', requireAuth, requireCsrf, (req, res) => {
  const { id } = req.params;
  if (badId(id)) return res.status(400).json({ error: 'invalid-id' });
  if (!store.getEventById(id)) return res.status(404).json({ error: 'not-found' });
  const ev = sanitizeEvent({ ...req.body, id });
  if (!ev || !ev.date || !ev.title) return res.status(400).json({ error: 'invalid-event' });
  store.saveEvent(ev);
  res.json({ event: ev });
});

app.delete('/api/events/:id', requireAuth, requireCsrf, (req, res) => {
  const { id } = req.params;
  if (badId(id)) return res.status(400).json({ error: 'invalid-id' });
  store.removeEvent(id);
  res.json({ ok: true });
});

// Backup / restore
app.get('/api/backup', requireAuth, (req, res) => {
  const data = store.exportAll();
  res.setHeader('Content-Disposition', `attachment; filename="edu-backup-${data.exportedAt.slice(0, 10)}.json"`);
  res.json(data);
});

app.post('/api/restore', requireAuth, requireCsrf, (req, res) => {
  const body = req.body || {};
  const payload = body.data;
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.courses)) {
    return res.status(400).json({ error: 'invalid-backup' });
  }
  if (body.mode === 'replace') {
    // keep the current password hash — backups must not weaken auth
    store.replaceAll(payload);
  } else {
    const errors = store.importAll(payload);
    if (errors.length) return res.status(400).json({ error: 'partial', details: errors });
  }
  res.json({ ok: true, summary: { courses: (payload.courses || []).length, events: (payload.events || []).length } });
});

// ---- static frontend ---------------------------------------------------------
const PUBLIC = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC, { extensions: ['html'] }));

// SPA fallback for client-side routes (index handles the auth gate)
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(PUBLIC, 'index.html'));
});

module.exports = app;
