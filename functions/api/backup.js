// GET /api/backup — download the full dataset as JSON (auth required).
// The browser saves it via the Content-Disposition attachment header.
import { getSession, json, unauthorized } from '../lib/http.js';
import { exportAll } from '../lib/db.js';

export const onRequestGet = async (context) => {
  if (!(await getSession(context))) return unauthorized();
  const data = await exportAll(context.env);
  return json(
    data,
    200,
    { 'Content-Disposition': `attachment; filename="edu-backup-${data.exportedAt.slice(0, 10)}.json"` }
  );
};
