// POST /api/restore — import a backup (auth + CSRF). mode: 'merge' | 'replace'.
// Replace mode keeps the current password hash — backups must never weaken auth.
import { requireSession, json, badRequest, readJsonBody } from '../lib/http.js';
import { importAll, replaceAll } from '../lib/db.js';
import { sanitizeCourseDoc, sanitizeEvent } from '../lib/validate.js';

export const onRequestPost = async (context) => {
  const { fail } = await requireSession(context);
  if (fail) return fail;
  const body = await readJsonBody(context);
  if (body === null) return badRequest('invalid-json');
  const payload = body.data;
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.courses)) {
    return badRequest('invalid-backup');
  }
  // Re-validate every record server-side before touching the database.
  const courses = payload.courses.map(sanitizeCourseDoc).filter(Boolean);
  const events = Array.isArray(payload.events) ? payload.events.map(sanitizeEvent).filter(Boolean) : [];
  const clean = { profile: payload.profile, settings: payload.settings, courses, events };

  if (body.mode === 'replace') {
    await replaceAll(context.env, clean);
  } else {
    const errors = await importAll(context.env, clean);
    if (errors.length) return badRequest('partial', errors);
  }
  return json({ ok: true, summary: { courses: courses.length, events: events.length } });
};
