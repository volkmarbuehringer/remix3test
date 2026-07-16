## Context

The test-agent controller at `app/actions/test-agent/controller.tsx` always renders `<Layout><TestAgentPage/></Layout>`. The mastra chat controller solved this same problem by checking the `X-Remix-Target` header: frame requests render through `renderAdminPage()` (no outer Layout/ MainNav), direct requests render `Layout > AdminLayout > content` (with sidebar).

## Goals / Non-Goals

**Goals:**

- Eliminate duplicate navbar when test-agent opens in admin frame
- Keep test-agent working when accessed directly (though it'll be removed from the navbar)
- Match mastra chat rendering pattern exactly

**Non-Goals:**

- No behavioral changes to the test-agent logic (streaming, approval, etc.)
- No changes to admin-layout or sidebar-layout

## Decisions

**Frame detection** — Use `context.request.headers.get('X-Remix-Target') === frames.adminContent`, exactly like mastra chat at `mastra/controller.tsx:76`.

**Dual rendering path:**

- Frame request → `renderAdminPage(context.render, 'testagent', <TestAgentPage />)`
- Direct request → `context.render(<Layout><AdminLayout activeItem="testagent"><TestAgentPage /></AdminLayout></Layout>)`

**Remove from navbar** — Delete the testagent entries from `NAV_SECTIONS` and `MOBILE_ITEMS` in `app/ui/nav.ts`. It's an admin-only tool.

## Risks / Trade-offs

- **Tests might reference the removed navbar entries** — check if any test imports or asserts on the Test-Agent nav item. Likely none since it's a static config array.
- **Direct `/testagent` URL still works** — removing from navbar doesn't break existing bookmarks; the controller still handles direct access.
