DO $$
BEGIN
  IF to_regclass('public.data_table_migrations_legacy') IS NOT NULL
     AND to_regclass('public.data_table_migrations') IS NULL THEN
    ALTER TABLE public.data_table_migrations_legacy RENAME TO data_table_migrations;
  END IF;
END $$;
