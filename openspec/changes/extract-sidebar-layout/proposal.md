## Why

The Admin and AI section layouts (`admin-layout.tsx` and `ai-layout.tsx`) are ~85% identical — same grid shell, same sticky sidebar card, same nav link styles, same header/divider pattern, and the same ShellOrFragment frame-detection logic. Every CSS variable, nav style, and structural pattern is duplicated across both files. This means any style tweak or structural change requires editing both files, and the duplication makes the codebase harder to navigate. Extracting the shared pattern into a reusable `SidebarLayout` component eliminates the duplication while keeping each section's data (nav items, extra components) separate.

## What Changes

- **Extract shared sidebar layout** — Create `app/ui/sidebar-layout.tsx` containing:
  - The grid shell (`display: grid; grid-template-columns: 220px minmax(0, 1fr)`)
  - The sticky sidebar card with header, divider, nav, and content area
  - The shared CSS styles (nav link styles, active state, header, divider, group label)
  - A `createSidebarLayout()` factory that returns `{ renderPage, Layout, isFrameRequest }` for a given frame target
- **Refactor `admin-layout.tsx`** — Replace duplicated shell/sidebar/nav/styling with the shared component. Keep admin-specific nav data, icon definitions, AdminViewToggle, and PersistentAdminCounter.
- **Refactor `ai-layout.tsx`** — Replace duplicated shell/sidebar/nav/styling with the shared component. Keep AI-specific nav data and icon definitions.
- **No behavior changes** — All pages render identically before and after. All exports (`renderAdminPage`, `renderAiPage`, `AdminNavItem`, `AiNavItem`, `AdminLayout`, `AiLayout`) remain available with the same signatures.

## Capabilities

### New Capabilities

- `sidebar-layout`: Shared sidebar layout component used by section-based UIs (admin, AI). Provides the grid shell, sticky sidebar with navigation, and the ShellOrFragment pattern for frame-based vs. full-page rendering.

### Modified Capabilities

_(None — this is a pure refactoring with no requirement changes.)_

## Impact

**Files modified:**

- `app/ui/admin-layout.tsx` — Remove duplicated styles, delegate to `sidebar-layout`
- `app/ui/ai-layout.tsx` — Remove duplicated styles, delegate to `sidebar-layout`

**Files created:**

- `app/ui/sidebar-layout.tsx` — Shared layout abstraction

**Files affected (indirectly — imports remain stable):**

- `app/actions/admin-controller.tsx`
- `app/actions/admin-chatlog-controller.tsx`
- `app/actions/admin-lists-controller.tsx`
- `app/actions/admin-messages-controller.tsx`
- `app/actions/ai-controller.tsx`
- `app/actions/chat-controller.tsx`
- `app/actions/agent-controller.tsx`
- `app/actions/workflow-controller.tsx`

All imports, exports, and function signatures remain identical. No controller changes needed.
