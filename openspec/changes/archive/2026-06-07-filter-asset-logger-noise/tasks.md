## 1. Replace logger with filtered variant

- [x] 1.1 Replace `logger({ format: '...' })` in `app/middleware/root.ts` with a custom middleware that calls the real logger only for non-asset requests or asset errors

## 2. Code review fixes

- [x] 2.1 Export `skipAssetsLogger` and add JSDoc
- [x] 2.2 Set `Logger` context key in asset path for consistency
- [x] 2.3 Add `app/middleware/root.test.ts` with 3 test cases

## 3. Verify

- [x] 3.1 Run `npm run typecheck`
- [x] 3.2 Run tests to confirm no regression
