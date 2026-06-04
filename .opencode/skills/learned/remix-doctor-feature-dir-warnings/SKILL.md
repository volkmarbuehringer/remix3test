---
name: remix-doctor-feature-dir-warnings
description: "Understand why remix doctor floods false warnings after migrating controllers to directory-per-feature (controller.tsx in dirs)"
user-invocable: false
origin: auto-extracted
---

# Remix Doctor False Warnings with Feature-Directory Controllers

**Extracted:** 2026-06-04
**Context:** After migrating newapp's flat `app/actions/*-controller.tsx` files into feature directories (e.g., `admin-appointments/controller.tsx`), `remix doctor` produces a flood of "does not match any route map" warnings for every controller.

## Problem

After restructuring controllers into feature directories, `remix doctor` emits warnings like:

```
• [WARN] Root route map has files under app/actions, but is missing action controller app/actions/controller.tsx.
• [WARN] Action controller app/actions/admin-appointments/controller.tsx does not match any route map.
• [WARN] Action controller app/actions/home/controller.tsx does not match any route map.
```

And for every new directory that lacks a direct route key match:
```
• [WARN] Directory app/actions/auth does not match any route-map key path.
```

These are **false positives** — all routes work correctly via `router.ts` explicit mapping.

## Root Cause

The remix doctor uses flat-file naming conventions to associate controller files with route trees:

1. It looks for `app/actions/controller.tsx` as the root route map controller
2. It tries to match `*-controller.tsx` filenames against route keys (e.g., `admin-appointments-controller.tsx` → `admin.appointments`)
3. It expects each `app/actions/` subdirectory to correspond to a route-map key path

With the directory-per-feature pattern:
- Controllers are named `controller.tsx` (canonical entry point), not `feature-controller.tsx`
- Route mapping is done purely in `router.ts` via `router.map(routes, controller)` — not inferred from filenames
- Directories like `auth/` may contain shared test files without a controller
- The root controller is at `home/controller.tsx`, not `controller.tsx`

## Solution

**These warnings are benign and expected.** The established feature-directory pattern used by `client/` and `nutzer/` would produce identical warnings. The migration is functionally correct if:

1. `router.ts` imports all controllers from their new paths
2. Typecheck passes with zero errors
3. All tests pass

No action is needed — the doctor's heuristics simply don't understand the directory-per-feature convention. A future update to the doctor could add awareness, but it's not a correctness issue.

## Verification Checklist

If you see these warnings after a controller migration, confirm:

- [ ] `router.ts` imports each controller from the correct feature-dir path
- [ ] `npm run typecheck` passes
- [ ] `npx remix test` passes
- [ ] No flat `*-controller.tsx` files remain in `app/actions/` root

## When to Use

- After any structural migration that changes `app/actions/` layout
- When debugging `remix doctor` output after refactoring controllers
- When onboarding someone to the feature-directory pattern in newapp
