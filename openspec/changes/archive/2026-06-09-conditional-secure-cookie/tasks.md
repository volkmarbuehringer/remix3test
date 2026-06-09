## 1. Change `secure` flag to be conditional

- [x] 1.1 In `app/middleware/session.ts`, change `secure: true` to `secure: process.env.NODE_ENV === 'production'`
- [x] 1.2 Verify the file still loads: `process.loadEnvFile('./.env')` runs before this line so `NODE_ENV` is available

## 2. Verify

- [x] 2.1 Run `npm run typecheck` — no new type errors
- [x] 2.2 Run `npm test` — 789/789 pass, 0 failures
- [ ] 2.3 Optional: start `pnpm start` and test login over HTTP on a mobile device
