## 1. Update Asset Server Config

- [x] 1.1 Add `allowPackages: ['remix']` to `createAssetServer()` in `app/assets.ts`
- [x] 1.2 Remove `'node_modules/**'` from the `allow` array
- [x] 1.3 Remove `'node_modules/*path'` from the `fileMap`

## 2. Verify

- [x] 2.1 Run `npm test` to confirm no regressions
- [x] 2.2 Run `npm run typecheck` to confirm types pass
- [ ] 2.3 Start dev server and verify admin pages render without asset errors
