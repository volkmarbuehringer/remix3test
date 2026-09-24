-- Manual migration: database review fixes (2026-09-24)
--
-- db/schema.sql is a fresh-database bootstrap and never alters existing
-- tables, so these statements must be applied once to an existing database:
--
--   psql "$DATABASE_URL" -f db/manual-migrations/2026-09-24-db-review-fixes.sql
--
-- Contents (matching the fresh-database definitions in db/schema.sql):
--   1. Drop api_tokens_token_hash_idx. api_tokens.token_hash is already
--      UNIQUE, which creates an identical btree index; the second index only
--      adds write cost on every token issue/revoke.
--   2. Index chat_runs.created_at for the hourly TTL sweep
--      (DELETE FROM chat_runs WHERE created_at < $1), which otherwise
--      sequential-scans the table on every run.
--   3. Trigram expression index for the webhook viewer's payload substring
--      search (payload::text ILIKE $1), which cannot use any existing index.
--   4. btree index for the admin list grid's ORDER BY updated_at, id DESC.
--      (title/description sorts continue to use the trigram search indexes.)

BEGIN;

DROP INDEX IF EXISTS api_tokens_token_hash_idx;

CREATE INDEX IF NOT EXISTS chat_runs_created_at_idx ON chat_runs (created_at);

CREATE INDEX IF NOT EXISTS webhook_requests_payload_trgm_idx
  ON webhook_requests USING GIN ((payload::text) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS lists_updated_at_id_idx ON lists (updated_at DESC, id DESC);

COMMIT;
