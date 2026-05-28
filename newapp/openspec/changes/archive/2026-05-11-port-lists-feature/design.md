## Context

The starter app has theme tokens, namespace mixins, page primitives, and a nav registry — but no real interactive feature that proves they work together. The `my_app` lists feature provides a 475-line clientEntry component (ListsClient) that manages an in-memory list with add, edit, delete, reorder, shuffle, and reverse operations — all purely client-side, no server persistence needed. Porting it to newapp exercises every new pattern: the component uses `css()` tagged templates with `theme.*` tokens, the page uses `PageSection` + `pageStackCss`, the nav uses the registry, and the interactive pattern proves `clientEntry` works correctly with the newapp's asset server configuration.

## Goals / Non-Goals

**Goals:**
- Port the ListsClient component adapted to the newapp's mixin style (no `Button` from `remix/ui/button` — use `button.base` + `button.primary` from our mixins instead)
- Create a route and controller that renders the ListsClient page at `/lists`
- Add "Lists" to the nav registry so it appears in the header nav
- Replace the original server-save pattern with localStorage persistence
- Add a detail page (`/lists/:id`) using page primitives that shows saved list contents
- Keep all existing functionality: add, edit, delete, reorder (up/down), reverse, shuffle, auto-shuffle

**Non-Goals:**
- No database, auth, or session middleware
- No server-side persistence (localStorage only)
- No admin panel
- No changes to the render middleware or asset pipeline

## Decisions

### 1. localStorage instead of server persistence

**Decision**: Replace the `POST /lists/save` server round-trip with `localStorage.setItem('lists', JSON.stringify(items))`.

**Rationale**: The starter app has no database. Adding a database just for this feature would require data-table-sqlite, middleware, setup scripts, and migration logic — 4x the scope for what is fundamentally a client-side demo. localStorage gives the same "items persist across page reloads" UX without the infrastructure cost.

**Alternative considered**: In-memory only (no persistence). Rejected because the feature would lose state on every navigation, making it feel broken.

### 2. Mixin-based buttons instead of remix/ui/button

**Decision**: Replace all `<Button tone="primary">` usages with `<button type="button" mix={[button.base, button.primary]}>`.

**Rationale**: The starter uses `remix/ui/theme` for design tokens but doesn't install `@remix-run/ui` (which provides `Button`, `Glyph`, etc.). The mixin namespaces already provide `button.base`, `button.primary`, `button.ghost`, `button.danger` — exactly the same visual contract as `Button`. Using mixins keeps the starter dependency-free and validates that the mixin pattern works for real interactive components.

### 3. Detail page uses page primitives

**Decision**: The `/lists/:id` page renders saved list items using `<PageSection>` + `pageStackCss` from page-primitives.

**Rationale**: Proves that page primitives work for real content pages, not just showcase pages. The detail page is ~20 lines of content using imported primitives.

### 4. No auto-shuffle

**Decision**: Drop the auto-shuffle interval feature from the ported component.

**Rationale**: The auto-shuffle uses `setInterval` with `handle.update()` inside a `clientEntry`. This introduces edge cases with cleanup (abort signal handling) that add complexity without proving any new scaffolding pattern. The manual shuffle button is sufficient to demonstrate the pattern.

**Alternative considered**: Keep auto-shuffle with `handle.signal` cleanup. Rejected — it's a niche feature that increases porting risk.

## Risks / Trade-offs

- **[Risk] ListsClient is 475 lines of clientEntry component** — large files are harder to review and maintain. → Mitigation: The component is well-structured with clear operation functions and CSS separated at the bottom. The size reflects the feature scope (6 CRUD operations), not poor organization.
- **[Risk] localStorage persistence has no conflict resolution** — if the user opens two tabs, saves in both, one save overwrites the other. → Mitigation: This is a demo feature, not production data. For a demo, last-write-wins is acceptable.
- **[Trade-off] No server save means sharing lists between sessions isn't possible** — Acceptable for a demo feature. A real app would add a database later.
