-- Generated from data/platform.db at 2026-10-17T16:21:59.801Z
-- Source counts: settings=2 courses=0 events=0

DELETE FROM settings WHERE key = 'passwordHash';

-- Verification queries (run after import):
-- SELECT COUNT(*) FROM courses;  -- expected: 0
-- SELECT COUNT(*) FROM events;   -- expected: 0
