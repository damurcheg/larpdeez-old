// PUT /api/settings — theme, primary course, planner visibility (auth + CSRF required).
import { requireSession, json, readJsonBody, badRequest } from '../lib/http.js';
import { getSetting, setSetting, parseJsonSetting } from '../lib/db.js';
import { ID_RE } from '../lib/validate.js';

export const onRequestPut = async (context) => {
  const { fail } = await requireSession(context);
  if (fail) return fail;
  const s = await readJsonBody(context);
  if (s === null) return badRequest('invalid-json');
  const cur = parseJsonSetting(await getSetting(context.env, 'settings', '{}'), {});
  const next = { ...cur };
  if (typeof s.theme === 'string' && ['light', 'dark'].includes(s.theme)) next.theme = s.theme;
  if ('primaryCourseId' in s) {
    const v = s.primaryCourseId;
    next.primaryCourseId = v === null || v === '' ? null : (typeof v === 'string' && ID_RE.test(v) ? v : null);
  }
  if (typeof s.completedHidden === 'boolean') next.completedHidden = s.completedHidden;
  await setSetting(context.env, 'settings', JSON.stringify(next));
  return json({ settings: next });
};
