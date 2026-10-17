// POST /api/logout — clear the session cookie (requires a valid session).
import { clearSessionCookie } from '../lib/auth.js';
import { json, requireSession, secureFlag } from '../lib/http.js';

export const onRequestPost = async (context) => {
  const { fail } = await requireSession(context);
  if (fail) return fail;
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie(secureFlag(context)) });
};
