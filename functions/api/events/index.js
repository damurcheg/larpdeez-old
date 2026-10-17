// /api/events — calendar events (auth, CSRF for writes).
import { getSession, requireSession, json, unauthorized, badRequest, readJsonBody } from '../../lib/http.js';
import { getEvents, saveEvent } from '../../lib/db.js';
import { sanitizeEvent } from '../../lib/validate.js';
import { uid } from '../../lib/crypto.js';

export const onRequestGet = async (context) => {
  if (!(await getSession(context))) return unauthorized();
  return json({ events: await getEvents(context.env) });
};

export const onRequestPost = async (context) => {
  const { fail } = await requireSession(context);
  if (fail) return fail;
  const body = await readJsonBody(context);
  if (body === null) return badRequest('invalid-json');
  const ev = sanitizeEvent({ ...body, id: uid() });
  if (!ev || !ev.date || !ev.title) return badRequest('invalid-event');
  await saveEvent(context.env, ev);
  return json({ event: ev });
};
