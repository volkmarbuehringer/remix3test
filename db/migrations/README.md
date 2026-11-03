# Database migrations

Schema changes are SQL-file migrations consumed by `remix/data-table` and the
`remix db` CLI. The app applies pending migrations on boot through
`initializeAppDatabase()` and then runs the idempotent seed.

## Rules

- One directory per migration: `<14-digit timestamp>_<slug>/`.
- `up.sql` is required; `down.sql` is optional. Add a `down.sql` for every new
  migration so `npm run db:rollback` can revert it.
- **Never edit an `up.sql` that has been applied.** The runner journals each
  migration and checksums its SQL; an edit fails the next boot with a checksum
  drift error. Add a new migration directory instead.
- Keep migrations append-only and deterministic. Data backfills belong in their
  own migration, not in the baseline.
- Each migration runs inside a transaction by default. For statements that
  cannot run in a transaction (notably `CREATE INDEX CONCURRENTLY`), make the
  first non-blank line of `up.sql`:
  ```sql
  -- data-table/transaction: none
  ```
- With `none`, the whole file is sent as one query string. A multi-statement
  string still executes as an implicit transaction block, so PostgreSQL rejects
  `CONCURRENTLY` regardless of the directive. **Put exactly one statement in
  such a file** — e.g. `CREATE INDEX CONCURRENTLY` in one migration and the
  matching `DROP INDEX CONCURRENTLY` in the next. A failed build is not rolled
  back: it can leave an INVALID index behind, and `IF NOT EXISTS` will then skip
  every retry, so check `pg_index.indisvalid` before re-running.

## Commands

```sh
npm run db:status      # applied / pending / drifted / missing
npm run db:migrate     # apply pending migrations
npm run db:rollback    # revert the newest migration (add -- --step N or -- --to <id>)
npm run db:reset -- --force  # DROP + recreate the database, then apply all migrations
npm run db:seed        # apply pending migrations and run the app seed
```

All commands load `.env` (including `DATABASE_URL`) before invoking the vendor
CLI. `db:reset` deliberately does **not** embed `--force`: the operator must type
it (`npm run db:reset -- --force`), and `scripts/db.ts` refuses the command when
`NODE_ENV=production`. Do not run it against a database you need to keep.

## Journal

The runner records applied migrations in `app_migrations`, not the vendor
default `data_table_migrations`. The distinct table intentionally ignores a
stale journal left behind by the pre-2026-08 runner: an old journal row whose
migration file no longer exists would abort every forward run as an orphaned
entry.

The journal records **intent**, not a schema diff. An existing database is
journaled as applied after the idempotent baseline runs even if it missed a
manual migration's columns/indexes. Before adopting an environment, spot-check
the objects a later migration assumes and run `npm run db:status`.

## Deploy

The server applies pending migrations on boot, so a single-instance deploy can
ship a migration and the code in one step. For a rolling deploy, run
`npm run db:migrate` before starting the new version (or use expand/contract
migrations) so old and new instances can both run against the intermediate
schema. A failed migration aborts boot instead of silently drifting.

Boot-time migrations use the app pool's `statement_timeout: 30000`, and the
driver's advisory-lock wait can be aborted by that same limit. Keep boot
migrations fast; for a heavy change (`CREATE INDEX` on a large table, a big
backfill), run `npm run db:migrate` out of band first — the CLI connection has no
statement timeout — then deploy the code.

## Baseline adoption

`20261101000000_baseline/up.sql` is the full schema at the time the app adopted
the migration runner. Its DDL is idempotent (`IF NOT EXISTS` everywhere), so an
existing database can run it once and be journaled without manual bookkeeping.
The baseline has no `down.sql` and is intentionally irreversible: a rollback
whose target is the baseline throws `Migration "..." has no down script`. Add
new migrations with `down.sql` files for reversible changes.

## Tests

`test/setup.ts` creates a fresh test database, drops `public`, and calls
`initializeAppDatabase()`, so every test run applies the same migrations as
production. The Postgres driver holds an advisory lock for the run, which
serializes parallel test workers and concurrent cold boots.
