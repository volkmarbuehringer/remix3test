## MODIFIED Requirements

### Requirement: Multiple controllers can be exported from a single `controller.tsx`

When a feature directory contains multiple sub-routes (e.g., `auth.login`, `auth.register`), the parent `controller.tsx` SHALL export each sub-route handler as a named export using `createController` or `createAction`. Page components SHALL be extracted to a co-located `pages.tsx` file.

#### Scenario: Sub-route controllers are named exports

- **WHEN** a feature directory contains multiple sub-route handlers
- **THEN** each handler SHALL be a named export (e.g., `export const authLogin = createController(...)`)
- **AND** there SHALL be no default export in the file

#### Scenario: Page components are extracted to pages.tsx

- **WHEN** a merged controller file has page components exceeding ~100 lines
- **THEN** those components SHALL be extracted to `./pages.tsx` in the same directory
- **AND** `controller.tsx` SHALL import them from `./pages.tsx`

#### Scenario: Router imports from the consolidated path

- **WHEN** controllers are consolidated into a feature directory
- **THEN** `app/router.ts` SHALL import all handlers from the single feature directory path
- **AND** each handler SHALL be mapped to its route using the existing `router.map()` or `router.get()`/`router.post()` pattern

#### Scenario: Plain function handlers remain plain

- **WHEN** a sub-route handler is a plain async function (not wrapped in `createController`)
- **THEN** it SHALL remain a plain named export in the consolidated file
- **AND** it SHALL be wired with `router.get()` or `router.post()` as before
