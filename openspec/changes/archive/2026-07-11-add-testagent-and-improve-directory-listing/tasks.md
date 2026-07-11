## 1. Auth-gate and enable test agent route

- [x] 1.1 Remove `NODE_ENV !== 'production'` gate in `app/router.ts` — wire `testAgent` route unconditionally
- [x] 1.2 Wrap `testAgent` route with `requireAuth()` middleware in the router composition
- [x] 1.3 Verify all sub-routes (`/testagent`, `/testagent/stream/:runId`, `/testagent/approve`, `/testagent/decline`) inherit auth
- [x] 1.4 Verify CSRF skip in `app/middleware/skip-csrf.ts` still applies to `/testagent` paths

## 2. Add Test-Agent to admin sidebar

- [x] 2.1 Add `testagent` to `AdminNavItem` type in `app/ui/admin-layout.tsx`
- [x] 2.2 Add nav item entry under "Daten" group with `label: 'Test-Agent'` and `route: routes.testAgent.index`
- [x] 2.3 Add SVG icon function for the test agent nav item

## 3. Enrich directory listing output with display formatting

- [x] 3.1 Add `humanFileSize(bytes)` utility in `app/actions/mastra/tools/test-tools.ts` that converts bytes to binary units (KiB/MiB/GiB)
- [x] 3.2 Add `display` field (`formattedSize`, `type`, `icon`) to each file entry in the `listTestFiles` tool response
- [x] 3.3 Verify the agent renders the new display fields in its text output

## 4. Verify and fix type/lint issues

- [x] 4.1 Run `npm run typecheck` and fix any type errors
- [x] 4.2 Run `npm run lint` and fix any lint errors
- [x] 4.3 Run existing tests to ensure no regressions
