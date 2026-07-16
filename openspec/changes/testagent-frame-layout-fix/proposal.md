## Why

The test-agent page unconditionally wraps its content in `<Layout>` (which includes `MainNav`). When navigated from the admin sidebar (frame navigation), this creates a duplicate navbar and no visible page content. The mastra chat page already solved this pattern — the test-agent should follow suit.

## What Changes

- Test-agent controller detects frame requests and renders via `renderAdminPage()` instead of `<Layout>`
- Direct (non-frame) access renders `Layout > AdminLayout > TestAgentPage`, consistent with mastra chat
- Test-Agent removed from the main top navbar (it's an admin-only tool accessed via sidebar)

## Capabilities

### New Capabilities

None — existing functionality, layout fix only.

### Modified Capabilities

None — no spec-level behavior changes.

## Impact

- `app/actions/test-agent/controller.tsx` — frame detection + dual rendering path
- `app/ui/nav.ts` — remove testagent from NAV_SECTIONS and MOBILE_ITEMS
- No new dependencies
