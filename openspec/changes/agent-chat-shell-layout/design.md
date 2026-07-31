## Context

See proposal.md — Why. The chat pages (`agent-events`, `workflow-agent`, `support-agent`, `route-agent`) are byte-identical in layout: a `pageStyle` div with `height: 100vh; overflow: hidden` wrapping a `Frame` panel, a status bar, and a single-line `rows={1}` textarea.

Two structural facts constrain the design:

1. `Frame` splices content inline (reconciler swaps DOM, no wrapper element), so the chat page is a **direct descendant** of the shared `pageStyle` scroll container in `app/ui/layout.tsx` (`flex: 1; overflow-y: auto`). There is no scoped container to size against.
2. The sidebar shell styles (`shellStyle`, `contentStyle` in `app/ui/sidebar-layout.tsx`) are **re-exported and reused** by `lists-layout.tsx` and `appointment-page.tsx` — a global height change on them affects non-chat pages.

The chain (single document after frame load): `body (min-height: 100vh)` → `shellCss` → `main (flex:1, overflow:hidden)` → `pageStyle (flex:1, overflow-y:auto, definite height)` → `shellStyle (grid)` → `contentStyle (flex column, align-self:stretch)` → chat `pageStyle (height: 100vh)`. Because `100vh` is the viewport while the visible box is `viewport − chrome`, the chat page is always ~10% taller than the scroll container → persistent scrollbar at load.

## Goals / Non-Goals

**Goals:**

- Chat page fills the available content area (no load-time scrollbar, input bar pinned to the bottom)
- Multi-line input with a visible default height ≥2 lines that auto-grows to a maximum and scrolls internally
- Consistent behavior across all four agent chat pages
- Preserve Enter-to-send / Shift+Enter-newline and all existing stream/frame behavior

**Non-Goals:**

- No changes to routing, agent logic, or SSE pipelines
- No changes to normal (non-chat) admin pages or the lists/appointment layouts
- No extraction of a shared `AgentChatShell` component (deferred to a future refactor; this change applies the same edits to all four pages)
- No change to the panel frames' content-only rendering

## Decisions

### Decision 1: Full-height layout mode, config-gated on the sidebar shell

**Chosen:** Add a `fullHeightTargets?: string[]` option to `createSidebarLayout(config)`. `LayoutComponent` matches the current request pathname against the list; when matched it renders the shell with `height: 100%` on `shellStyle`, `gridTemplateRows: 'minmax(0, 1fr)'` on the grid, and `height: 100%` on `contentStyle`. `admin-layout.tsx` registers the four chat index routes.

The percentage heights resolve against `pageStyle`'s definite flex height, so the shell is exactly the visible frame height regardless of MainNav/footer/breadcrumbs.

**Alternatives considered:**

- *Global shell change* (`height: 100%` unconditionally) — breaks the sticky sidebar on tall normal pages (the sticky containing block would shrink to one viewport height) and hits lists/appointment pages. Rejected.
- *`100dvh` on the chat page* — only corrects for mobile URL-bar chrome, not the stacked app/sidebar shells. Rejected.
- *`calc(100vh − Nrem)`* — magic numbers that drift with MainNav/footer height. Rejected.
- *Natural flow + `position: sticky; bottom: 0` input bar* — input bar not reliably pinned without a viewport-derived min-height on the frame. Rejected.

### Decision 2: Chat page fills via flex

**Chosen:** Change the chat `pageStyle` from `height: 100vh` to `flex: 1; min-height: 0`, keeping `overflow: hidden`. `contentStyle` is already `display: flex; flex-direction: column; min-height: 0`, so the page fills the space below the breadcrumbs and the `Frame` panel (itself `flex: 1; min-height: 0`) absorbs all height changes from the auto-growing input without layout jump.

**Exception — route-agent:** `route-agent` is served standalone (`<Layout><RouteAgentPage /></Layout>`, not via the sidebar shell; the previous change that would have moved it into the shell never landed). Its parent is the plain `Layout`'s `pageStyle`, a definite-height scroll container, so its page uses `height: 100%` (with `overflow: hidden`) instead of `flex: 1`. It is therefore NOT registered in `fullHeightTargets`. Behavior (no load-time scrollbar, input pinned) is the same.

### Decision 3: Larger auto-growing input

**Chosen:** Set `rows={2}` and `min-height: 3.6rem` (~1.5× current) on the textarea, add `overflow-y: auto`, and drive auto-grow in the stream client: on `input`, set `height: auto` then clamp to `min(scrollHeight, ~10rem)`; reset height to default on submit (next frame) alongside the existing value clear. Extract the logic into a shared `app/ui/auto-grow-textarea.ts` helper used by all four stream clients (`agent-events`, `workflow-agent`, `support-agent`, `route-agent`).

Enter/Shift+Enter handling already lives in the stream clients and is unchanged.

### Decision 4: Consistency across all four pages

**Chosen:** Apply the identical page + stream changes to `agent-events`, `workflow-agent`, `support-agent`, and `route-agent`. The three admin-shell pages register their index routes in `fullHeightTargets`; `route-agent` is handled standalone (Decision 2 exception). Rationale: the pages share the same chat-shell pattern; fixing one and leaving others diverges them further and reintroduces the same bug.

## Risks / Trade-offs

- [Percentage-height resolution inside the `overflow-y: auto` `pageStyle`] → Verify in the browser on all four pages; if `height: 100%` on `shellStyle` resolves incorrectly, fall back to `min-height: 0` + `align-self: stretch` on `contentStyle` (already present) and re-check.
- [Prior attempt (`agent-ui-navigation-scroll-layout`) was marked complete but the code never landed] → After implementation, verify via `npm run typecheck`, `npm run lint`, `npm test`, and a manual check that no scrollbar appears on load. Optionally add a lightweight regression assertion that the chat page container uses flex fill rather than a fixed `vh` height.
- [Auto-grow only grows, never shrinks if CSS min-height dominates] → Set `height: auto` before measuring each input event, and clamp with a CSS `max-height` alongside the JS clamp.
- [Duplicated page/stream edits across four files] → Accepted for this change (Non-Goals); the shared auto-grow helper keeps the only logic in one place.

## Migration Plan

CSS/JS-only, no data or schema changes. Ship as a single commit; rollback is a revert of the page/shell/stream files. The `fullHeightTargets` list is additive — non-listed pages are unaffected.

## Open Questions

- Exact maximum input height (recommended default ~10rem). Tune after visual check; changing the value does not affect the spec, approach, or tasks.
