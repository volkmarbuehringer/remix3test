## 1. Move controller file

- [x] 1.1 Create directory `app/actions/nutzer/`
- [x] 1.2 Move `app/actions/admin-nutzer-controller.tsx` → `app/actions/nutzer/controller.tsx` via `git mv`
- [x] 1.3 Move `app/actions/admin-nutzer-controller.test.tsx` → `app/actions/nutzer/controller.test.tsx` via `git mv`

## 2. Fix imports

- [x] 2.1 Update `app/router.ts`: import from `./actions/nutzer/controller.tsx`
- [x] 2.2 Fix relative imports in both moved files: `../` → `../../` (one directory deeper)

## 3. Verification

- [x] 3.1 Run `npx tsc --noEmit` — 0 errors
- [x] 3.2 Run `npm test` — all 733 tests pass
- [x] 3.3 Run `npx remix doctor` — 0 warnings, 0 advice
