<!-- Context: development/postgres/guides/query-optimization-guide | Priority: medium | Version: 1.0 | Updated: 2026-05-20 -->

# Postgres Query Optimization Guide

## Key Principles

1. **Use EXPLAIN ANALYZE**: Always check the query plan before optimizing
2. **Index filter WHERE clauses**: Ensure query filters use indexed columns
3. **Avoid SELECT ***: Fetch only needed columns, prefer covering indexes

## Steps

1. Run `EXPLAIN ANALYZE` on slow queries
2. Identify sequential scans on large tables
3. Add or adjust indexes based on filter columns
4. Verify improvement with EXPLAIN ANALYZE again
5. Check for unnecessary sorts and loops

## Common Patterns

| Problem | Solution |
| --------| ---------- |
| Seq scan on filter | Add B-tree index |
| Index scan + heap lookup | Use covering index (INCLUDE) |
| Slowsort | Add index on ORDER BY columns |
| Nested loop join | Ensure join columns are indexed |

## Related Files

- concepts/indexing.md
- lookup/quick-reference.md

## Reference

- PostgreSQL Documentation: <https://www.postgresql.org/docs/current/>