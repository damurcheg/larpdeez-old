// POST /api/password — change the master password (auth + CSRF required).
import { requireSession, json, readJsonBody, badRequest } from '../lib/http.js';
import { changePassword } from '../lib/auth.js';
import { setSetting } from '../lib/db.js';
import { str } from '../lib/validate.js';

export const onRequestPost = async (context) => {
  const { fail } = await requireSession(context);
  if (fail) return fail;
  const body = await readJsonBody(context);
  if (body === null) return badRequest('invalid-json');
  const oldP = str(body.oldPassword, 200);
  const newP = str(body.newPassword, 200);
  const result = await changePassword(context.env, oldP, newP);
  if (result === 'short') return badRequest('password-too-short');
  if (result !== true) return badRequest('wrong-old-password');
  await setSetting(context.env, 'password_configured', '1');
  return json({ ok: true });
};
