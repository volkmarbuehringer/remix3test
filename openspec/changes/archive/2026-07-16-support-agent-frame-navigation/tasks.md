## 1. Layout: Frame-as-primary viewport

- [x] 1.1 In `app/ui/support-agent-page.tsx`, replace the dual-frame container with a single primary frame named `admin-content`
- [x] 1.2 Remove the `frame-support-content` and `frame-admin-content` wrappers; keep a single frame container with `data-active-frame="admin-content"`
- [x] 1.3 Set the default frame src to a placeholder page (e.g. a new static route or inline fallback showing "Frage zu Benutzern, Terminen und Systemdaten...")
- [x] 1.4 In `app/actions/mastra/controller.tsx`, add a new `panel` action (or reuse the index route with a query param) that renders the placeholder for frame requests that haven't navigated yet

## 2. Tool: Wire routeNavigate into support agent

- [x] 2.1 Import `routeNavigate` from `../tools/route-navigate.ts` in `app/actions/mastra/agents/support-agent.ts`
- [x] 2.2 Add `routeNavigate` to the support agent's `tools` object
- [x] 2.3 Update support agent instructions to mention the navigate tool is available (generic, no route-to-query mappings)

## 3. Stream adjustments

- [x] 3.1 Update `SupportAgentStream` in `app/assets/support-agent-stream.tsx` to reference the new frame container id (if changed) and remove references to `support-content` frame
- [x] 3.2 Verify `handleNavigate` in `SupportAgentStream` correctly receives and processes navigate SSE events (should already work — confirm with a test)
- [x] 3.3 Ensure the `complete` event handler in `SupportAgentStream` reloads the correct frame (`admin-content` instead of `support-content`)

## 4. Verification

- [x] 4.1 Run `npm run typecheck` — no type errors
- [x] 4.2 Run `npm test` — existing tests pass
- [ ] 4.3 Manual check: support agent full page renders with placeholder frame, agent bar, input bar (requires browser)
- [ ] 4.4 Manual check: admin sidebar frame mode unchanged (still shows MastraChatPage) (requires browser)
