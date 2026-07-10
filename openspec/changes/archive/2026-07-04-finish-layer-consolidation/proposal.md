## Why

The first pass (`consolidate-architecture-layers`) flipped the audit-log seam, lifted the nutzer controller into `app/data/nutzer.ts`, and made workflow registration explicit, but ~66 `pool.query` calls remain in 17 other controllers, `app/lib/` still holds 18 files (an explicit AGENTS.md violation), 15 `app/ui/**` files still import types from `actions/.../controller.tsx`, and the `app/router.ts` module-level singleton is still consumed by 43 test files (defeating per-test cookie/storage overrides). This change finishes the job so the long-tail matches the exemplary `data/appointments.ts` + `data/nutzer.ts` pattern, `app/lib/` no longer exists, and the composition root is dependency-injected end to end.

## What Changes

- **Lift remaining `pool.query` controllers into `app/data/` repositories.** For each domain that still executes raw SQL (`verwaltung/offerings`, `verwaltung/appointments`, `verwaltung/offering-configs`, `verwaltung/report1`, `verwaltung/pdf`, `verwaltung/users-pdf`, `verwaltung/users-export`, `admin/lists`, `admin/messages`, `appointment`, `appointments-new`, `uploads`, `settings`, `webhook`, `app-webhook`, `webhook-requests`, `webhook-requests/create`, `callback`), create or extend a repository module under `app/data/` modeled on `data/appointments.ts` / `data/nutzer.ts`. Controllers and middleware consume repositories via `context.db` only; no `pool.query`, `pool.connect(`, `BEGIN`, `COMMIT`, or `ROLLBACK` survives outside `app/data/**`. The `app/middleware/uploads.ts` pool query also moves.
- **Move shape types out of controllers.** Every `Row`/`Option` type currently declared inside an `actions/.../controller.tsx` (e.g. `OfferingRow`, `OfferingsResourceOption`, `AppointmentRow`, `AppointmentResourceOption`, `AppointmentUserOption`, `OfferingConfigRow`, `OfferingConfigResourceOption`, `WebhookRequestRow`, `Report1Row`, `DayWithSlots`, `ResourceOption`) moves to its owning repository in `app/data/`. The 15 `app/ui/**` files switch their imports to `app/data/**` (or `app/types/**` for the rare cross-cutting DTO with no repository owner).
- **Promote `app/lib/lists-api.ts` and `app/lib/chatlog.ts` into `app/data/`.** They are domain modules with SQL; they belong in `app/data/lists.ts` and `app/data/chatlog.ts` using `Database`, not `Pool`, with the boundary enforced by section 1.
- **Eliminate `app/lib/`.** The 18 remaining `app/lib/*` files relocate by responsibility: theme primitives (`theme.ts`, `theme/`, `button.ts`, `glyph.ts`, `glyph/`, `separator.ts`, `separator/`) → `app/ui/theme/`; pure utilities (`request-ip.ts`, `sensitive-headers.ts`, `math.ts`, `scroll-lock.ts`, `sse.ts`, `sse-events.ts`, `messages-sse.ts`, `appointments-sse.ts`, `appointtype-drag.ts`) → `app/utils/`. `app/lib/` does not exist after this change.
- **Drop `app/lib/**` from the asset allow list.** `app/assets.ts:12`'s `allow` array loses its `app/lib/**` entry now that no file lives there.
- **Remove the router singleton and migrate test consumers.** `app/router.ts` stops exporting `export const router = createNewappRouter()`; only `createNewappRouter` (and types) remain. `app/test-utils.ts` constructs its own router via `createNewappRouter({ ... })`. The 43 test files that currently `import { router } from '../../router.ts'` switch to a small shared test helper (`app/test-router.ts`) that constructs the singleton once and re-exports it, preserving test runtime behavior while making `app/router.ts` itself side-effect-free at module level.
- **No DB schema migrations, no HTTP route changes, no dependency additions, no user-facing behavior changes.** This is a pure refactor.

## Capabilities

### New Capabilities

- `remaining-data-repositories`: The remaining controllers (offerings, appointments, appointment, appointments-new, offering-configs, report1, pdf, users-pdf, users-export, admin/lists, admin/messages, uploads, settings, webhook, app-webhook, webhook-requests, webhook-requests/create, callback) and the uploads middleware consume typed repository functions from `app/data/**` only; no raw SQL remains outside `app/data/**`.
- `app-lib-elimination`: Disk layout where `app/lib/` does not exist; theme primitives live under `app/ui/theme/`, domain modules under `app/data/`, and pure utilities under `app/utils/`; the asset allow list excludes `app/lib/**`.

### Modified Capabilities

- `router-composition-root`: The `export const router` singleton at `app/router.ts:139` is removed; test consumers go through a shared test helper that constructs the single instance, and `app/test-utils.ts` builds its own router for cookie/storage overrides.

## Impact

- **New/modified files (representative, not exhaustive)**:
  - New repositories: `app/data/offerings-queries.ts`, `app/data/appointments-queries.ts`, `app/data/appointments-new-queries.ts`, `app/data/offering-configs-queries.ts`, `app/data/admin-lists.ts`, `app/data/admin-messages.ts`, `app/data/webhook-requests.ts`, `app/data/webhook-requests-create.ts`, `app/data/callback.ts`, `app/data/webhook.ts`, `app/data/app-webhook.ts`, `app/data/uploads.ts`, `app/data/settings.ts`, `app/data/report1.ts`, `app/data/pdf.ts`, `app/data/users-pdf.ts`, `app/data/users-export.ts`, `app/data/appointment.ts`, `app/data/lists.ts` (moved from `app/lib/lists-api.ts`), `app/data/chatlog.ts` (moved from `app/lib/chatlog.ts`).
  - Modified: 17 controllers (aktionen, etc.) drop `pool.query`; `app/middleware/uploads.ts` uses the new `uploads` repository; `app/router.ts` loses the singleton and the singleton stays in a new `app/test-router.ts` for test consumers; ~43 test files re-export the singleton from `app/test-router.ts` (single-line per file); `app/test-utils.ts` constructs its own router; `app/assets.ts:12` allow list drops `app/lib/**`.
  - New: `app/ui/theme/` (absorbs `app/lib/theme*`, `glyph*`, `separator*`, `button.ts`); pure utilities move into existing `app/utils/`.
- **No DB schema migrations, no HTTP route changes, no new dependencies.**
- **Tests**: each raw-`pool.query` co-located test stays behaviorally green because the router is invoked via the integration test seam; only the source path of the `router` singleton import changes per file.
- **Risk**: pure refactor; behavior-preserving if done in small, typecheck+test-green commits. Rollback is `git revert`.
