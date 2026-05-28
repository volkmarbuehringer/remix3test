<!-- Context: development/postgres/examples/table-examples | Priority: medium | Version: 1.0 | Updated: 2026-05-20 -->

# Postgres Table Examples

## Basic User Table with UUID

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text,
  created_at timestamptz DEFAULT now()
);
```

## Partial Index for Active Users

```sql
CREATE INDEX idx_users_active ON users(email) WHERE status = 'active';
```

## Composite Index for Common Query

```sql
CREATE INDEX idx_orders_user_status ON orders(user_id, status) WHERE status IN ('pending', 'processing');
```

## Related Files

- concepts/data-types.md
- concepts/indexing.md
- lookup/quick-reference.md

## Reference

- PostgreSQL Documentation: <https://www.postgresql.org/docs/current/>