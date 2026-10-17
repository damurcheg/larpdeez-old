// /api/courses — collection endpoints.
// GET    /api/courses          list all (auth)
// POST   /api/courses          create (auth + CSRF)
// POST   /api/courses/reorder  save drag-and-drop order (auth + CSRF)

import { getSession, requireSession, json, unauthorized, badRequest, readJsonBody } from '../../lib/http.js';
import { getCourses, getCourse, saveCourse } from '../../lib/db.js';
import { sanitizeCourseDoc, badId } from '../../lib/validate.js';
import { uid } from '../../lib/crypto.js';

export const onRequestGet = async (context) => {
  if (!(await getSession(context))) return unauthorized();
  return json({ courses: await getCourses(context.env) });
};

const reorderHandler = async (context) => {
  const { fail } = await requireSession(context);
  if (fail) return fail;
  const body = await readJsonBody(context);
  if (body === null) return badRequest('invalid-json');
  const ids = Array.isArray(body.ids) ? body.ids : [];
  if (ids.some(badId)) return badRequest('invalid-id');
  const batch = [];
  for (let i = 0; i < ids.length; i++) {
    const doc = await getCourse(context.env, ids[i]);
    if (doc) batch.push(saveCourse(context.env, doc, i + 1));
  }
  await Promise.all(batch);
  return json({ ok: true });
};

export const onRequestPost = async (context) => {
  // Pages Functions route matching: "/api/courses" only matches the exact path,
  // so "reorder" arrives here too when no more specific rule exists. Dispatch manually.
  const url = new URL(context.request.url);
  if (url.pathname.endsWith('/reorder')) return reorderHandler(context);

  const { fail } = await requireSession(context);
  if (fail) return fail;
  const body = await readJsonBody(context);
  if (body === null) return badRequest('invalid-json');
  const doc = sanitizeCourseDoc({ ...body, id: uid() });
  if (!doc) return badRequest('invalid-course');
  if (!doc.title) doc.title = 'Новый курс';
  const all = await getCourses(context.env);
  await saveCourse(context.env, doc, all.length ? Math.max(...all.map((c) => c.sort || 0)) + 1 : 1);
  return json({ course: doc });
};
