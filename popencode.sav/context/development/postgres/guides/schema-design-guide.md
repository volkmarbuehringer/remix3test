<!-- Context: development/postgres/guides/schema-design-guide | Priority: medium | Version: 1.0 | Updated: 2026-05-20 -->

# Postgres Schema Design Guide

## Steps

1. **Define entities**: Identify core domain objects and their relationships
2. **Choose primary keys**: Use `uuid` for externally-shareable IDs, `bigint` for internal-only
3. **Select data types**: Apply text for strings, timestamptz for timestamps (see data-types.md)
4. **Normalize appropriately**: Avoid over-normalization; denormalize for read-heavy patterns
5. **Add constraints**: Use CHECK, UNIQUE, and foreign keys for data integrity

## Decision Points

| Scenario | Recommendation |
| -------- | ------------ |
| Public ID exposure needed | UUID primary key |
| Internal-only records | bigserial primary key |
| Unbounded text field | text type |
| Any timestamp field | timestamptz |

## Common Pitfalls

- Using `timestamp` without timezone — always use `timestamptz`
- Setting arbitrary `varchar(n)` limits — use `text` if no domain constraint
- Over-indexing — index only where queries actually filter

## Related Files

- concepts/data-types.md
- examples/table-examples.md
- lookup/quick-reference.md

## Reference

- PostgreSQL Documentation: <https://www.postgresql.org/docs/current/>