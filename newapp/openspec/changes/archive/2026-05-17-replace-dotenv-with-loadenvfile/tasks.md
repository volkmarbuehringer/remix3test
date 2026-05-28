## 1. Code Changes

- [x] 1.1 Replace `import 'dotenv/config'` with `process.loadEnvFile('./.env')` in `server.ts`
- [x] 1.2 Replace `import 'dotenv/config'` with `process.loadEnvFile('./.env')` in `server.neu`
- [x] 1.3 Replace `import 'dotenv/config'` with `process.loadEnvFile('./.env')` in `app/middleware/session.ts`
- [x] 1.4 Replace `import 'dotenv/config'` with `process.loadEnvFile('./.env')` in `app/data/setup.ts`

## 2. Dependency Cleanup

- [x] 2.1 Remove `dotenv` from `dependencies` in `package.json`
- [x] 2.2 Run `pnpm install` to regenerate `pnpm-lock.yaml`

## 3. Verification

- [x] 3.1 Run `npm run typecheck` to verify no type errors
- [x] 3.2 Run `npm run lint` to verify no lint errors
- [x] 3.3 Start the app (`npm run start`) and confirm it serves requests without dotenv-related errors
