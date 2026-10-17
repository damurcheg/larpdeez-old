// PUT /api/profile — update display name/avatar/banner (auth + CSRF required).
import { requireSession, json, readJsonBody, badRequest } from '../lib/http.js';
import { setSetting } from '../lib/db.js';
import { sanitizeProfile } from '../lib/validate.js';

export const onRequestPut = async (context) => {
  const { fail } = await requireSession(context);
  if (fail) return fail;
  const body = await readJsonBody(context);
  if (body === null) return badRequest('invalid-json');
  const profile = sanitizeProfile(body);
  await setSetting(context.env, 'profile', JSON.stringify(profile));
  return json({ profile });
};
