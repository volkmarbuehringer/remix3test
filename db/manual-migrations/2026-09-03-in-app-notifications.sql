-- Manual migration: in-app booking notification inbox (2026-09-03)
--
-- db/schema.sql is a fresh-database bootstrap and never alters existing
-- tables, so these statements must be applied once to an existing database:
--
--   psql "$DATABASE_URL" -f db/manual-migrations/2026-09-03-in-app-notifications.sql
--
-- Contents (matching the fresh-database definitions in db/schema.sql):
--   User-scoped in-app booking notifications (confirmation / reminder /
--   cancellation), read-state per row, and the hot list + unread indexes.

BEGIN;

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('confirmation', 'reminder', 'cancellation')),
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
  read_at BIGINT,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS notifications_user_created_at_idx ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications (user_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS notifications_appointment_id_idx ON notifications (appointment_id);

COMMIT;
