## 1. Route Definition Refactoring

- [x] 1.1 Replace `route('chat', { index: get('/'), action: post('/') })` with `form('chat')` in `app/routes.ts`
- [x] 1.2 Replace `route('agent', { index: get('/'), action: post('/') })` with `form('agent')` in `app/routes.ts`
- [x] 1.3 Replace `route('workflow', { index: get('/'), action: post('/') })` with `form('workflow')` in `app/routes.ts`

## 2. Verification

- [x] 2.1 Run `pnpm run typecheck` to verify type correctness
- [x] 2.2 Run `pnpm test` to verify no test regressions
