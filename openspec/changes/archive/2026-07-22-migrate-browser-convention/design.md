## Context

The app has 32 `clientEntry` components in `app/assets/`. Each is imported by 1-3 action controllers or page modules in `app/actions/`. The asset server config (`app/assets.ts`) uses broad `allowFiles` patterns (`app/ui/**`, `app/utils/**`) that accidentally expose non-entry code to the client bundle.

The Remix 3 ecosystem already uses a suffix convention in two places:
- **Test runner**: `*.test.browser.{ts,tsx}` for browser tests
- **Asset server**: `denyFiles: ['**/*.server.*']` to exclude server-only files from the client bundle

Adopting `*.browser.tsx` for clientEntry source files extends this same pattern to source code, making the server/client boundary file-based rather than directory-based.

## Goals / Non-Goals

**Goals:**
- Co-locate clientEntry components next to the server code they enhance
- Make `allowFiles` precise: only files matching `*.browser.*` patterns get compiled for the client
- Keep `entry.tsx` (client boot script) accessible
- Zero behavioral changes — all tests pass, all features work identically

**Non-Goals:**
- Not changing the `clientEntry()` API itself
- Not changing the render middleware
- Not splitting existing files — just renaming and moving

## Decisions

### Decision 1: `*.browser.tsx` suffix, not `*.client.tsx`

Use `*.browser.tsx` to match the existing `*.test.browser.tsx` test convention and the `denyFiles: ['**/*.server.*']` parallel. Keeping one naming family (`.server.` / `.browser.`) is simpler than introducing a third suffix (`.client.`).

### Decision 2: Co-locate by feature, not by layer

Each clientEntry component moves into the directory of the server code that renders it:

| Current | Target |
|---|---|
| `app/assets/nav-toggle.tsx` | `app/ui/layout/nav-toggle.browser.tsx` |
| `app/assets/theme-toggle.tsx` | `app/ui/theme-toggle.browser.tsx` |
| `app/assets/confirm-delete.tsx` | `app/ui/confirm-delete.browser.tsx` |
| `app/assets/admin-users-context-menu.tsx` | `app/ui/admin/admin-users-page.browser.tsx` |
| `app/assets/admin-appointments-context-menu.tsx` | `app/ui/admin/admin-appointments-page.browser.tsx` |
| `app/assets/connection-indicator.tsx` | `app/ui/connection-indicator.browser.tsx` (stays in ui/) |
| `app/assets/grid-refresh-button.tsx` | `app/ui/grid-refresh-button.browser.tsx` |

Streaming/sse components (customer-chat-stream, workflow-agent-stream, etc.) co-locate to `app/assets/streams/` since they're shared across multiple pages.

Context menu components merge into the page file they belong to (admin-users-context-menu → admin-users-page.browser.tsx).

### Decision 3: `allowFiles` keeps `app/ui/**` + `app/utils/**` for dependency resolution

Browser components import shared UI modules (theme, glyphs, buttons, toasts, appointment-interaction-state, schedule-layout) and data types. These files don't have a `.browser.` suffix because they're dependency modules, not entry points. The `allowFiles` must include the directories where these shared modules live.

```typescript
allowFiles: [
  'app/**/*.browser.*',   // all browser entry components
  'app/assets/entry.tsx', // client boot script
  'app/routes.ts',        // route definitions
  'app/ui/**',            // shared UI modules (theme, toasts, etc.)
  'app/utils/**',         // utility modules
],
```

Server-only protection comes from `denyFiles: ['app/**/*.server.*']` — any file with `.server.` suffix is explicitly excluded from client delivery even if it lives in an allowed directory.

### Decision 4: Keep `app/assets/` as `entry.tsx` home only

After migration, `app/assets/` contains just `entry.tsx`. The directory stays for the boot script; clientEntry components move elsewhere.

## Risks / Trade-offs

- **Import churn**: Every action controller that imports from `app/assets/` needs path updates. Mitigation: do this in one focused pass with parallel grep/sed.
- **Working tree disruption**: In-progress branches will conflict. Mitigation: schedule this as a short, isolated change; merge/rebase others first.
- **`allowFiles` too tight**: If a future dev adds a `clientEntry` without the `.browser.` suffix, it silently won't hydrate. Mitigation: the render middleware's `resolveClientEntry` already throws on missing entries, so this is caught at dev time.
- **Consistency cost**: Not all clientEntry components have a single "owner" directory — shared components (connection-indicator, confirm-delete) end up in a generic location. Mitigation: `app/ui/` still works for true shared components.
