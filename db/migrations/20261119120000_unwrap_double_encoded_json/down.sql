-- Intentionally a no-op. Re-encoding a repaired array/object as a JSONB string
-- would restore the double-encoded shape that broke list/config reads, so the
-- repair is irreversible by design. Roll back the code, not the data.
SELECT 1;
