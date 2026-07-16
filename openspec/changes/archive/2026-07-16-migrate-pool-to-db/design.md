## Approach

For each raw SQL pattern, there are three possible outcomes:

### 1. Direct `db.*` replacement (most common)

Simple SELECT/JOIN/WHERE/ORDER BY → `db.findMany()`, `db.findOne()`, `db.find()`, or the query builder chain.

**Pattern:**
```ts
// Before
let client = await pool.connect()
try {
  let result = await client.query('SELECT ... FROM table WHERE col = $1', [val])
  return result.rows
} finally {
  client.release()
}

// After
return db.findMany(table, { where: { col: val } })
```

### 2. Query builder chain (JOINs, compound WHERE)

Multi-table queries with `leftJoin`, compound `where` conditions, etc.

**Pattern:**
```ts
db.query(appointments)
  .leftJoin(users, eq('user_id', 'users.id'))
  .where(gte('date', start))
  .where(lte('date', end))
  .orderBy('date', 'asc')
  .limit(50)
  .all()
```

### 3. `db.exec()` for non-builder SQL

Must stay as parameterized SQL when the builder can't express the pattern:

```ts
db.exec(sql`
  SELECT role, count(*)::int AS count
  FROM users
  ${role ? sql`WHERE role = ${role}` : sql``}
  GROUP BY role ORDER BY role
`)
```

## Migration Rules

1. **One file per task** — each file gets its own task with all queries migrated in one pass
2. **Preserve parameterization** — all existing `$1`, `$2` bindings become typed `db.*` arguments
3. **Preserve ordering** — `ORDER BY`, `LIMIT`, `OFFSET` must match exactly
4. **No behavior changes** — the resulting rows/values must be identical. If a tool does `result.rows.map(r => ({ id: r.id, name: r.name }))`, the db equivalent's result shape must match
5. **Import changes** — each file may need to import `db` instead of `pool` (or in addition to `pool` for the remaining raw queries)
6. **COALESCE → JS fallback** — replace SQL `COALESCE(col, 'default')` with JS-side `?? 'default'`
7. **Type casts** — `::int`, `::text`, `::bigint` casts are unnecessary with typed db methods (TypeScript handles types)
