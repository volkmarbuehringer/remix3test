<!-- Context: development/remix3/concepts | Priority: critical | Version: 1.0 | Updated: 2026-05-06 -->

# SSR-Client Boundary

**Core Idea**: Server renders identical HTML for all clients — it cannot know viewport size, scroll position, or any client-specific state. Client-side hydration bridges this gap, and Remix 3's `clientEntry` pattern is the designed mechanism for adding behavior to server-rendered UI.

## The Inherent SSR Limitation

- **Same HTML for every client**: Server has no browser context (viewport, scroll, localStorage, media query state)
- **CSS-only adaptation**: Media queries handle visual layout but cannot drive interaction state (menu open/closed, pagination page size)
- **Not a Remix bug**: This is fundamental to all SSR — it cannot be fully solved without client-side hydration

## How clientEntry Bridges the Gap

| Concern | SSR Role | clientEntry Role |
|---------|----------|------------------|
| **UI structure** | Renders complete HTML (buttons, forms, containers) | Finds elements by ID, adds behavior |
| **Interaction state** | No browser context | `addEventListener` + `closest()` delegation |
| **Styling** | CSS classes, media queries | Same CSS — no FOUC from late-applied styles |

The server provides the full visual layout. clientEntry **only adds behavior** — it never creates UI elements.

## What Must Stay as Inline Scripts

Some work cannot wait for clientEntry hydration:

| Scenario | Why It Must Be Inline | Example |
|----------|----------------------|---------|
| **CLS prevention** | Runs synchronously in `<head>` before first paint | Reading `localStorage` to set `data-theme` on `<html>` |
| **Flash prevention** | Affects initial render before JS loads | Dark mode toggle guard |
| **Pre-paint setup** | Must execute before any rendering occurs | Critical CSS path optimizations |

These remain as inline `<script>` blocks in server-rendered HTML — they are not candidates for clientEntry.

## Related

- `ui/guides/client-entry-side-effects.md` — Side-effect-only clientEntry implementation
- `ui/guides/client-interactivity-patterns.md` — Three approaches: inline scripts, clientEntry, HTML attributes
- `ui/guides/hydration.md` — Hydration mechanics
- `errors/client-entry-issues.md` — Common clientEntry problems
