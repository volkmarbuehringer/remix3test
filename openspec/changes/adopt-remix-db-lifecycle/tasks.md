# Tasks

- [x] Create `db/migrations/20260724000001_create_all/` with up.sql and down.sql
- [x] Switch `connection.ts` to pass config to adapter
- [x] Create `app/db.ts` exporting db, getMigrations, seed, closeAppDatabase (merged into connection.ts, later removed)
- [x] Update `seed.ts` — replace pool.query() with db.exec()
- [x] Simplify `setup.ts` to use db.reset()
- [x] Update `test/setup.ts` to use db.reset()
- [x] Update `server.ts` imports if needed
- [x] Delete `app/data/migrate.ts`
- [x] Run `npm test` to verify
