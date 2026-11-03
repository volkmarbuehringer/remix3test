-- gen_random_uuid() is UUIDv4: uniformly random, so every insert lands in a
-- random leaf of the primary-key btree (page splits, poor index locality).
-- uuidv7() is time-ordered and keeps insert locality; PostgreSQL 18 ships it.
--
-- On an older server the default is left untouched with a NOTICE instead of
-- failing the boot. That is a deliberate trade: a NOTICE is visible in the
-- deploy log, whereas a hard failure would take the app down for a
-- non-functional optimisation. This database runs 18.3, so the branch taken
-- here is the first one.
DO $$
BEGIN
  IF current_setting('server_version_num')::int >= 180000 THEN
    ALTER TABLE webhook_requests ALTER COLUMN id SET DEFAULT uuidv7();
    RAISE NOTICE 'webhook_requests.id now defaults to uuidv7()';
  ELSE
    RAISE NOTICE 'webhook_requests.id keeps gen_random_uuid(): uuidv7() requires PostgreSQL 18+';
  END IF;
END $$;
