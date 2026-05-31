<!-- Context: development/postgres/concepts/indexing | Priority: medium | Version: 1.0 | Updated: 2026-05-20 -->

# Postgres Indexing Concepts

Indexes accelerate queries but add write overhead. Choose strategic indexing based on query patterns.

## Key Points

- **B-tree default**: Standard index for equality and range queries on scalar types
- **Partial indexes**: Index subsets where queries commonly filter (e.g., `WHERE active = true`)
- **Composite indexes**: Order matters — match lead columns to query filter sequence
- **Covering indexes**: Include frequently accessed columns to avoid heap lookups (`INCLUDE`)
- **GIN with `gin_trgm_ops`**: Accelerates `ILIKE '%pattern%'` on text — the only index type that works with leading wildcards

## When to Apply

- Query performance issues
- High-write workload optimization
- Large table scans

## GIN Indexes for Text Search

`ILIKE '%pattern%'` with a leading `%` is a **non-sargable** predicate — B-tree indexes cannot accelerate it. A GIN (Generalized Inverted Index) with the `pg_trgm` extension provides trigram-based matching.

### Setup

```sql
-- One-time: enable the pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index on a text column
CREATE INDEX idx_lists_desc ON lists USING GIN (description gin_trgm_ops);
```

### How It Works

- `pg_trgm` splits text into 3-character trigrams (e.g., `"hello" → " he", "hel", "ell", "llo", "lo "`)
- The GIN index stores trigram → row mappings — inverted index structure
- `ILIKE '%pattern%'` is decomposed into the query's trigrams, then GIN finds matching rows via set intersection
- Works for both `'%pattern'` (suffix) and `'%pattern%'` (mid-string) patterns

### When to Use

| Use GIN trigram | Don't use GIN trigram |
|----------------|----------------------|
| `ILIKE '%search%'` on text columns | `= 'exact match'` (use B-tree) |
| User-facing search bars | `LIKE 'prefix%'` (use B-tree on varchar_pattern_ops) |
| Fuzzy matching on names, descriptions | Columns with very short values (<3 chars — trigrams don't form) |

### Why Not `jsonb_path_ops`?

`jsonb_path_ops` is a GIN operator class for **JSON containment operators** (`@>`, `?`, `?|`, `?&`). It does **not** accelerate:

- `ILIKE` on jsonb values
- Any text search pattern matching
- The `->> 'label'` accessor

Use `jsonb_path_ops` only for `WHERE data @> '{"key": "val"}'` queries. For searching inside JSON arrays, use `jsonb_array_elements()` + `ILIKE` — these run as sequential scans on the (typically small) array, which is acceptable.

### Trade-offs

- **Write overhead**: GIN indexes are more expensive to maintain than B-tree — each write updates the trigram map
- **Index size**: GIN indexes can be 2-3x the size of equivalent B-tree indexes
- **Not for high-write tables**: Prefer B-tree for tables with frequent INSERT/UPDATE/DELETE
- **Extension required**: `pg_trgm` must be installed on the database (requires superuser or manual DBA action)

## SQL Example

```sql
-- B-tree index for equality and range lookups
CREATE INDEX idx_user_email ON users(email);

-- Partial index for commonly filtered subset
CREATE INDEX idx_user_active ON users(email) WHERE active = true;

-- Composite index matching query filter order
CREATE INDEX idx_order_user_status ON orders(user_id, status);

-- Covering index to avoid heap lookups
CREATE INDEX idx_order_covering ON orders(user_id) INCLUDE (total, created_at);
```

## Related Files

- guides/query-optimization-guide.md
- examples/index-examples.md

## Reference

- PostgreSQL Documentation: <https://www.postgresql.org/docs/current/>