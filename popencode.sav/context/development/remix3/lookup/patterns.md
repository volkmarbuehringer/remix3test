<!-- Context: development/remix3/lookup | Priority: high | Version: 1.1 | Updated: 2026-05-07 -->

# Patterns Quick Reference

Common patterns for Remix Component development.

## State Management

| Pattern | When to Use |
|---------|-------------|
| Derive in render | Computed values from state |
| Store minimal state | Only what affects rendering |
| Event handler work | Do work in handlers, capture only final values |
| Uncontrolled input | Only user changes the value |

## Lifecycle

| Pattern | Use Case |
|---------|----------|
| `handle.queueTask()` | DOM operations after render |
| `handle.signal` | Cleanup on unmount (intervals, listeners) |
| `addEventListeners()` | Global events with auto-cleanup |
| Setup scope | One-time initialization, SDK setup |

## Data Loading

| Pattern | When to Use |
|---------|-------------|
| Event handler signal | User-triggered requests |
| `queueTask` in render | Reactive to prop changes |
| Setup scope | Initial-only data (no re-fetch) |

## Action Types & Middleware

| Pattern | Reference |
|---------|-----------|
| `Action` replaces `BuildAction` | `guides/action-type-patterns.md` |
| `Middleware<{}, Transform>` (no `_method` generic) | `guides/action-type-patterns.md` |
| Action-level middleware with `typeof middleware` | `guides/action-type-patterns.md` |
| `createContextKey<T>()` for typed context values | `guides/typed-context.md` |

## Frame Navigation

| Pattern | Reference |
|---------|-----------|
| Frame detection via `X-Remix-Target` header | `guides/frame-navigation-patterns.md` |
| Named frames via `Frame name={...}` prop | `guides/frame-navigation-patterns.md` |
| Frame redirect following (`followFrameRedirects`) | `guides/frame-navigation-patterns.md` |
| `<!-- rmx:flush document/fragment -->` streaming markers | `guides/frame-navigation-patterns.md` |
| Non-blocking frames with `fallback` prop | `guides/frame-navigation-patterns.md` |

## Resources & Data

| Pattern | Reference |
|---------|-----------|
| `resources()` auto-generates CRUD routes | `guides/resources-routes.md` |
| `table()` lifecycle hooks (`beforeWrite`, `validate`, `afterRead`) | `data/guides/data-table-schema.md` |
| `RestfulForm` for PUT/DELETE in HTML forms | `lookup/restful-patterns.md` |

## SSE

| Pattern | Reference |
|---------|-----------|
| SSE with `handle.queueTask` + `addEventListeners` + `handle.signal` | `sse/guides/client-side-sse.md` |
| SSE inside Frame with form interception | `sse/guides/sse-in-frames.md` |

## Client-Side Data Fetching (Non-Frame)

| Pattern | Reference |
|---------|-----------|
| Manual `fetch()` + `DOMParser` + `innerHTML` swap | `guides/manual-fetch-patterns.md` |
| Opacity transition (fade 0.5 during load) | `guides/manual-fetch-patterns.md` |
| `document.addEventListener` + `closest()` for event delegation | `guides/manual-fetch-patterns.md` |
| `data-*` attributes for delegate routing | `guides/manual-fetch-patterns.md` |

## Server-Embedded Configuration

| Pattern | Reference |
|---------|-----------|
| `<script type="application/json">` for server-to-client data | `guides/server-embedded-json.md` |
| Options/dropdown values embedded in HTML | `guides/server-embedded-json.md` |
| Script tag travels with fragment during DOM swaps | `guides/server-embedded-json.md` |

## Inline Editing

| Pattern | Reference |
|---------|-----------|
| Double-click to edit cells | `guides/inline-editing-patterns.md` |
| Enter/blur to save, Escape to revert | `guides/inline-editing-patterns.md` |
| Text input for strings, `<select>` for enums | `guides/inline-editing-patterns.md` |
| Success green flash on cell save | `guides/inline-editing-patterns.md` |

## Combined Pagination + Filter + Sort

| Pattern | Reference |
|---------|-----------|
| Single query with WHERE + ORDER BY + LIMIT/OFFSET | `guides/filtering.md` |
| Filter resets pagination offset to 0 | `guides/pagination.md` |

## Styling

| Pattern | Use Case |
|---------|----------|
| `css()` mixin | Static styles, pseudo-selectors |
| `style` prop | Dynamic styles, frequent updates |
| `&:hover` nesting | Element's own states |
| Descendant nesting | Parent state affects children |

## Reference

`/home/lucky/remix/packages/component/docs/patterns.md`