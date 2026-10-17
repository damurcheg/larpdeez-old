// /api/courses/:id — single-course endpoints (auth, CSRF for writes).
import { getSession, requireSession, json, unauthorized, notFound, badRequest, readJsonBody } from '../../lib/http.js';
import { getCourse, saveCourse, removeCourse, getSetting, setSetting, parseJsonSetting } from '../../lib/db.js';
import { sanitizeCourseDoc, badId } from '../../lib/validate.js';

export const onRequestGet = async (context) => {
  if (!(await getSession(context))) return unauthorized();
  const { id } = context.params;
  if (badId(id)) return badRequest('invalid-id');
  const doc = await getCourse(context.env, id);
  if (!doc) return notFound();
  return json({ course: doc });
};

export const onRequestPut = async (context) => {
  const { fail } = await requireSession(context);
  if (fail) return fail;
  const { id } = context.params;
  if (badId(id)) return badRequest('invalid-id');
  if (!(await getCourse(context.env, id))) return notFound();
  const body = await readJsonBody(context);
  if (body === null) return badRequest('invalid-json');
  const doc = sanitizeCourseDoc({ ...body, id });
  if (!doc) return badRequest('invalid-course');
  await saveCourse(context.env, doc);
  return json({ course: doc });
};

export const onRequestDelete = async (context) => {
  const { fail } = await requireSession(context);
  if (fail) return fail;
  const { id } = context.params;
  if (badId(id)) return badRequest('invalid-id');
  await removeCourse(context.env, id);
  const settings = parseJsonSetting(await getSetting(context.env, 'settings', '{}'), {});
  if (settings.primaryCourseId === id) {
    settings.primaryCourseId = null;
    await setSetting(context.env, 'settings', JSON.stringify(settings));
  }
  return json({ ok: true });
};
