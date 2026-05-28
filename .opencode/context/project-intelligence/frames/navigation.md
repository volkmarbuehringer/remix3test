---
title: Frames Context
description: Project intelligence for Remix 3 Frame usage, patterns, and pitfalls.
---

# Frames Context

Reference for Remix 3 Frame behavior, client entries, pagination patterns, programmatic reload, client-mounted frames, nested dashboard frames, and root-reload lifecycle patterns discovered in the newapp project.

## Structure

```
frames/
├── navigation.md                         # This file
├── concepts/
│   ├── frame-boundary-hydration.md       # Why nested hydration skips inside Frames
│   └── nested-frames.md                  # Nested Frames architecture (was flat)
├── guides/
│   ├── client-entry-in-paginated-lists.md # Correct pattern for interactive list items
│   ├── nested-frames.md                  # How-to: nested frames implementation (was flat)
│   ├── programmatic-frame-reload.md      # handle.frame.reload(), handle.frames.top.reload()
│   ├── client-mounted-frames.md          # Dynamic mount/unmount of frames from client entries
│   ├── nested-frames-admin-dashboard.md  # Admin dashboard nested frames architecture
│   └── root-reload-lifecycle.md          # Persistent/removable entries, abort, queueTask
├── examples/
│   ├── cart-button-list-pattern.md       # Working CartButton in paginated grid
│   └── books1-pagination.md              # Frame-based pagination (was flat)
├── errors/
│   ├── stale-props-after-pagination.md   # Wrong values after pagination
│   ├── client-entry-state-reset.md       # Local state reset by props
│   ├── missing-unique-frame-names.md     # State leak without unique names
│   ├── missing-doctype-in-render.md      # Quirks mode without doctype
│   ├── render-fragment-calls-render.md   # Fragment includes full HTML wrapper
│   ├── resolve-frame-not-stripping-html.md # Duplicate HTML from unresolved wrappers
│   ├── resolve-frame-returning-html-error.md # rmx-data JSON corrupted by HTML
│   ├── missing-x-remix-frame-header.md   # Frame request not recognized
│   ├── resolve-frame-not-using-context.md # Nested frames resolve incorrectly
│   ├── missing-resolve-client-entry.md   # Client entries don't hydrate
│   ├── invalid-url-framesrc-empty.md     # TypeError in fragments
│   └── security-file-uri-s.md           # Module blocked from file:// origin
├── lookup/
│   └── frame-vs-client-entry.md          # When to use Frame vs direct render
```

## Quick Routes

| Need | File |
|------|------|
| Nested frames architecture | `concepts/nested-frames.md` |
| How to implement nested frames | `guides/nested-frames.md` |
| Why cart buttons go stale | `concepts/frame-boundary-hydration.md` |
| How to fix pagination + interactivity | `guides/client-entry-in-paginated-lists.md` |
| Frame-based pagination example | `examples/books1-pagination.md` |
| Working code example | `examples/cart-button-list-pattern.md` |
| Programmatic frame reload | `guides/programmatic-frame-reload.md` |
| Client-mounted frames | `guides/client-mounted-frames.md` |
| Admin dashboard nested frames | `guides/nested-frames-admin-dashboard.md` |
| Root reload entry lifecycle | `guides/root-reload-lifecycle.md` |
| Quick decision table | `lookup/frame-vs-client-entry.md` |

## Key Insights

1. **Client entries inside `<Frame>` do NOT re-hydrate on parent frame reload** — `rmx:f:` boundary markers cause the diff algorithm to skip nested `rmx:h:` markers.
2. **For interactive elements that need prop updates on pagination, render `clientEntry` directly** instead of wrapping in `<Frame>`.
3. **When a client entry manages local state AND receives props**, track the last prop value to distinguish between "parent sent new props" (sync) vs "self-triggered re-render" (preserve local state).
4. **`<Frame>` is appropriate for**: Server-rendered regions that load independently, NOT for individual interactive buttons inside a list.
5. **`handle.frame.reload()` refreshes only the frame's content** — parent page, layout, and sibling frames are untouched.
6. **Client-mounted `<Frame>` components** must be inside a `clientEntry` for client-side toggle state; always use a unique `name` prop in lists.
7. **Root reload lifecycle**: `handle.queueTask()` for post-hydration setup, `handle.signal.addEventListener('abort')` for cleanup, persistent entries keep local state across `handle.frames.top.reload()`.
