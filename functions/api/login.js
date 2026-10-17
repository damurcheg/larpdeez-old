// POST /api/login — password check, session cookie, CSRF token.
import { login, ensureSetup, syncBootstrapPassword, sessionCookie, tooManyAttempts, registerAttempt, createCsrfToken, verifySessionToken } from '../lib/auth.js';
import { getSetting, parseJsonSetting } from '../lib/db.js';
import { json, badRequest, readJsonBody, secureFlag, clientIp } from '../lib/http.js';
import { str } from '../lib/validate.js';

export const onRequestPost = async (context) => {
  const { env } = context;
  await ensureSetup(env);
  await syncBootstrapPassword(env); // secret changed in dashboard → re-apply once (only if password still comes from the secret)

  const ip = clientIp(context);
  if (await tooManyAttempts(env, ip)) return json({ error: 'too-many-attempts' }, 429);

  const body = await readJsonBody(context);
  if (body === null) return badRequest('invalid-json');
  const password = str(body.password, 200);
  const token = await login(env, password);
  if (!token) {
    await registerAttempt(env, ip, false);
    return json({ error: 'bad-password' }, 401);
  }
  await registerAttempt(env, ip, true);

  const sess = await verifySessionToken(env, token);
  return json(
    { csrf: await createCsrfToken(env, sess.sid), profile: parseJsonSetting(await getSetting(env, 'profile', '{}'), {}) },
    200,
    { 'Set-Cookie': sessionCookie(token, secureFlag(context)) }
  );
};
