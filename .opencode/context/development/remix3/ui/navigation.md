# Remix UI

**Purpose**: Build UI for Remix 3 apps - pages, layouts, components, interactions, styling, animations.

**Entry Point**: Load reference files based on task type.

---

## Quick Reference

| Task Type | Load |
|-----------|------|
| Component model (two-phase, handle) | `concepts/component-model.md` |
| Handle API (update, queueTask, signals, frames) | `concepts/handle-api.md` |
| Frames (blocking/non-blocking, reload, nesting) | `concepts/frames.md` |
| Hydration (clientEntry, run, serialization) | `concepts/hydration.md` |
| Events (on() mixin, signals, global listeners) | `concepts/events.md` |
| Styling (css() mixin, cascade layers, pseudo-selectors) | `concepts/styling.md` |
| Context API (ancestor/descendant, TypedEventTarget) | `concepts/context.md` |
| Composition (props, children, ref, keys) | `concepts/composition.md` |
| Getting started (client root, SSR, client entry) | `guides/getting-started.md` |
| Patterns (state mgmt, focus/scroll, data loading) | `guides/patterns.md` |
| Event mixins (createMixin, custom events) | `guides/event-mixins.md` |
| Spring animation (physics-based) | `examples/spring.md` |
| Tween animation (generator-based) | `examples/tween.md` |
| **Frame vs clientEntry decision matrix** | **`concepts/frame-vs-client-entry.md`** |
| **NavLink component (Handle pattern)** | **`guides/nav-link.md`** |
| **Client entry error handling (ErrorCard, 401 detection)** | **`guides/client-entry-error-handling.md`** |
| Frame cascade limit (50 max) | `guides/frame-scaling.md` |
| Theme contract + CSS vars | `concepts/theme-contract.md` |
| Enter/exit/layout animations | `guides/animation.md` |
| Authoring reusable mixins | `guides/mixins.md` |
| **Remix UI skill overview** | **`guides/remix-ui-skill.md`** |
| **Inline edit panel (SSR via query params)** | **`guides/inline-edit-pattern.md`** |
| **Delete button with confirm (clientEntry)** | **`guides/delete-button-with-confirm.md`** |
| Cart button local state (clientEntry) | `guides/cart-button-local-state.md` |
| Component patterns (deriving state, one-time init, TypedEventTarget) | `guides/component-patterns.md` |
| **Context menu patterns (hidden trigger vs direct trigger)** | **`guides/context-menu-patterns.md`** |
| Server rendering (renderToStream, resolveFrame) | `guides/server-rendering.md` |
| First-party components (Button, Menu, Popover, Select, etc.) | `concepts/first-party-components.md` |
| **Context menu API** | **`concepts/context-menu.md`** |
| Host elements, events, styling | `lookup/host-elements.md` |
| Navigation, links, head | `lookup/navigation.md` |
| Breaking changes & API migration | `lookup/migration-reference.md` |
| Component testing | `../../test/guides/testing-patterns.md` |
| **Frame-paginated grid example** | **`examples/frame-paginated-grid.md`** |
| **Dynamic grid filtering (offering-driven)** | **`guides/dynamic-grid-filtering.md`** |
| Cart button examples | `examples/cart-button-pattern.md`, `examples/client-entry-copy-button.md` |
| Counter & state patterns | `examples/counter-pattern.md`, `examples/state-patterns.md` |
| CSS & styling examples | `examples/css-mixin-examples.md`, `examples/css-styling.md`, `examples/styling.md` |
| Animation examples | `examples/spring.md`, `examples/tween.md`, `examples/animate-elements.md`, `examples/skeleton-loaders.md` |
| Toast system | `examples/toast-pattern.md`, `examples/toast-redirect-example.md` |
| Editable fields & theme | `examples/editable-fields.md`, `examples/theme-usage.md` |
| Event handling & component patterns | `examples/event-handling-examples.md`, `examples/component-patterns.md`, `examples/component-demos.md` |
| Zebra striping & testing | `examples/zebra-striping.md`, `examples/testing.md` |

## Errors & Gotchas

| Issue | File |
|-------|------|
| Component instance reuse on frame reload | `errors/component-instance-reuse.md` |
| Frame reload preserves form values | `errors/frame-reload-value-preservation.md` |
| context API SSR limitation | `errors/context-api-ssr-limitation.md` |
| Theme contract naming gotchas | `errors/theme-contract-naming-gotchas.md` |
| **Pagination offset reset with active filter** | **`errors/displayOffset-filter-pagination.md`** |
| Button VDOM testing pattern | `errors/button-vdom-testing.md` |
| Handle component VDOM testing limitation (NavLink) | `errors/handle-component-vdom-testing.md` |

---

## Key Principles

1. Two-phase components: setup runs once, render runs on every update
2. Prefer host-element mixins over legacy host props
3. Use `handle.update()` for rerenders, `queueTask()` for post-render work
4. Keep `<head>` explicit in document/layout code
