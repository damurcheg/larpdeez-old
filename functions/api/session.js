// GET /api/session — validate the session cookie, return csrf/profile/settings.
import { getSession, json, unauthorized } from '../lib/http.js';
import { createCsrfToken } from '../lib/auth.js';
import { getSetting, parseJsonSetting } from '../lib/db.js';

export const onRequestGet = async (context) => {
  const sess = await getSession(context);
  if (!sess) {
    // Bootstrap signal for the SPA: password not configured and no PLATFORM_PASSWORD secret.
    const hash = await getSetting(context.env, 'passwordHash');
    if (!hash || String(hash).startsWith('scrypt:')) {
      if (!context.env.PLATFORM_PASSWORD) {
        return json({ error: 'auth-not-configured' }, 503);
      }
    }
    return unauthorized();
  }
  return json({
    csrf: await createCsrfToken(context.env, sess.sid),
    profile: parseJsonSetting(await getSetting(context.env, 'profile', '{}'), {}),
    settings: parseJsonSetting(await getSetting(context.env, 'settings', '{}'), {}),
    hasPasswordConfigured: (await getSetting(context.env, 'password_configured')) === '1',
  });
};
