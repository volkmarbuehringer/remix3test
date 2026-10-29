-- Manual migration: filesystem upload metadata (2026-10-29)
--
-- db/schema.sql is a fresh-database bootstrap and never alters existing
-- tables, so this statement must be applied once to an existing database:
--
--   psql "$DATABASE_URL" -f db/manual-migrations/2026-10-29-upload-files.sql
--
-- Contents (matching the fresh-database definition in db/schema.sql):
--   Metadata index for the filesystem streaming upload route
--   (/admin/uploadnew). File bytes live under UPLOAD_FILES_DIR and are never
--   stored in Postgres; only the storage key and display metadata live here.
--
-- Safe to run repeatedly: IF NOT EXISTS guards both the table and its indexes.

BEGIN;

CREATE TABLE IF NOT EXISTS upload_files (
  id SERIAL PRIMARY KEY,
  storage_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size BIGINT NOT NULL,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS upload_files_created_at_idx ON upload_files (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS upload_files_uploaded_by_idx ON upload_files (uploaded_by);

COMMIT;
