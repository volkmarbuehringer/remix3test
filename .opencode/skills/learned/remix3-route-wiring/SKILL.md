---
name: remix3-route-wiring
description: "Use when adding or moving a Remix 3 route — adding a standalone route to the admin sidebar (SSE auth returns 401, `iframeNav: false`) and relocating a route between trees (admin frame-sidebar to top-level, frame to full-page), upgrading form validation to `parseSafe` + `context.render`, or deleting a route."
user-invocable: false
origin: consolidated
---

# Remix 3 Route Wiring

**Consolidated from:** `remix3-standalone-route-admin-sidebar`, `remix-route-relocation`

This skill is the **index** for wiring and moving routes in a Remix 3 app: registering a standalone route and exposing it in the admin sidebar, relocating a route between route trees, upgrading form validation to `parseSafe` + `context.render`, and deleting a route. For the route trees, controllers, frames, and rendering APIs themselves, use the vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) and the package READMEs it points at.

## Load Only The References You Need

| Symptom / task involves... | Start with |
| --- | --- |
| Adding a standalone route (webhook/API/SSE) and linking it from the admin sidebar; `renderAdminPage()` crashes or renders blank; `iframeNav: false`; an SSE endpoint returns 401 instead of a redirect; `requireSseAuth()` auth-state behavior | `references/standalone-route-admin-sidebar.md` |
| Moving a route between trees (admin frame-sidebar ↔ top-level, frame ↔ full-page); keeping the old URL alive; frame removal; upgrading form validation to `parseSafe` + `context.render`; deleting a route | `references/route-relocation.md` |

## Core Rules

**Standalone route + admin sidebar (`references/standalone-route-admin-sidebar.md`)**

- A route registered directly with `router.get()`/`router.post()` (or a named route-tree export composed via `router.map()`) is **not** under the admin tree and cannot use `renderAdminPage()` — the admin layout Frame navigation (`X-Remix-Target`) makes that crash or render blank. Register it outside the tree (vendor `remix` skill / guide chapter 02 on mapping controllers) and render it with its own `context.render(<Document title='…'><Layout><Page /></Layout></Document>)`. Link it from `app/ui/admin-layout.tsx` with `iframeNav: false`, which forces a full-page navigation (`document: true` instead of `target: frameTarget`). The CLI route-tree discovery note now lives in `remix3-build-and-tooling` (`references/cli-devops.md`).
- SSE and other non-interactive endpoints (EventSource, WebSocket) cannot follow `requireAuth()` HTTP 302s, so use the repo `requireSseAuth()` middleware (`app/middleware/sse-auth.ts`) — its `context.get(Auth)` behavior is **401** when `loadAuth()` is not installed, **401** when there is no valid session (`!auth.ok` or no `identity`), and pass-through when the session is valid — and for admin-only SSE use a role-aware guard that returns a plain 401/403 (`requireAdminSseAuth()`), never `requireAdmin`, whose redirect/HTML breaks `EventSource`. For client-IP extraction use the corrected two-tier trust model (`security-gotchas` → `references/two-tier-ip-trust-model.md`); do NOT enable `trustProxy: true` without a stripping reverse proxy, which lets clients spoof forwarded headers.

**Route relocation, validation upgrade, deletion (`references/route-relocation.md`)**

