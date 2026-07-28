## Context

`app/router.ts` is the composition root where all controllers are imported and mapped to routes. Currently 33 import lines use 4 different export/import styles with no consistent pattern. This adds cognitive overhead when scanning the router — you can't tell at a glance whether a file exports one thing or many.

The Remix bookstore demo at `~/remix/demos/bookstore/` follows a uniform pattern: every controller is `export default createController(...)` and every import is `import XController from './...'`.

## Goals / Non-Goals

**Goals:**
- Reduce router.ts import lines from 33 to ~20
- Eliminate inconsistent named imports from single-export files
- Group related sub-controllers behind barrel files
- Match the bookstore demo's convention of `export default` for single-export controllers

**Non-Goals:**
- Refactor multi-export files (mastra, chat, workflow-agent) — those have legitimate secondary exports used by tests
- Change route registration logic or middleware — purely an import/export reorganization
- Rename variables or functions — only change how they're exported and imported

## Decisions

### Decision 1: `export default` for single-export controllers

**Choice**: 9 files change from `export const foo = createController/action(...)` to `export default createController/action(...)`.

**Rationale**: The bookstore demo uses this pattern exclusively. It's the simplest import form (`import foo from './...'` vs `import { foo } from './...'`). Files that export exactly one thing gain nothing from named exports.

**Alternatives considered**: Leave as-is. Pro: no churn. Con: inconsistent style persists, every named import requires checking whether the source has 1 export or many.

**Affected files**:

| Source file | Current export | New export | Router change |
|---|---|---|---|
| `app/actions/test-agent/controller.tsx` | `export const testAgent` | `export default` | `{ testAgent }` → `testAgent` |
| `app/actions/route-agent/controller.tsx` | `export const routeAgent` | `export default` | `{ routeAgent }` → `routeAgent` |
| `app/actions/agent-events/controller.tsx` | `export const agentEvents` | `export default` | `{ agentEvents }` → `agentEvents` |
| `app/actions/webhook/controller.tsx` | `export const webhookReceive` | `export default` | `{ webhookReceive }` → `webhookReceive` |
| `app/actions/api/login/controller.tsx` | `export const apiLogin` | `export default` | `{ apiLogin }` → `apiLogin` |
| `app/actions/api/logout/controller.tsx` | `export const apiLogout` | `export default` | `{ apiLogout }` → `apiLogout` |
| `app/actions/app-webhook/controller.tsx` | `export const appWebhookReceive` | `export default` | `{ appWebhookReceive }` → `appWebhookReceive` |
| `app/actions/webhook-requests/create/controller.tsx` | `export const webhookRequestsCreate` | `export default` | `{ webhookRequestsCreate }` → `webhookRequestsCreate` |
| `app/actions/callback/controller.tsx` | `export const callbackReceive` | `export default` | `{ callbackReceive }` → `callbackReceive` |

### Decision 2: Verwaltung barrel file

**Choice**: Create `app/actions/verwaltung/index.ts` that re-exports all 8 sub-controllers.

```
export { default as controller } from './controller.tsx'
export { default as offerings } from './offerings/controller.tsx'
export { default as appointments } from './appointments/controller.tsx'
export { default as resources } from './resources/controller.tsx'
export { default as offeringConfigs } from './offering-configs/controller.tsx'
export { default as report1 } from './report1/controller.tsx'
export { default as pdf } from './pdf/controller.tsx'
export { default as usersPdf } from './users-pdf/controller.tsx'
export { default as usersExport } from './users-export/controller.tsx'
```

**Router change**:
```
import verwaltungController from './actions/verwaltung/controller.tsx'
import verwaltungOfferings from './actions/verwaltung/offerings/controller.tsx'
... (8 more)
→
import * as verwaltung from './actions/verwaltung/index.ts'
```

Each `router.map(routes.verwaltung.X, verwaltungX)` becomes `router.map(routes.verwaltung.X, verwaltung.X)`.

**Rationale**: 9 lines → 1 line. All verwaltung routes are grouped under one namespace, making it clear they're related. Each sub-controller still has its own file — the barrel just collects them.

### Decision 3: Admin namespace import

**Choice**: Import the admin barrel as `import * as admin` instead of destructuring 7 names.

**Router change**:
```
import { adminController, adminChatlog, adminChatlogFragments,
         adminMessages, adminFragments, adminLists, adminUsers }
→
import * as admin from './actions/admin/controller.tsx'
```

Each usage: `adminController` → `admin.adminController`, `adminChatlog` → `admin.adminChatlog`, etc.

**Rationale**: Eliminates the long destructure line. The barrel already exists — this just changes how it's consumed. No new file.

### Decision 4: API barrel (optional, lower priority)

**Choice**: Create `app/actions/api/index.ts` that re-exports the 3 API controllers.

```
export { default as apiListsController } from './lists/controller.tsx'
export { default as login } from './login/controller.tsx'
export { default as logout } from './logout/controller.tsx'
```

**Router change**: 3 import lines → 1. Only worthwhile if the barrel is needed — the 3 current imports are already short.

**Status**: Deferred — decide during implementation based on whether the 33→20 count is already satisfactory without it.

## Risks / Trade-offs

- **Renamed `router.map()` references**: The verwaltung namespace import changes how controllers are referenced in `router.map()` calls. Each one must be updated. This is mechanical but requires careful review.
- **Test imports unaffected**: Multi-export files (mastra, chat, workflow-agent) are left alone, so `chatRateLimiter`, `__setTestAgent`, `_agentThreadId`, and `_recordWorkflowResult` import paths don't change.
- **TypeScript `typecheck` gate**: The `as default` change may break the admin barrel's re-exports if any sub-controller uses `export default` differently than expected. Verify with `tsc --noEmit` after each file change to isolate issues.
- **Step order**: Convert single-export files first (testable in isolation), then the barrel, then the admin namespace. Each step is independently revertible.
