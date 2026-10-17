// Server-side authentication for Cloudflare Pages Functions.
// - Password hash: PBKDF2-SHA256 via Web Crypto (scrypt from the old Node server is not available here).
// - Session token: HMAC-signed payload stored in an HttpOnly cookie.
// - CSRF token: derived from the session id + secret, sent in the X-CSRF-Token header.
// - Login rate limiting: per-IP counters kept in a KV namespace (or in-memory for local dev).

import { randomHex, sha256Hex, hmacHex, hashPassword, verifyPassword, timingSafeEqualStr } from './crypto.js';
import { getSetting, setSetting } from './db.js';

const SESSION_TTL_S = 30 * 24 * 60 * 60; // 30 days

async function getSessionSecret(env) {
  let secret = await getSetting(env, 'sessionSecret');
  if (!secret) {
    const seed = env.PLATFORM_SECRET_SEED || null;
    secret = seed ? await sha256Hex(`seed:${seed}`) : randomHex(32);
    await setSetting(env, 'sessionSecret', secret);
  }
  return secret;
}

export async function ensureSetup(env) {
  // Bootstrap ONLY when there is no usable password yet. Once a real hash exists
  // (or the user changed their password), the PLATFORM_PASSWORD secret must NOT
  // overwrite it — that was the cause of "wrong password" after setting the secret.
  const existing = await getSetting(env, 'passwordHash');
  if (existing && !existing.startsWith('scrypt:')) return; // ready

  const initial = env.PLATFORM_PASSWORD;
  if (!initial) {
    console.warn('[auth] No password in D1 and PLATFORM_PASSWORD secret is not set — login is disabled until you configure the secret.');
    return;
  }
  await setSetting(env, 'passwordHash', await hashPassword(String(initial)));
  await setSetting(env, 'password_source', 'secret-bootstrap');
  console.log('[auth] Password bootstrapped from the PLATFORM_PASSWORD secret. Change it in Profile when convenient.');
}

// If PLATFORM_PASSWORD secret was changed in the Cloudflare dashboard but an old
// bootstrap hash is still stored in D1, re-apply the new secret once (per value).
// This never touches passwords changed through the Profile UI.
export async function syncBootstrapPassword(env) {
  const secret = env.PLATFORM_PASSWORD;
  if (!secret) return;
  const source = await getSetting(env, 'password_source');
  if (source !== 'secret-bootstrap') return; // password was set via UI or already synced
  const applied = await getSetting(env, 'password_bootstrap_applied');
  if (applied === (await sha256Hex(String(secret)))) return; // this exact value already applied
  await setSetting(env, 'passwordHash', await hashPassword(String(secret)));
  await setSetting(env, 'password_bootstrap_applied', await sha256Hex(String(secret)));
  console.log('[auth] Re-applied the updated PLATFORM_PASSWORD secret to D1.');
}

async function signPayload(env, bodyB64) {
  const secret = await getSessionSecret(env);
  const mac = await hmacHex(secret, bodyB64);
  return mac;
}

function b64urlEncode(str) {
  return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return decodeURIComponent(escape(atob(s)));
}

export async function createSessionToken(env) {
  const payload = { sid: randomHex(12), exp: Date.now() + SESSION_TTL_S * 1000 };
  const body = b64urlEncode(JSON.stringify(payload));
  const mac = await signPayload(env, body);
  return `${body}.${mac}`;
}

export async function verifySessionToken(env, token) {
  if (!token || typeof token !== 'string') return null;
  const i = token.lastIndexOf('.');
  if (i <= 0) return null;
  const body = token.slice(0, i);
  const mac = token.slice(i + 1);
  const expected = await signPayload(env, body);
  if (!timingSafeEqualStr(mac, expected)) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function createCsrfToken(env, sid) {
  const secret = await getSessionSecret(env);
  return hmacHex(`${secret}:csrf`, sid);
}

export async function login(env, password) {
  const hash = await getSetting(env, 'passwordHash');
  if (!hash) return null;
  if (!(await verifyPassword(password, hash))) return null;
  return createSessionToken(env);
}

export async function changePassword(env, oldPassword, newPassword) {
  const hash = await getSetting(env, 'passwordHash');
  if (!(await verifyPassword(oldPassword, hash || ''))) return false;
  if (!newPassword || String(newPassword).length < 6) return 'short';
  await setSetting(env, 'passwordHash', await hashPassword(String(newPassword)));
  // Password is now owned by the user (Profile UI), not the PLATFORM_PASSWORD secret —
  // the bootstrap sync must never overwrite it again.
  await setSetting(env, 'password_source', 'user');
  return true;
}

// ---- cookies -------------------------------------------------------------

export function sessionCookie(token, secure) {
  return `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_S}${secure ? '; Secure' : ''}`;
}

export function clearSessionCookie(secure) {
  return `session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
}

export function readSessionCookie(request) {
  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.match(/(?:^|;\s*)session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function isSecureRequest(request) {
  const proto = request.headers.get('X-Forwarded-Proto');
  if (proto === 'https') return true;
  try {
    return new URL(request.url).protocol === 'https:';
  } catch {
    return false;
  }
}

// ---- rate limiting ---------------------------------------------------------

const memAttempts = new Map(); // ip -> { count, ts } (local dev fallback when no KV bound)

export async function tooManyAttempts(env, ip) {
  if (env.RATE_LIMIT_KV) {
    const rec = await env.RATE_LIMIT_KV.get(`rl:${ip}`, 'json');
    if (!rec) return false;
    if (Date.now() - rec.ts > 5 * 60 * 1000) return false;
    return rec.count >= 8;
  }
  const a = memAttempts.get(ip);
  if (!a) return false;
  if (Date.now() - a.ts > 5 * 60 * 1000) { memAttempts.delete(ip); return false; }
  return a.count >= 8;
}

export async function registerAttempt(env, ip, ok) {
  if (env.RATE_LIMIT_KV) {
    const key = `rl:${ip}`;
    if (ok) { await env.RATE_LIMIT_KV.delete(key); return; }
    const rec = (await env.RATE_LIMIT_KV.get(key, 'json')) || { count: 0, ts: Date.now() };
    await env.RATE_LIMIT_KV.put(key, JSON.stringify({ count: rec.count + 1, ts: Date.now() }), { expirationTtl: 600 });
    return;
  }
  if (ok) memAttempts.delete(ip);
  else {
    const a = memAttempts.get(ip) || { count: 0, ts: Date.now() };
    a.count += 1; a.ts = Date.now();
    memAttempts.set(ip, a);
  }
}
