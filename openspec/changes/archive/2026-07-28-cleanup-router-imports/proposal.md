## Why

`app/router.ts` has 33 controller import lines using 4 different export/import styles (default, named single-export, multi-named, barrel destructure). This makes the composition root harder to scan and forces readers to check each source file to understand the export pattern. The bookstore demo shows a cleaner approach: uniform `export default` for all single-export controllers.

## What Changes

- Convert 9 single-export controllers from `export const` to `export default`
- Update `app/router.ts` to import them as defaults (shorter, uniform syntax)
- Create `app/actions/verwaltung/index.ts` barrel to consolidate 8 verwaltung imports into 1
- Switch admin barrel import to `import * as admin` namespace to eliminate 7-name destructure
- Optionally: create `app/actions/api/index.ts` barrel for the 3 API controllers

Total: 33 import lines → ~20. No behavioral changes.

## Capabilities

### New Capabilities
- `router-composition-cleanup`: Standardized controller export and import patterns in the router composition root

### Modified Capabilities
*(none — no spec-level behavior changes)*

## Impact

- `app/actions/test-agent/controller.tsx` — rename export
- `app/actions/route-agent/controller.tsx` — rename export
- `app/actions/agent-events/controller.tsx` — rename export
- `app/actions/webhook/controller.tsx` — rename export
- `app/actions/api/login/controller.tsx` — rename export
- `app/actions/api/logout/controller.tsx` — rename export
- `app/actions/app-webhook/controller.tsx` — rename export
- `app/actions/webhook-requests/create/controller.tsx` — rename export
- `app/actions/callback/controller.tsx` — rename export
- `app/router.ts` — update 9 imports to default style, add verwaltung barrel, use admin namespace
- `app/actions/verwaltung/index.ts` — new barrel file
- No test changes needed (test files import `_agentThreadId`, `_recordWorkflowResult`, `chatRateLimiter` etc. by name from multi-export files — those aren't touched)
