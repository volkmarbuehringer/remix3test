-- Manual migration: schema hygiene pass (2026-08-29)
--
-- db/schema.sql is a fresh-database bootstrap and never alters existing
-- tables, so these statements must be applied once to an existing database:
--
--   psql "$DATABASE_URL" -f db/manual-migrations/2026-08-29-schema-hygiene.sql
--
-- Contents (matching the fresh-database definitions in db/schema.sql):
--   1. Drop dead tables: chatlog and workflow_runs have no code references
--      (admin chatlog reads Mastra memory; Mastra keeps its own snapshot
--      tables). webhook_requests.token is never written or read.
--   2. CHECK constraints: users.role / users.email_verified mirror the
--      data-table enum; during bounds mirror the appointment-time validation
--      for the raw-SQL write paths that bypass it.
--   3. Lists ordering indexes for the hot sidebar ORDER BY.
--
-- Note: the ADD CONSTRAINT statements fail loudly if existing rows violate
-- them — that is intentional (a data-integrity constraint refusing bad data).

BEGIN;

DROP TABLE IF EXISTS workflow_runs;
DROP TABLE IF EXISTS chatlog;
ALTER TABLE webhook_requests DROP COLUMN IF EXISTS token;

DO $$
BEGIN
  ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('customer', 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  ALTER TABLE users ADD CONSTRAINT users_email_verified_check CHECK (email_verified IN (0, 1));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  ALTER TABLE appointments ADD CONSTRAINT during_bounds CHECK (
    lower(during) >= 0 AND upper(during) <= 1440 AND lower(during) < upper(during)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  ALTER TABLE appointoffering ADD CONSTRAINT during_bounds CHECK (
    lower(during) >= 0 AND upper(during) <= 1440 AND lower(during) < upper(during)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS lists_created_at_id_idx ON lists (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS lists_user_created_at_id_idx ON lists (user_id, created_at DESC, id DESC);

COMMIT;
