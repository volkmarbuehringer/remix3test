-- data-table/transaction: none
--
-- The per-user quota check is `SELECT SUM(size) ... WHERE uploaded_by = $1`
-- (app/data/upload-files.ts). upload_files_uploaded_by_idx locates the rows but
-- every row still needs a heap fetch to read `size`; an INCLUDE column makes
-- that sum index-only.
--
-- CONCURRENTLY keeps the build off the write path, which requires the runner's
-- transaction directive AND exactly one statement in this file: a multi-statement
-- string is executed as an implicit transaction block, and PostgreSQL then
-- rejects CONCURRENTLY outright. The redundant old index is dropped in the next
-- migration for the same reason.
CREATE INDEX CONCURRENTLY IF NOT EXISTS upload_files_uploaded_by_size_idx
  ON upload_files (uploaded_by) INCLUDE (size);
