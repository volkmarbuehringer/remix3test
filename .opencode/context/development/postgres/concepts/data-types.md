<!-- Context: development/postgres/concepts/data-types | Priority: medium | Version: 1.0 | Updated: 2026-05-20 -->

# Postgres Data Types

Prefer `text` over `varchar(n)` unless a length constraint is meaningful to the domain.

## Key Points

- **text vs varchar**: Use `text` for unbounded strings; `varchar(n)` only when domain enforces length limit
- **timestamptz always**: Use `timestamptz` instead of `timestamp` to store timezone-aware timestamps consistently
- **uuid for external IDs**: Use `uuid` for primary keys when IDs may be exposed externally or generated client-side

## When to Apply

- Choosing column types for new tables
- Migrating from other databases
- API-facing identifier design

## SQL Example

```sql
-- Create a user table using recommended Postgres data types
CREATE TABLE contact (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  score numeric(5, 2),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
```

## Related Files

- guides/schema-design-guide.md
- lookup/data-type-reference.md

## Reference

- PostgreSQL Documentation: <https://www.postgresql.org/docs/current/>