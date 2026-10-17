// GET /api/state — full authenticated state (courses, events, profile, settings).
import { getSession, json, unauthorized } from '../lib/http.js';
import { getCourses, getEvents, getSetting, parseJsonSetting } from '../lib/db.js';

export const onRequestGet = async (context) => {
  const sess = await getSession(context);
  if (!sess) return unauthorized();
  return json({
    courses: await getCourses(context.env),
    events: await getEvents(context.env),
    profile: parseJsonSetting(await getSetting(context.env, 'profile', '{}'), {}),
    settings: parseJsonSetting(await getSetting(context.env, 'settings', '{}'), {}),
  });
};
