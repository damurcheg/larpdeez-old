// /api/events/:id — update/delete calendar events (auth + CSRF).
import { requireSession, json, badRequest, notFound, readJsonBody } from '../../lib/http.js';
import { getEventById, saveEvent, removeEvent } from '../../lib/db.js';
import { sanitizeEvent, badId } from '../../lib/validate.js';

export const onRequestPut = async (context) => {
  const { fail } = await requireSession(context);
  if (fail) return fail;
  const { id } = context.params;
  if (badId(id)) return badRequest('invalid-id');
  if (!(await getEventById(context.env, id))) return notFound();
  const body = await readJsonBody(context);
  if (body === null) return badRequest('invalid-json');
  const ev = sanitizeEvent({ ...body, id });
  if (!ev || !ev.date || !ev.title) return badRequest('invalid-event');
  await saveEvent(context.env, ev);
  return json({ event: ev });
};

export const onRequestDelete = async (context) => {
  const { fail } = await requireSession(context);
  if (fail) return fail;
  const { id } = context.params;
  if (badId(id)) return badRequest('invalid-id');
  await removeEvent(context.env, id);
  return json({ ok: true });
};
