# Design: move-support-agent-under-admin

## Route tree nesting

The support-agent chat tree moves out of the top-level `mastra` tree and into the existing `admin` tree:

```ts
routes.admin = route('admin', {
  ...
  supportAgent: route('support-agent', {
    index: get('/'),
    panel: get('/panel'),
    action: post('/'),
    toolDecision: post('/tool-decision'),
    answer: post('/answer'),
  }),
})
```

Resulting URLs:

| Before | After |
| --- | --- |
| `/mastra/chat` | `/admin/support-agent` |
| `/mastra/chat/panel` | `/admin/support-agent/panel` |
| `/mastra/chat` (POST) | `/admin/support-agent` (POST) |
| `/mastra/chat/tool-decision` | `/admin/support-agent/tool-decision` |
| `/mastra/chat/answer` | `/admin/support-agent/answer` |

Wiring follows the proven pattern from `move-agent-routes-under-admin`: `routes.admin` stays mapped to `admin.adminController`, and the narrower `router.map(routes.admin.supportAgent, mastraChat)` overrides that subtree. `requireAuth()` + `requireAdmin()` middleware stay on the controller.

The `routes.mastra` tree held only `chat`, so it is removed entirely. The `app/actions/mastra/` directory is the Mastra integration backend (agents, tools, workflows, storage, scorers) and is untouched; only the chat controller's target changes.

## Rendering the sidebar

`index` switches from the manual two-branch render (frame → `MastraChatPage` fragment, else → `<Layout>` standalone) to a single `renderAdminPage(context.render, 'support', <SupportAgentPage />)` call. `renderAdminPage` → `ShellOrFragment` already handles both cases:

- Frame request (`X-Remix-Target: admin-content`) → sidebar shell + page content
- Direct GET → `Layout > Frame(name=admin-content)` which re-requests the URL with the target header, producing the sidebar
- Non-GET → `Layout > sidebar shell`

This fixes the reported bug: the chat input box (in `SupportAgentPage`) is now rendered on every access path, because the whole page is always the sidebar + `SupportAgentPage`.

### Dropped threadId read-only view

The old frame branch rendered a read-only `MastraChatPage` conversation when a `?threadId=` query param was present (used by the chatlog conversation link). After the move:

- The frame branch is deleted; `index` no longer reads `threadId`/`error`, and no longer calls `recallChatMessages`
- `MastraChatPage` (`app/ui/admin-mastra-chat-page.tsx`) has no other consumers → file deleted
- Dead imports (`recallChatMessages`, `validateThreadId`, `ChatMessage`, `MastraChatPage`) are removed from the controller
- The chatlog conversation link (`app/ui/admin-chatlog-page.tsx:113`) is repointed at the existing read-only detail fragment route `routes.admin.chatlog.fragments.detail` (`/admin/chatlog/fragments/detail/:id`), which already renders the conversation via `ChatlogDetailFragment`

`recallChatMessages`/`validateThreadId` remain used by `app/actions/chat/controller.tsx` and `app/actions/admin/chatlog/controller.tsx`, so `app/utils/mastra-memory.ts` and `app/utils/thread-id.ts` stay.

## Nested frame naming — the key risk

`SupportAgentPage` embeds an inner panel frame. Today it is named `admin-content`:

```tsx
<Frame name="admin-content" src={routes.mastra.chat.panel.href()} ... />
<div id="support-agent-frame-container" data-active-frame="admin-content" ...>
```

After nesting, the agent page document (content of the top-level `admin-content` frame) would contain both the sidebar shell and an inner frame named `admin-content` — the exact collision described in `move-agent-routes-under-admin`: `getNamedFrame('admin-content')` would resolve to the inner panel, so sidebar `NavLink` clicks would load into the small panel instead of navigating the page.

### Decision: rename the inner panel frame

| Page | Panel frame name | `data-active-frame` | SSE navigate target |
| --- | --- | --- | --- |
| Support-Agent | `support-agent-panel` | `support-agent-panel` | `support-agent-panel` |

The frame name is added to the `frames` const in `app/routes.ts` so the `<Frame name>`, `data-active-frame`, SSE navigate targets, and the layout's target lists cannot drift.

Effect after the move:

- Sidebar `NavLink` clicks: `getNamedFrame('admin-content')` no longer matches a frame in the agent page document → falls back to the document's top frame (the `admin-content` frame itself) → whole-page navigation. Correct.
- SSE `navigate` events (from `routeNavigate`): `handle.frames.get('support-agent-panel')` resolves the panel frame in the same document. Preserves today's intent (show the user a view while the chat stays open).

### Panel frame target is content-only

A `<Frame>` fetches its `src` with `X-Remix-Target: <frameName>`. Loading an admin route into the panel with a plain frame target would render the full admin fragment — including the sidebar — duplicating the sidebar the agent page already shows. Fix: register `support-agent-panel` in the sidebar layout's `contentOnlyTargets`:

```tsx
createSidebarLayout<AdminNavItem>({
  frameTarget: frames.adminContent,
  acceptFrameTargets: [frames.listsContent],
  contentOnlyTargets: [
    frames.agentEventsPanel,
    frames.workflowAgentPanel,
    frames.supportAgentPanel,
  ],
  ...
})
```

With that, loading `/admin/users` into the panel renders only the users grid — no duplicate sidebar, no public `MainNav`, no nested `rmx-frame`.

### getTarget mapping for routeNavigate

`routeNavigate` tool results are translated to SSE `navigate` events by `pipeStream` → `filterAndForward`, which defaults the target to `admin-content` (`app/utils/agent-sse.ts:98`). After the panel rename, that default would target a nonexistent frame and the client would show "Fehler: Frame nicht gefunden". The controller passes a `getTarget` to `pipeStream` (both the `action` POST and, where applicable, the resume paths) that resolves agent-driven paths to the panel:

```ts
function getPanelTarget(path: string): string {
  // Everything the support agent might navigate to renders in the content-only panel
  return frames.supportAgentPanel
}
```

This matches the workflow-agent philosophy: `pipeStream(output.fullStream, controller, signal, runId, getTarget)`. The panel starts as the blank placeholder (unchanged `panel` action); agent navigation fills it.

## URL references outside the route tree

- `app/assets/streams/support-agent-stream.browser.tsx` hardcodes the SSE POST targets (`'/mastra/chat'`, `'/mastra/chat/tool-decision'`, `'/mastra/chat/answer'`) → `/admin/support-agent(/*)`; the `'admin-content'` frame fallbacks (complete-reload at `:470`, frame-form-submit at `:509`) → `'support-agent-panel'`
- `app/middleware/skip-csrf.ts` exemptions for the POST endpoints (`/mastra/chat(/*)`) → `/admin/support-agent(/*)`
- `app/route-labels.ts` href key → `routes.admin.supportAgent.index.href()`
- `app/ui/admin-layout.tsx` nav item route → `routes.admin.supportAgent.index`
- `app/ui/admin-page.tsx`, `app/ui/scaffold-home-page.tsx`, `app/ui/admin-chatlog-page.tsx` href references → `routes.admin.supportAgent.index.href()` (chatlog link → detail fragment)
- `app/actions/mastra/controller.test.ts` URL constants (`CHAT_INDEX_URL`, `CHAT_ACTION_URL`) derive from `routes.mastra.chat.*` and follow the route change automatically; test names mentioning `/mastra/chat` are updated cosmetically

## Panel actions unchanged

The `panel` action keeps returning a bare placeholder fragment — it is a frame endpoint and needs no shell handling. Its path moves with the route tree automatically.
