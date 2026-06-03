## Why

`remix doctor` warns: "Route map 'nutzer' is missing action controller `app/actions/nutzer/controller.tsx`."

The `/nutzer` route was previously at `/admin/nutzer` and its controller file still carries the stale `admin-` prefix (`admin-nutzer-controller.tsx`). After being moved to top-level, it should follow the same convention as `app/actions/client/controller.tsx` — the only other top-level sub-route with its own controller.

## What Changes

- Move `app/actions/admin-nutzer-controller.tsx` → `app/actions/nutzer/controller.tsx`
- Move `app/actions/admin-nutzer-controller.test.tsx` → `app/actions/nutzer/controller.test.tsx`
- Update the import in `app/router.ts` from `./actions/admin-nutzer-controller.tsx` to `./actions/nutzer/controller.tsx`
- `remix doctor` warning resolved

## Capabilities

### New Capabilities

None — pure file reorganization, no behavior changes.

### Modified Capabilities

None.

## Impact

- **Files moved**: `admin-nutzer-controller.tsx` → `nutzer/controller.tsx`, `admin-nutzer-controller.test.tsx` → `nutzer/controller.test.tsx`
- **Files modified**: `app/router.ts` (import path)
- **Breaking changes**: none
- **Tests**: 733 pass, 0 fail — no logic changes, only file paths
