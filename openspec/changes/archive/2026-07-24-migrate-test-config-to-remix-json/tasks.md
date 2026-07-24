# Tasks

- [x] Create `playwright.config.ts` with inline config extracted from `remix-test.config.ts`
- [x] Create `remix.json` with `"test"` fields mapped from `remix-test.config.ts`, referencing `playwright.config.ts` via `"playwright"."configFile"`
- [x] Delete `remix-test.config.ts`
- [x] Run `npm test` to verify

## Dependencies

- `playwright.config.ts` must exist before `remix.json` references it
- Otherwise tasks are independent
