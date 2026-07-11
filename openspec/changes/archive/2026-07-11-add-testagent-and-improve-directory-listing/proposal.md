## Why

The `/testagent` route currently exists as a dev-only prototype with no auth and no sidebar entry, making it inaccessible in production and hard to discover in development. Meanwhile, the directory listing tool (`listTestFiles`) returns data in plain text with no visual hierarchy, making it hard to distinguish files from directories or gauge file sizes at a glance.

## What Changes

- Promote `/testagent` from dev-only to auth-gated route (available in all environments, protected by `requireAuth`)
- Add `Test-Agent` nav item to the admin sidebar
- Improve the `listTestFiles` tool output formatting: directories in bold/color, file sizes in human-readable units, visual hierarchy with indentation

## Capabilities

### New Capabilities

- `auth-gated-testagent-route`: The `/testagent` route, gated by authentication instead of NODE_ENV check, with admin sidebar navigation entry

### Modified Capabilities

- `file-directory-enumeration`: Enhance the `listTestFiles` tool output to include human-readable size formatting, directory highlighting via ANSI-style text annotations, and improved visual structure for agent-generated responses

## Impact

- `app/router.ts` — Remove dev-only gate, wrap test agent route with `requireAuth` middleware
- `app/ui/admin-layout.tsx` — Add "Test-Agent" nav item and icon
- `app/actions/mastra/tools/test-tools.ts` — Add formatting improvements to returned data (human-readable sizes, directory indicators)
- `app/ui/test-agent-page.tsx` — Optional UI hint for rendered listing output
