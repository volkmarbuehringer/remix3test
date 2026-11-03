-- The pre-2026-08 runner journaled into `data_table_migrations`. Since the
-- baseline adoption the live journal is `app_migrations` (remix.json
-- db.migrations.journalTable and app/db.ts agree). The old table is ignored on
-- purpose: its one surviving row (`20260724000001 create_all`) names a
-- migration file that no longer exists, and a forward run would abort on it as
-- an orphaned journal entry.
--
-- Renamed rather than dropped. That row is the only record that the legacy
-- bootstrap ran, and db/manual-migrations/ is kept for exactly the same audit
-- reason. The guards make the migration a no-op on a fresh database, where the
-- table was never created.
DO $$
BEGIN
  IF to_regclass('public.data_table_migrations') IS NOT NULL THEN
    ALTER TABLE public.data_table_migrations RENAME TO data_table_migrations_legacy;
  END IF;

  IF to_regclass('public.data_table_migrations_legacy') IS NOT NULL THEN
    EXECUTE 'COMMENT ON TABLE public.data_table_migrations_legacy IS '
         || quote_literal('Retired pre-2026-08 migration journal (see db/migrations/README.md). Superseded by app_migrations; do not write to this table.');
  END IF;
END $$;
