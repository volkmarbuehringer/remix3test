## 1. Extract Shared Sidebar Layout

- [x] 1.1 Create `app/ui/sidebar-layout.tsx` with the `createSidebarLayout()` factory function, shared CSS styles (shell, sidebar card, nav link, active state, header, divider, group label, content area), and the generic `NavItem<ID>` / `NavGroup<ID>` types
- [x] 1.2 Implement the `ShellOrFragment` pattern in the factory: detect frame requests via `X-Remix-Target` header, render `<Frame>` wrapper for full-page requests or bare layout for frame requests
- [x] 1.3 Export `{ renderPage, Layout }` from the factory with correct Remix `Handle<Props>` typing

## 2. Refactor Admin Layout

- [x] 2.1 Rewrite `app/ui/admin-layout.tsx` to call `createSidebarLayout()` with admin-specific nav data, icons, header icon, and sidebar extras (`AdminViewToggle`, `PersistentAdminCounter`)
- [x] 2.2 Preserve all existing exports (`renderAdminPage`, `AdminNavItem`, `AdminLayout`) with identical signatures
- [x] 2.3 Remove the duplicated shell, sidebar card, nav link, header, divider, and group label CSS styles (now defined in `sidebar-layout.tsx`)

## 3. Refactor AI Layout

- [x] 3.1 Rewrite `app/ui/ai-layout.tsx` to call `createSidebarLayout()` with AI-specific nav data, icons, and header icon
- [x] 3.2 Preserve all existing exports (`renderAiPage`, `AiNavItem`, `AiLayout`) with identical signatures
- [x] 3.3 Remove the duplicated shell, sidebar card, nav link, header, divider, and group label CSS styles (now defined in `sidebar-layout.tsx`)

## 4. Test and Verify

- [x] 4.1 Write tests for `app/ui/sidebar-layout.tsx` covering: factory returns correct structure, ShellOrFragment pattern renders correct frame target, nav links render with correct attributes
- [x] 4.2 Run `npm run typecheck` to verify no type errors across modified files and all controllers
- [x] 4.3 Run `npm test` to verify all existing tests still pass
