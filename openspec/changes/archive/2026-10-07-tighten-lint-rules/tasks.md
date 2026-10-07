## 1. Author the change

- [x] 1.1 Create the `tighten-lint-rules` change with proposal, spec delta, design, and tasks
- [x] 1.2 Validate the change with `openspec validate tighten-lint-rules`

## 2. Enable the rule

- [x] 2.1 Add `"typescript/no-floating-promises": "error"` to the TypeScript override in `.oxlintrc.json`
- [x] 2.2 Confirm the built-in categories remain `"off"`

## 3. Annotate floating-promise sites

- [x] 3.1 Annotate `app/actions/lists/public/lists-client.tsx` (57 sites)
- [x] 3.2 Annotate `app/ui/appointment-grid.browser.tsx` (34 sites)
- [x] 3.3 Annotate the remaining ~20 files (76 sites)
- [x] 3.4 Confirm no finding remains: `npx oxlint --type-aware -D no-floating-promises` reports 0

## 4. Verify and commit

- [x] 4.1 `npm run typecheck`
- [x] 4.2 `npm run lint` (0 warnings, 0 errors)
- [x] 4.3 `npm test` (full suite)
- [x] 4.4 Commit `.oxlintrc.json`, the annotated files, and the change artifacts with explicit pathspecs
