## 1. globalSetup — create temp database, migrate, seed

- [x] 1.1 In `test/setup.ts`, construct a unique temp database name (`newapp_test_<epoch-ms>_<pid>`)
- [x] 1.2 Create an admin `pg.Pool` connecting to the `postgres` maintenance database using the same credentials as `DATABASE_URL`
- [x] 1.3 Issue `CREATE DATABASE "newapp_test_<...>"` and close the admin pool
- [x] 1.4 Update `process.env.DATABASE_URL` to point to the temp database
- [x] 1.5 Dynamically import `app/data/setup.ts` and call `initializeAppDatabase()` to run migration + seed

## 2. globalTeardown — close pool, drop temp database

- [x] 2.1 Import and close the app pool from `app/data/connection.ts`
- [x] 2.2 Create an admin `pg.Pool` to the `postgres` maintenance database
- [x] 2.3 Issue `DROP DATABASE IF EXISTS "newapp_test_<...>"` and close the admin pool

## 3. Validate and test

- [x] 3.1 Run `npm test` and confirm all tests pass against the ephemeral database
- [x] 3.2 Verify the temp database is dropped after tests complete
- [x] 3.3 Verify no orphan databases remain after normal runs
- [x] 3.4 Run `npm run typecheck` to confirm no type errors
