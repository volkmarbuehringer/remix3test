## 1. Update routes.ts

- [x] 1.1 Import `resources` from `remix/routes` in `app/routes.ts` (add to the existing import line)
- [x] 1.2 Replace the manual `users` admin route block with `resources('users')`
- [x] 1.3 Replace the manual `resources` admin route block with `resources('resources')`
- [x] 1.4 Replace the manual `types` appointment route block with `resources('types')`
- [x] 1.5 Verify TypeScript compiles: `npm run typecheck`

## 2. Verify

- [x] 2.1 Run existing tests to confirm no regressions: `npm test` (540/546 pass; 6 pre-existing failures in appointment-grid.test.ts unrelated to this change)
- [x] 2.2 Lint: `npm run lint`
