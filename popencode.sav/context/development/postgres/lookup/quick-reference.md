<!-- Context: development/postgres/lookup/quick-reference | Priority: medium | Version: 1.0 | Updated: 2026-05-20 -->

# Postgres Quick Reference

## Data Types

| Type | Use Case |
| ---- | -------- |
| `text` | Default for strings |
| `timestamptz` | Timestamps with timezone |
| `uuid` | External-facing IDs |
| `bigint` | Large numeric IDs |
| `jsonb` | Semi-structured data |

## Index Types

| Index | Use Case |
| ---- | -------- |
| `B-tree` | Default, equality/range |
| `BRIN` | Large append-only tables |
| `GIN` | Full-text, arrays, jsonb |
| `GIN (gin_trgm_ops)` | `ILIKE '%pattern%'` on text — requires `pg_trgm` extension |
| `jsonb_path_ops` (GIN op class) | `@>` containment queries on jsonb — does NOT help text/ILIKE |
| `Partial` | Filtered subsets |

## Common Commands

```sql
-- Create table with recommended defaults
CREATE TABLE table_name (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now()
);

-- Add partial index
CREATE INDEX idx_active ON users(email) WHERE status = 'active';

-- Explain query plan
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = $1;
```

## Related Files

- concepts/data-types.md
- concepts/indexing.md
- examples/table-examples.md
- guides/schema-design-guide.md

## Reference

- PostgreSQL Documentation: <https://www.postgresql.org/docs/current/>