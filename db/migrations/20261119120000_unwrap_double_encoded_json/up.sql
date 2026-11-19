-- Repair rows written while `c.json()` columns were pre-serialized by hand.
--
-- At the remix 3.3.0 pin (data-table #12337) `column.json()` began serializing
-- every value with `JSON.stringify()`. Code that still called `JSON.stringify()`
-- before a typed write therefore stored a JSONB *string* whose text is the
-- encoded array/object instead of the array/object itself. The write paths are
-- fixed; this repairs rows that landed in the window between the pin bump and
-- that fix. Test databases are ephemeral, but dev/prod databases are not.
--
-- Expected shape: `lists.list` is an array, `offering_configs.rules` an object.
-- Only the JSONB string form is touched, and only when its text starts like the
-- expected container, so correctly stored rows are left alone. Timestamps are
-- untouched on purpose: bumping `updated_at` would reorder the `/lists` sidebar.
--
-- The per-row exception handler matters because this runs at boot. A JSONB
-- string that starts with `[` but is not valid JSON text (written by some other
-- client) is skipped with a warning instead of aborting every later startup.
-- The read paths tolerate that shape as well (`lists` afterRead and the
-- `LIST_ITEMS_ARRAY` guard in app/data/lists.ts).
DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT id, list FROM lists
    WHERE jsonb_typeof(list) = 'string'
      AND left(btrim(list #>> '{}'), 1) = '['
  LOOP
    BEGIN
      UPDATE lists SET list = (target.list #>> '{}')::jsonb WHERE id = target.id;
    EXCEPTION WHEN others THEN
      RAISE WARNING 'lists.id=% keeps its JSONB string value: % (%)',
        target.id, SQLERRM, SQLSTATE;
    END;
  END LOOP;
END $$;

DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT id, rules FROM offering_configs
    WHERE jsonb_typeof(rules) = 'string'
      AND left(btrim(rules #>> '{}'), 1) = '{'
  LOOP
    BEGIN
      UPDATE offering_configs SET rules = (target.rules #>> '{}')::jsonb WHERE id = target.id;
    EXCEPTION WHEN others THEN
      RAISE WARNING 'offering_configs.id=% keeps its JSONB string value: % (%)',
        target.id, SQLERRM, SQLSTATE;
    END;
  END LOOP;
END $$;
