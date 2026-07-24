# Spec: Adopt Remix database lifecycle APIs

## Files to create

- `db/migrations/20260724000001_create_all/up.sql` — all CREATE TABLE statements
- `db/migrations/20260724000001_create_all/down.sql` — all DROP TABLE statements
- `app/db.ts` — exports `db`, `getMigrations`, `seed`, `closeAppDatabase`

## Files to modify

- `app/data/connection.ts` — pass config object instead of Pool to adapter
- `app/data/seed.ts` — change `pool.query(...)` to `db.exec(sql\`...\`)`
- `app/data/setup.ts` — use `db.reset({ migrations, seed })`
- `test/setup.ts` — import from `app/db.ts`, use `db.reset()`
- `server.ts` — update `closeAppDatabase()` import if needed

## Files to delete

- `app/data/migrate.ts`

## Field mapping (adapter)

```
Before:                          After:
pool = new Pool({...})           adapter = createPostgresDatabaseAdapter({
adapter =                          connectionString: DATABASE_URL,
  createPostgresDatabaseAdapter(   max: 20, ...
    pool                         })
)
```

## Seed changes

`pool.query(...)` calls in `seed.ts` become `db.exec(sql\`...\`)`.

## Test setup

`initializeAppDatabase()` → `db.reset({ migrations: await getMigrations(), seed })`
