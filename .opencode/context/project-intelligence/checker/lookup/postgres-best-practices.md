<!-- Context: project-intelligence/checker/lookup/postgres-best-practices | Priority: medium | Version: 1.0 | Updated: 2026-04-20 -->

# PostgreSQL Best Practices

> Essential guidelines for Postgres schema design in the checker project. Focuses on data type selection for reliable storage and query performance.

## Core Concepts

PostgreSQL schema design requires careful data type selection. Prefer `text` over constrained `varchar` for flexibility, use timezone-aware timestamps for global applications, and use UUIDs for externally-exposable primary keys.

## Key Points

1. **Text over varchar**: Use `text` instead of `varchar(n)` unless domain enforces a hard length limit (e.g., country codes, postal codes).

2. **Timestamp with timezone**: Always use `timestamptz` instead of `timestamp` to store UTC-aware timestamps that display correctly across timezones.

3. **UUID for external IDs**: Use `uuid` type for primary keys when IDs may be exposed in URLs, APIs, or client-side generation contexts.

## Quick Reference

```sql
-- ✅ Preferred: text for unbounded strings
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT,
  created_at timestamptz DEFAULT NOW()
);

-- Avoid unless length is semantically meaningful
-- CREATE TABLE users (
--   email VARCHAR(255),  -- unnecessary constraint
-- );
```

## Related

- Schema design reference: `.agents/skills/postgres-best-practices/references/schema-design.md`
- Checker project structure: `navigation.md`