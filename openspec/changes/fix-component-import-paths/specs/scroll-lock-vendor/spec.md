## ADDED Requirements

### Requirement: lockScroll is available from a local module

A local module at `app/lib/scroll-lock.ts` SHALL export `lockScroll` with the same behavior as the removed `remix/ui/scroll-lock`. The implementation SHALL be copied from `packages/ui/src/popover/scroll-lock.ts` (73 lines) — a refcounted `WeakMap<Document, ...>` pattern that sets `overflow: hidden` on `<html>` and restores the original overflow value when all locks are released.

#### Scenario: lockScroll locks body scroll

- **WHEN** calling `lockScroll()`
- **THEN** `document.documentElement.style.overflow` is `"hidden"`

#### Scenario: lockScroll returns an unlock function

- **WHEN** calling the returned function
- **THEN** `document.documentElement.style.overflow` is restored to its original value

#### Scenario: Multiple concurrent locks are refcounted

- **WHEN** `lockScroll()` is called twice, producing two unlock functions
- **THEN** calling the first unlock function leaves scroll locked
- **THEN** calling the second unlock function restores scroll

#### Scenario: Calling unlock multiple times is idempotent

- **WHEN** calling the unlock function more than once
- **THEN** subsequent calls have no effect

### Requirement: Asset files import scroll-lock from local module

Two asset files SHALL import `lockScroll` from `app/lib/scroll-lock` instead of `remix/ui/scroll-lock`:

- `app/assets/appointments-scroll-lock.tsx`
- `app/assets/nav-toggle.tsx`

#### Scenario: Appointments scroll-lock resolves

- **WHEN** running `tsc --noEmit`
- **THEN** `app/assets/appointments-scroll-lock.tsx` has no module-resolution error for `app/lib/scroll-lock`

#### Scenario: Nav-toggle scroll-lock resolves

- **WHEN** running `tsc --noEmit`
- **THEN** `app/assets/nav-toggle.tsx` has no module-resolution error for `app/lib/scroll-lock`
