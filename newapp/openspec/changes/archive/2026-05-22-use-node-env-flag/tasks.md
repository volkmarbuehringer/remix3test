## 1. Package.json scripts

- [x] 1.1 Add `--env-file-if-exists=.env` to the `dev` script's `node` invocation
- [x] 1.2 Add `--env-file-if-exists=.env` to the `start` script's `node` invocation

## 2. Remove `process.loadEnvFile` from server entry points (covered by CLI flag)

- [x] 2.1 Remove `process.loadEnvFile('./.env')` from `server.ts`
- [x] 2.2 Remove `process.loadEnvFile('./.env')` from `server.new`

## 3. Keep `process.loadEnvFile` in shared modules (needed for test context)

- [x] 3.1 Keep `process.loadEnvFile('./.env')` in `app/data/setup.ts` — tests import this directly
- [x] 3.2 Keep `process.loadEnvFile('./.env')` in `app/middleware/session.ts` — tests import this directly

## 4. Verify

- [x] 4.1 Run `npm run typecheck` to confirm no type errors
- [x] 4.2 Start dev server and confirm it boots without errors
