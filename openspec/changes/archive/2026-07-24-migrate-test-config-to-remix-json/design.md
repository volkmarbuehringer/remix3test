# Design

## remix.json

Static JSON at project root referencing `$schema`. All test fields under the `"test"` key. No inline Playwright config — references `playwright.config.ts` via `"configFile"`.

## playwright.config.ts

Extracted from the old inline `playwrightConfig`. Contains:
- Two browser projects: chromium, firefox
- `navigationTimeout: 5_000`
- `actionTimeout: 5_000`

## File deletion

`remix-test.config.ts` removed since the CLI no longer reads it.

## Verification

`npm test` — all tests pass, no `DATABASE_URL` error.
