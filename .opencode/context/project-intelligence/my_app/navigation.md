<!-- Context: project-intelligence/my_app | Priority: high | Version: 1.14 | Updated: 2026-05-13 -->

# My App Context Index

**Overview**: Remix 3 scaffolded app with auth (login/register/logout), session middleware, and PostgreSQL database. Port 3000.

## Architecture & Patterns

| Reference | Description |
|-----------|-------------|
| [Architecture & Conventions](./concepts/architecture.md) | Route-to-controller mapping, middleware order, render utility, mixin library |
| [Request Context Usage](./guides/request-context-usage.md) | AppController binding, getContext vs get(), null guards |
| [Controller Convention Fix](./guides/controller-convention-fix.md) | `toDiskSegment()` route-to-disk mapping |
| [Mixin Architecture](./concepts/mixin-architecture.md) | 14 css() mixins in 4 files, theme contract |
| [CSS Mixin Usage](./guides/css-mixin-usage.md) | Creating/importing/composing mixins from `app/ui/mixins/` |

## UI Primitives

| Reference | Description |
|-----------|-------------|
| [UI Component Patterns](./guides/ui-component-patterns.md) | Skeleton, Toast, Hamburger, PromptButton, theme tokens |
| [Button Tone Convention](./concepts/button-tone-convention.md) | 4 tones: primary/secondary/ghost/danger, mixin cleanup |
| [Animation Adoption](./guides/animation-adoption.md) | `animateEntrance`/`animateExit` usage |
| [Button Tone Reference](./lookup/button-tone-reference.md) | Tone-to-action mapping |
| [Button Migration Gotchas](./errors/button-migration-gotchas.md) | State-driven composition, icon-only sizing |

**Button Tips**: 4 tones only. SSR+clientEntry work identically. Icon-only needs explicit w/h + flex centering. ~20 mixins removed across 33 buttons in 11 files.
**Animation Tips**: 3 files use `animateEntrance({ opacity: 0, translateY: 4px, duration: 180 })`. 1 file uses `animateExit({ opacity: 0, duration: 200 })`. All 180-200ms.

## Chat Feature

SSR-based chat using form POST + redirect. No Frames/SSE.

| Reference | Description |
|-----------|-------------|
| [Chat Architecture](./concepts/chat-architecture.md) | SSR approach, data flow |
| [Chat Testing Guide](./guides/chat-testing.md) | 3 test layers: DB, router, component |
| [Chat Pattern Reference](./lookup/chat-patterns.md) | Rate limiting, optimistic concurrency, error banner |

**Tips**: Rate limiting via `lastChatTime` (2s). Optimistic concurrency via `WHERE jsonb_array_length(conversation) = $len`. LLM errors redirect with `?error=`. ChatId validation: `/^[a-zA-Z0-9_-]+$/`.

## Messages Feature

Realtime message board using Frame + SSE + clientEntry.

| Reference | Description |
|-----------|-------------|
| [Messages Architecture](./concepts/messages-architecture.md) | Route structure, data flow |
| [Messages with Frames](./guides/messages-with-frames.md) | Frame + SSE + clientEntry composition |
| [Messages Pattern Reference](./lookup/messages-patterns.md) | Route table, key patterns |

**Tips**: Frame src = fragment route (`/messages/content`), not page shell. clientEntry returns `null` (side effects only). SSE uses module-level `Set<ReadableStreamDefaultController>`. Flat files for single-action routes; directory controller for multi-action.

## Common Errors

| Reference | Description |
|-----------|-------------|
| [Inline Script Limitations](./errors/inline-script-limitations.md) | Why `<script>` fails in SSR; clientEntry fix |
| [Frame Rendering Gotchas](./errors/frame-rendering-gotchas.md) | response.body breaks Frame SSR, navigate() reliability |
| [Multi-Client SSE Gotchas](./errors/messages-sse-gotchas.md) | No heartbeat, unsafe Set iteration, missing abort handler |
| [Context API Limitations](./errors/context-api-limitations.md) | handle.context only works with clientEntry |
| [VDOM Testing Gotchas](./errors/vdom-testing-gotchas.md) | Button node type is function ref, theme contract naming |

## E2E Testing

Playwright on real HTTP servers (random ports).

| Reference | Description |
|-----------|-------------|
| [E2E Architecture](./concepts/e2e-testing-architecture.md) | `createTestServer()`, DB init |
| [E2E Testing Guide](./guides/e2e-testing.md) | Step-by-step guide |
| [E2E Pattern Reference](./lookup/e2e-patterns.md) | Credentials, locators, waits |

**Tips**: `createTestServer()` on port 0 for parallel safety. `top-level await initializeAppDatabase()` is idempotent. `waitUntil: 'load'` for SSE/Frame pages, `'networkidle'` for standard pages. Unique emails via `Date.now()` + random.

## Test Coverage

3 tiers: ~73 tests across 15 files.

| Reference | Description |
|-----------|-------------|
| [Testing Conventions](./concepts/testing-conventions.md) | Framework, auth, coverage |
| [Test Coverage Guide](./guides/test-coverage.md) | Three-tier how-to |
| [Test Pattern Reference](./lookup/test-patterns.md) | Setup templates, session cookies |

**Tips**: Tiers: `remix/test` for units, `router.fetch()` for integration, VDOM for components. Session auth: `sessionStorage.save()` + `sessionCookie.serialize()`. Status codes: 200/302/400/401/429.

## Client Runtime Lab

50/50 split layout with server-side rendering. Sortable columns, inline editing, pagination, edit form. No Frame. Uses clientEntry + event delegation.

| Reference | Description |
|-----------|-------------|
| [Inline Editing](./guides/inline-editing-patterns.md) | clientEntry editing, sortable columns |
| [Client Route Layout](./guides/client-route-layout.md) | 50/50 split, Frame removal rationale |
| [Client Pagination + Sort](./guides/client-pagination-sort.md) | `paginate()`/`parseSort()`, URL-based sort |
| [Delete Confirmation](./guides/delete-confirmation-pattern.md) | Event delegation + confirm() |

**Tips**: Frame removed — direct SSR reduces overhead. All interactivity via `document.addEventListener` + `closest()`. `paginate()` + `parseSort()` validate before DB query. Edit preserves context via hidden `_offset/_sort/_order` fields. 200 mock rows in memory — no database. No auth — public route.
