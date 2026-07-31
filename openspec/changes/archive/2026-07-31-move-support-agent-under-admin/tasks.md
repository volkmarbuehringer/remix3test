# Tasks

## 1. Route tree nesting

- [x] 1.1 In `app/routes.ts`, add `supportAgent: route('support-agent', { index: get('/'), panel: get('/panel'), action: post('/'), toolDecision: post('/tool-decision'), answer: post('/answer') })` inside `routes.admin`; add `supportAgentPanel: 'support-agent-panel'` to the `frames` const
- [x] 1.2 In `app/routes.ts`, remove the now-empty `mastra: route('mastra', { chat: ... })` tree
- [x] 1.3 In `app/router.ts`, change `router.map(routes.mastra.chat, mastraChat)` → `router.map(routes.admin.supportAgent, mastraChat)`

## 2. Controller rendering

- [x] 2.1 `app/actions/mastra/controller.tsx`: change `createController(routes.mastra.chat, ...)` → `createController(routes.admin.supportAgent, ...)`; `index` renders a single `renderAdminPage(context.render, 'support', <SupportAgentPage />)`; import `renderAdminPage` from `../../ui/admin-layout.tsx`
- [x] 2.2 Delete the manual frame/direct two-branch in `index`; drop `?threadId=` and `?error=` handling, `recallChatMessages`/`validateThreadId`/`ChatMessage` imports, and the `MastraChatPage` import
- [x] 2.3 `action` and `answer` (and `toolDecision` where applicable): pass a `getTarget` mapping to `pipeStream` that returns `frames.supportAgentPanel` for agent-driven navigate paths

## 3. Panel frame rename

- [x] 3.1 `app/ui/support-agent-page.tsx`: `<Frame name="admin-content">` → `name={frames.supportAgentPanel}`; `data-active-frame` → `frames.supportAgentPanel`; `src` → `routes.admin.supportAgent.panel.href()`
- [x] 3.2 `app/ui/admin-layout.tsx`: nav item `support` route → `routes.admin.supportAgent.index`; add `frames.supportAgentPanel` to `contentOnlyTargets`

## 4. Client stream URLs and frame defaults

- [x] 4.1 `app/assets/streams/support-agent-stream.browser.tsx`: hardcoded `'/mastra/chat'` → `'/admin/support-agent'`, `'/mastra/chat/tool-decision'` → `'/admin/support-agent/tool-decision'`, `'/mastra/chat/answer'` → `'/admin/support-agent/answer'` (4 sites)
- [x] 4.2 `app/assets/streams/support-agent-stream.browser.tsx`: `'admin-content'` frame-name defaults → `'support-agent-panel'` (complete-reload and frame-form-submit)

## 5. Sidebar, security, and route references

- [x] 5.1 `app/middleware/skip-csrf.ts`: exemptions `'/mastra/chat'` / `'/mastra/chat/'` → `'/admin/support-agent'` / `'/admin/support-agent/'`
- [x] 5.2 `app/route-labels.ts`: `[routes.mastra.chat.index.href()]` → `[routes.admin.supportAgent.index.href()]`
- [x] 5.3 `app/ui/admin-page.tsx`: link `routes.mastra.chat.index.href()` → `routes.admin.supportAgent.index.href()`
- [x] 5.4 `app/ui/scaffold-home-page.tsx`: link → `routes.admin.supportAgent.index.href()`
- [x] 5.5 `app/ui/admin-chatlog-page.tsx`: conversation link `?threadId=` → `routes.admin.chatlog.fragments.detail.href({ id: conv.id })`

## 6. Remove threadId read-only view

- [x] 6.1 Delete `app/ui/admin-mastra-chat-page.tsx` (MastraChatPage has no remaining consumers)
- [x] 6.2 Confirm `recallChatMessages` / `validateThreadId` remain used only by `app/actions/chat/controller.tsx` and `app/actions/admin/chatlog/controller.tsx`

## 7. Tests

- [x] 7.1 `app/actions/mastra/controller.test.ts`: verify URL constants follow the route change; update test names referencing `/mastra/chat`

## 8. Verification

- [x] 8.1 Run `npm test` and `npm run typecheck`
- [ ] 8.2 Manual: admin sidebar visible on `/admin/support-agent`; chat input box present and streams; sidebar nav navigates the whole page frame; `routeNavigate` loads content-only into the panel; `/mastra/chat` no longer renders the chat
