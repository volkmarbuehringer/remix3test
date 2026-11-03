-- data-table/transaction: none
--
-- Superseded by upload_files_uploaded_by_size_idx in the previous migration:
-- same key column, with `size` included. Keeping both would pay the write cost
-- of an index that can never be chosen in preference to the covering one.
--
-- One statement per file: see the note in 20261103120300.
DROP INDEX CONCURRENTLY IF EXISTS upload_files_uploaded_by_idx;
