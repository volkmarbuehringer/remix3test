-- data-table/transaction: none
--
-- users.email is UNIQUE, but that constraint is case-sensitive. The table hook
-- lowercases every write (app/data/schema.ts, beforeWrite), so the app layer is
-- consistent — yet any raw SQL or seed path can insert `Admin@x` next to
-- `admin@x` and create two login identities for one mailbox. A functional
-- unique index makes the guarantee structural instead of conventional.
--
-- CONCURRENTLY keeps the build off the write path and cannot run inside a
-- transaction, hence the directive above. If the build fails it leaves an
-- INVALID index behind and IF NOT EXISTS would skip the retry: check
-- pg_index.indisvalid, then DROP and re-CREATE.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS users_email_lower_uidx
  ON users (lower(email));