- **Relocating between trees:** move and remove the `routes.ts` entry and verify path nesting (`route('foo')` at top level produces `/foo`); keep the old URL alive with a same-origin redirect in the source tree — `Location: '/admin' + context.url.pathname + context.url.search`, always prepending a fixed prefix and never using the raw `pathname` as the whole Location. Update `router.map(<newRouteRef>, <controller>)`, register static children (`create`, `events`) **before** the parent dynamic `:id` resolver, and add a test proving the static child hits its own handler (an SSE `events` route must return `text/event-stream`, not the `:id` redirect). Add the route to the target nav (main navbar `NAV_SECTIONS`, sidebar, or both), remove it from the old nav location and the old `AdminNavItem` union, and update `route-labels.ts`. Then audit `grep -r 'old/path' app/` across controller redirect `Location` headers, page `ADMIN_BASE`/form `action`/cancel links, form components, ClientEntry/asset fetch URLs and `window.location.href` navigations, and tests, and fix relative-import depth (`git mv` one directory deeper adds a `../` to every relative import, surfacing as `TS2307`; for `public/` client entries see `remix3-build-and-tooling` → `references/browser-source-public-colocation.md`). When leaving the frame layout, replace `renderAdminPage(context.render, 'key', ...)` with `context.render(<Layout title='Page Title'><PageComponent /></Layout>)` imported from `app/ui/layout.tsx`, and remove every `data-rmx-target={frames.*}` and the `frames` import (plain `<a href>` navigates full-page). Preserve each handler redirect status: `redirect(url)` defaults to **302**, so a frame-PRG handler that returned an explicit **303** must keep `new Response(null, { status: 303, ... })`, with a test assertion to catch the regression.
- **Validation upgrade, review, and deletion:** upgrading form validation to `parseSafe` + `context.render` follows the full pattern in `form-error-handling-remix3`; afterward verify that `npm run typecheck` and `npm test` pass, no stale `old/path` and no `data-rmx-target` attributes remain, every text input has `inputErrorStyle` + `fieldErrorStyle`, required DB fields have `minLength(1)` in the schema, DB-error catch blocks re-render with a user-friendly message (no re-throw), and `route-labels.ts` is updated. Deleting a route entirely is a wider sweep than relocation — one missed reference breaks the **whole** test suite: remove the route tree **and its frame name** (`app/routes.ts` `frames`), the `router.map(...)` (`app/router.ts`), the re-export (`app/actions/admin/controller.tsx`), the `app/ui/admin-layout.tsx` nav item/icon case/`AdminNavItem` union member/`contentOnlyTargets`/`fullHeightTargets`, the frame from `ADMIN_FRAME_TARGETS` (`app/middleware/frame-redirect.ts`), the `ROUTE_LABELS` entry (`app/route-labels.ts`), the frame from `FRAME_TARGETS` (`app/ui/verwaltung-layout.tsx`), the frame from `getSelfFrameTarget` (`app/utils/frame-target.ts`), and the path from `AGENT_PATHS` (`app/middleware/skip-csrf.ts`). Two gotchas: grep by the **frame name** as well as the route path (`frames.<name>` lives in `frame-redirect.ts`, `verwaltung-layout.tsx`, and `frame-target.ts`; sweep with `grep -rn '<FrameName>\|routes.<tree>.<key>' app/`), and repair every reference before running any test because the test runner loads every controller transitively through the router — a to-be-deleted controller importing a moved file fails the ENTIRE `remix test` run with `Cannot find module ... imported from <deleted-controller>`.

## When to Use

- You are adding a new feature route that should appear in the admin sidebar but is not part of the admin route tree, or adding external-facing endpoints (webhooks, API routes, SSE) that need admin navigation.
- You are moving a route between route trees (admin frame-sidebar ↔ top-level, frame ↔ full-page) and need the route-definition, router-mapping, navigation, and URL-string checklist.
- You are removing a route entirely and must sweep every frame/nav/router/label reference before the test suite can load.
- You are upgrading form validation to `parseSafe` + `context.render` after (or during) a relocation, or verifying such a change with the post-relocation review checklist.
- An SSE endpoint returns 401 instead of redirecting, or `renderAdminPage()` crashes or blanks a standalone route.
- The vendor/docs do not cover these app-specific wiring deltas — they are version-pinned to this repo.

## Related Skills

- vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) — canonical route trees, controllers, frames, and `context.render` APIs these deltas build on
- `remix3-build-and-tooling` — `public/` client-entry colocation and the relative-import-depth checklist a route move triggers, plus the CLI route-tree discovery note
- `form-error-handling-remix3` — the full `parseSafe` + `context.render` validation-error pattern the relocation upgrade points at
- `security-gotchas` — client-IP trust and the two-tier model for SSE and standalone routes
- `remix-controllers` — `createController`/`createAction`, context keys, and controller consolidation
- `remix3-typesafe-url-audit` — converting hardcoded URLs to the typed routes tree, complementing the relocation URL audit
- `remix3-frame-cliententry` — `<Frame>` navigation and `clientEntry` hydration behind the frame-to-full-page moves

