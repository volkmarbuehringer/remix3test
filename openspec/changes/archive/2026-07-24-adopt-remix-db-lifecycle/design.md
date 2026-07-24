# Design

## Migration files

Single migration `db/migrations/20260724000001_create_all/` containing all
table creation SQL. `up.sql` has the full CREATE TABLE / CREATE INDEX statements.
`down.sql` has DROP TABLE IF EXISTS for all tables.

## Adapter ownership

Adapter manages its own pool internally. Code that directly imported `pool`
(seed.ts line 127) switches to `db.exec()`.

## Test flow

```
globalSetup:
  CREATE DATABASE newapp_test_<ts>_<pid>  (still needed for isolation)
  set DATABASE_URL

beforeEach:
  db.reset({ migrations, seed })   ← wipe → migrate → seed
```
