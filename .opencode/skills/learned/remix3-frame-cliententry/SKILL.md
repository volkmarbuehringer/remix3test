---
name: remix3-frame-cliententry
description: 'Use when working on Remix 3 `<Frame>` navigation or `clientEntry` hydration — forms, frame targets, `data-rmx-*` escapes, cascade/mounted-guard traps, DOM/styling, frame-render tests.'
user-invocable: false
origin: consolidated
---

# Remix 3 Frame Navigation & clientEntry Patterns

Remix 3's `<Frame>` component and `clientEntry` hydration model form a tightly coupled lifecycle. Frames intercept GET navigations via the browser Navigation API, replacing DOM content server-side without full-page reloads; `clientEntry` components hydrate inside those frames. The interaction produces hard-to-debug failure modes: `handle.update()` cascades fire on large frames, `mounted` guards silently break after Frame DOM replacement, and binary responses crash the frame router.

This skill is the **index** for the version-pinned deltas. For the framework API itself, use the vendor reference `remix/references/hydration-frames-navigation.md`; for component-local state and mixins, `remix/references/component-model.md` and `remix/references/mixins-styling-events.md`.

## Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Form interception in frames (post-#11668), `resolveFrame`, frame direct render, `data-rmx-document`/`data-rmx-history`, nested-frame PRG redirects | `references/frame-navigation.md` |
| `clientEntry` cascade limits, `mounted` guards after reload, reload-driven data loading, global document listeners, SSR-safety/authoring constraints | `references/cliententry-lifecycle.md` |
| Styling clientEntry children, joined button groups, inline-edit table cells, `on` mixin hydration, drag-and-drop, fragment scrolling | `references/cliententry-dom-and-styling.md` |
| Frame target registration/content-only panels, nested-frame registration inside a fragment-hydrated frame, `<input>` `defaultValue` preservation, asserting on frame-rendered HTML in tests | `references/frame-layout-and-testing.md` |

- `references/frame-navigation.md` — the frame navigation/forms contract and escape hatches.
- `references/cliententry-lifecycle.md` — the entry's mount/hydration/re-render lifecycle traps.
- `references/cliententry-dom-and-styling.md` — DOM mutation and CSS patterns inside entries.
- `references/frame-layout-and-testing.md` — layout wiring and verification.

## Core Invariants

- `app/assets/entry.tsx` (`run({ resolveFrame })`) is the always-loaded client runtime, not per-page user code. Removing it does not make a page "more SSR" — it removes enhancement and falls back to full-document navigation.
- Make the server route correct before layering `clientEntry`/frame interactivity on top.
- `handle.update()` only from an event handler or `handle.queueTask()` — never from setup, render, or a `dragover`/resize/scroll handler.
- The factory closure of a `clientEntry` persists across frame DOM replacement; only the render function re-runs. State a "did I mount?" fact in the closure only if the render function cannot observe the new DOM.
- For cross-boundary transitions the frame runtime must not intercept (binary downloads, cross-section links, login), use `data-rmx-document` — do not disable the runtime.

> Version-pinned facts here reference the pinned `remix` preview build (see `package.json`). Re-check against the installed vendor source before relying on them.
