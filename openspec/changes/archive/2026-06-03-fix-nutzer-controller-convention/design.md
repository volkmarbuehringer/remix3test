## Context

The `nutzer` route was relocated from `/admin/nutzer` to `/nutzer` (top-level) in a prior change but the controller file retained its `admin-` prefixed name. `remix doctor` checks sub-routes of the top-level `routes` object and expects controllers at `app/actions/<key>/controller.tsx`. Only `nutzer` violates this — `client` already follows the convention.

## Goals / Non-Goals

**Goals:**

- Eliminate the `remix doctor` warning by placing the controller at the expected path
- Remove the misleading `admin-` prefix from a non-admin-prefixed route's controller
- Follow the same convention as `app/actions/client/controller.tsx`

**Non-Goals:**

- Restructuring any other controllers — other routes use flat-file naming and don't trigger warnings

## Decisions

### Decision 1: Directory structure (`nutzer/controller.tsx`) rather than flat file (`nutzer-controller.tsx`)

**Rationale**: `remix doctor` specifically checks for `app/actions/<key>/controller.tsx`. A flat file `nutzer-controller.tsx` would likely still warn. The `client` sub-route already uses the directory pattern, establishing it as the convention.

### Decision 2: Move the test file to the same directory

**Rationale**: Co-locating tests with their source is the established pattern (e.g., all other test files live next to their controllers). Moving `admin-nutzer-controller.test.tsx` to `nutzer/controller.test.tsx` keeps this consistency.

## Risks / Trade-offs

| Risk                              | Mitigation                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Test imports break after move     | The test file imports `../actions/admin-nutzer-controller.tsx` — needs updating. That's the only internal import change needed. |
| Git history obscured by file move | Using `git mv` preserves history.                                                                                               |
