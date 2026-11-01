# Historical manual migrations

These files predate the `remix db` runner and were applied by hand with
`psql "$DATABASE_URL" -f <file>`. They are kept for the audit trail only.

Do **not** apply them to a fresh database: their DDL is already part of
`../migrations/20261101000000_baseline/up.sql`, and the migration journal
records the baseline as applied. New schema changes belong in
`../migrations/<timestamp>_<slug>/`.

The `psql` instructions and `db/schema.sql` references inside these files
describe the old workflow. Do not follow them; they are kept as applied
artifacts for the audit trail.
