## 1. Author the change

- [x] 1.1 Create the `curate-suspicious-rules` change with proposal, spec delta, design, and tasks
- [x] 1.2 Validate the change

## 2. Enable the rules

- [x] 2.1 Add the four curated rules to the shared override in `.oxlintrc.json`
- [x] 2.2 Confirm the built-in categories remain `"off"`

## 3. Fix findings

- [x] 3.1 Replace mutating `sort()`/`reverse()` with `toSorted()`/`toReversed()`
- [x] 3.2 Attach `cause` in `scripts/postinstall.ts`
- [x] 3.3 Guard the unsafe optional chain in `app/actions/agent-events/controller.test.ts`
- [x] 3.4 Confirm zero findings for the four rules

## 4. Verify and commit

- [x] 4.1 `npm run typecheck`
- [x] 4.2 `npm run lint` (0 warnings, 0 errors)
- [x] 4.3 `npm test` (full suite)
- [x] 4.4 Commit with explicit pathspecs and archive the change
