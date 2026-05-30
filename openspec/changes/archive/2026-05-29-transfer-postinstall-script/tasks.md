## 1. Cleanup

- [x] 1.1 Remove old `scripts/install-oxc-bindings.mjs`
- [x] 1.2 Remove old `scripts/patch-node-tsx.mjs`
- [x] 1.3 Fix `scripts/oxlint-plugins/` references in `.oxlintrc.json` if plugin paths change (keep plugins, they're still used)

## 2. Postinstall Script

- [x] 2.1 Create `scripts/postinstall.ts` adapted from `~/remix/scripts/postinstall.ts` — change Playwright CLI path to `node_modules/playwright/cli.js` and working directory to project root
- [x] 2.2 Add `"postinstall": "node ./scripts/postinstall.ts"` to `package.json`

## 3. Validation

- [x] 3.1 Run `pnpm run lint` to verify no lint errors
- [x] 3.2 Run `pnpm run typecheck` to verify no type errors
- [x] 3.3 Run `pnpm run test` to verify all tests still pass
- [x] 3.4 Run `pnpm install` to verify postinstall script executes correctly
