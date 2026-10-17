// Shared helpers for Pages Functions API routes.

import { verifySessionToken, createCsrfToken, readSessionCookie, isSecureRequest } from './auth.js';
import { timingSafeEqualStr } from './crypto.js';

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

export const unauthorized = () => json({ error: 'unauthorized' }, 401);
export const forbidden = (code = 'csrf') => json({ error: code }, 403);
export const notFound = () => json({ error: 'not-found' }, 404);
export const badRequest = (code = 'bad-request', details) => json({ error: code, ...(details ? { details } : {}) }, 400);

export async function getSession(context) {
  const token = readSessionCookie(context.request);
  if (!token) return null;
  return verifySessionToken(context.env, token);
}

export async function requireSession(context) {
  const sess = await getSession(context);
  if (!sess) {
    return { sess: null, fail: unauthorized() };
  }
  const csrf = context.request.headers.get('x-csrf-token') || '';
  const expected = await createCsrfToken(context.env, sess.sid);
  if (!timingSafeEqualStr(csrf, expected)) {
    return { sess, fail: forbidden('csrf') };
  }
  return { sess, fail: null };
}

export async function readJsonBody(context) {
  try {
    const body = await context.request.json();
    return body && typeof body === 'object' ? body : {};
  } catch {
    return null;
  }
}

export function secureFlag(context) {
  return isSecureRequest(context.request);
}

export function clientIp(context) {
  return context.request.headers.get('CF-Connecting-IP') || 'unknown';
}
