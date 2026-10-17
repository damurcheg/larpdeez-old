// Server-side authentication: password hashing (scrypt), signed session tokens, CSRF protection.
const crypto = require('crypto');
const store = require('./db');

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const derived = crypto.scryptSync(String(password), parts[1], 64).toString('hex');
  const a = Buffer.from(derived, 'hex');
  const b = Buffer.from(parts[2], 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function ensureSetup() {
  if (!store.getSetting('passwordHash')) {
    const initial = process.env.PLATFORM_PASSWORD || 'admin123';
    store.setSetting('passwordHash', hashPassword(initial));
    if (!process.env.PLATFORM_PASSWORD) {
      console.log('[auth] No password configured. Temporary default password: admin123 — change it in Profile immediately.');
    }
  }
  if (!store.getSetting('sessionSecret')) {
    // Stable secret from env (if provided) keeps sessions valid across DB restores.
    const seed = process.env.PLATFORM_SECRET_SEED;
    const secret = seed
      ? crypto.createHash('sha256').update(String(seed)).digest('hex')
      : crypto.randomBytes(32).toString('hex');
    store.setSetting('sessionSecret', secret);
  }
}

function sign(payloadB64) {
  const secret = store.getSetting('sessionSecret');
  return crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
}

function createSessionToken() {
  const payload = { sid: crypto.randomBytes(12).toString('hex'), exp: Date.now() + SESSION_TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const i = token.lastIndexOf('.');
  if (i <= 0) return null;
  const body = token.slice(0, i);
  const mac = token.slice(i + 1);
  const expected = sign(body);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function createCsrfToken(sid) {
  const secret = store.getSetting('sessionSecret');
  return crypto.createHmac('sha256', `${secret}:csrf`).update(sid).digest('hex');
}

function login(password) {
  const hash = store.getSetting('passwordHash');
  if (!hash || !verifyPassword(password, hash)) return null;
  return createSessionToken();
}

function changePassword(oldPassword, newPassword) {
  const hash = store.getSetting('passwordHash');
  if (!verifyPassword(oldPassword, hash)) return false;
  if (!newPassword || String(newPassword).length < 6) return 'short';
  store.setSetting('passwordHash', hashPassword(String(newPassword)));
  return true;
}

module.exports = { ensureSetup, login, verifySessionToken, createCsrfToken, changePassword, hashPassword };
