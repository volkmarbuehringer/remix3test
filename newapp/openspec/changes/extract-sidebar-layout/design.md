## Context

The `AdminLayout` and `AiLayout` components in `app/ui/admin-layout.tsx` and `app/ui/ai-layout.tsx` share ~85% of their structure and styling. Both render:

- A 2-column grid shell (`220px | 1fr`)
- A sticky sidebar card with border, shadow, and surface background
- A header row (icon + uppercase label)
- A `<nav>` with grouped navigation links using identical hover/active styles
- A content area with breadcrumbs
- A "ShellOrFragment" pattern that detects frame requests vs. full-page loads

These layouts are used by 8 controllers across admin and AI sections. The duplication means style changes, structural updates, or bug fixes must be applied twice, and the files have drifted in minor ways (admin has `iframeNav` support, a second divider, and extra sidebar components that AI lacks).

## Goals / Non-Goals

**Goals:**

- Extract all shared structure, styles, and the ShellOrFragment pattern into a single `app/ui/sidebar-layout.tsx` module
- The shared module uses a `createSidebarLayout()` factory that accepts section-specific data (nav items, icons, extra components) and returns `{ renderPage, Layout }`
- `admin-layout.tsx` and `ai-layout.tsx` become thin wrappers that call the factory with their specific data
- All existing exports (`renderAdminPage`, `renderAiPage`, `AdminLayout`, `AiLayout`, nav item types) keep their exact signatures so no controller changes are needed
- Total lines of code across the two layout files decreases significantly (currently ~515 combined lines)

**Non-Goals:**

- No behavior changes to any page rendering
- No controller file modifications
- No CSS value changes (all styles remain visually identical)
- No renaming of exports or types consumed by other modules
- Not extracting the nav icon SVGs into a shared registry (each section keeps its own icon definitions)

## Decisions

### Decision 1: Factory pattern (`createSidebarLayout`) over inheritance or mixins

**Chosen:** A factory function that accepts config and returns `{ renderPage, Layout, isFrameRequest }`.

**Alternatives considered:**

- **Base class / inheritance** — Remix 3 uses functional patterns, not classes. A factory fits the existing codebase style better.
- **Mixin / HOC** — Would add unnecessary indirection. The layouts are data-driven (they differ only in their nav data, icons, and extras), so parameterization is the right tool.
- **Single component with props** — Could pass everything as JSX props, but the ShellOrFragment pattern requires access to context (for frame detection), which makes a factory cleaner than threading it through every render.

**Rationale:** The factory produces typed, self-contained output. Each section calls `createSidebarLayout(...)` once at module scope and gets its `renderPage` and `Layout` exports. This matches the current module structure exactly.

### Decision 2: Shared styles live in the factory module

**Chosen:** All shared CSS (`shellStyle`, `sidebarStyle`, `navLinkStyle`, etc.) is defined once inside `sidebar-layout.tsx` and used by the factory's returned `Layout` component.

**Alternatives considered:**

- **CSS mixins file** — Could extract styles into a `mixins/sidebar.ts` file. Overkill for styles that are used in exactly one place (the sidebar layout component).
- **Inline in each layout** — The current approach, which is what we're fixing.

**Rationale:** The styles are an implementation detail of the sidebar layout. They should live with the component. If a future section needs different sidebar styles, the factory can accept style overrides.

### Decision 3: Generic `NavItem<ID>` type instead of concrete union types

**Chosen:** The shared module defines `NavItem<ID extends string>` and `NavGroup<ID>`. Each section passes its own nav data typed with its specific ID union (`AdminNavItem` / `AiNavItem`).

**Alternative considered:** Use a concrete `string` type for IDs everywhere — simpler but loses the type safety of `AdminNavItem` and `AiNavItem` in controllers.

**Rationale:** The existing controllers use typed nav item IDs (`'dashboard' | 'chatlog' | ...`). Keeping generics preserves this type safety without the shared module needing to know about specific section IDs.

### Decision 4: Sidebar extras passed as `RemixNode` slot

**Chosen:** The factory config includes an optional `sidebarExtras: RemixNode` slot for section-specific components below the nav (admin's `AdminViewToggle` + `PersistentAdminCounter`).

**Alternative considered:** Allow the factory to accept extra render functions. Over-engineered for what's essentially a children slot.

**Rationale:** A simple node slot does the job. The admin section passes its two components as a fragment, AI passes nothing.

## Risks / Trade-offs

- **Generic type complexity** — Using `NavItem<ID extends string>` adds a type parameter. If misused, this could produce confusing type errors. Mitigation: the generic is constrained to `string` and the section-specific modules wrap the factory call, keeping the type parameter internal.

- **Over-abstraction risk** — If a future section needs a fundamentally different layout (e.g., a top nav instead of sidebar), the shared component adds no value. Mitigation: the factory is small (~80-100 lines). It's easy to fork if a section truly differs.

- **Regression in admin/AI rendering** — The ShellOrFragment pattern is subtle: it must detect frame requests, render differently for fragments vs. full pages, and pass breadcrumbs correctly. Mitigation: existing tests cover controller rendering. The extracted module will have its own unit tests for the ShellOrFragment logic.

- **Style specificity conflicts** — If a section overrides a shared style, the override might not apply correctly. Mitigation: currently neither section overrides shared styles (they duplicate them). The factory doesn't expose style overrides — if needed in the future, it can accept partial overrides.
