-- Manual migration: database review indexes (2026-09-28)
--
-- db/schema.sql is a fresh-database bootstrap and never alters existing
-- tables, so these statements must be applied once to an existing database:
--
--   psql "$DATABASE_URL" -f db/manual-migrations/2026-09-28-db-review-indexes.sql
--
-- Contents (matching the fresh-database definitions in db/schema.sql):
--   1. Trigram index for the admin message viewer's content substring search
--      (messages.content ILIKE), which no existing index can serve.
--   2. Index for the support tool's "recent appointments" list ordered by
--      created_at DESC, with an id tiebreaker.
--   3. Trigram indexes for the uploads grid's filename/mime_type substring
--      filter (the OR predicate can then be served by a BitmapOr).
--
-- CREATE INDEX CONCURRENTLY cannot run inside the transaction below; at the
-- current table sizes a plain CREATE INDEX is effectively instantaneous. If
-- these tables are large when this is applied, run each statement standalone
-- with CONCURRENTLY instead.

BEGIN;

CREATE INDEX IF NOT EXISTS messages_content_trgm_idx
  ON messages USING GIN (content gin_trgm_ops);

CREATE INDEX IF NOT EXISTS appointments_created_at_id_idx
  ON appointments (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS uploads_filename_trgm_idx
  ON uploads USING GIN (filename gin_trgm_ops);

CREATE INDEX IF NOT EXISTS uploads_mime_type_trgm_idx
  ON uploads USING GIN (mime_type gin_trgm_ops);

COMMIT;
