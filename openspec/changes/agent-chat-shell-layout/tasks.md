## 1. Sidebar shell: full-height mode

- [x] 1.1 Add `fullHeightTargets?: string[]` to `SidebarLayoutConfig` in `app/ui/sidebar-layout.tsx` and wire it through `createSidebarLayout`
- [x] 1.2 In `LayoutComponent`, compute whether the current request pathname matches a full-height target and apply a `fullHeight` style variant: `height: 100%` + `gridTemplateRows: 'minmax(0, 1fr)'` on `shellStyle`, `height: 100%` on `contentStyle`
- [x] 1.3 Register the three admin-shell chat index routes (`agentEvents.index`, `workflowAgent.index`, `supportAgent.index`) as `fullHeightTargets` in `app/ui/admin-layout.tsx` (add the option to the `createSidebarLayout` call; `route-agent` is standalone and NOT registered)

## 2. Chat pages: container-fill height

- [x] 2.1 In `app/ui/agent-events-page.tsx`, change `pageStyle` from `height: 100vh` to `flex: 1; min-height: 0` (keep `overflow: hidden`)
- [x] 2.2 Apply the same `pageStyle` change in `app/ui/workflow-agent-page.tsx`
- [x] 2.3 Apply the same `pageStyle` change in `app/ui/support-agent-page.tsx`
- [x] 2.4 In `app/ui/route-agent-page.tsx`, change `pageStyle` from `height: 100vh` to `height: 100%` (route-agent is standalone — its parent is the plain `Layout`'s definite-height scroll container, so flex fill does not apply; keep `overflow: hidden`)

## 3. Input: larger visible multi-line box

- [x] 3.1 In `app/ui/agent-events-page.tsx`, set the textarea to `rows={2}`, `minHeight: '3.6rem'`, and add `overflowY: 'auto'` and a `maxHeight` (~10rem)
- [x] 3.2 Apply the same textarea styling in `app/ui/workflow-agent-page.tsx`
- [x] 3.3 Apply the same textarea styling in `app/ui/support-agent-page.tsx`
- [x] 3.4 In `app/ui/route-agent-page.tsx`, convert the `<input id="route-agent-input">` to a `<textarea>` (same id/name/placeholder) with `rows={2}`, `minHeight: '3.6rem'`, `maxHeight` (~10rem), `overflowY: 'auto'`, `resize: 'none'`, `lineHeight: '1.4'`

## 4. Auto-grow input

- [x] 4.1 Create `app/ui/auto-grow-textarea.ts` exporting a helper that attaches an `input` listener to a textarea: set `height: auto`, clamp to `min(scrollHeight, maxHeight)`, and a `reset` that restores the default height
- [x] 4.2 Wire the helper into `app/assets/streams/agent-events-stream.browser.tsx` (attach on mount with `handle.signal`, reset after successful submit alongside the existing value clear)
- [x] 4.3 Wire the helper into `app/assets/streams/workflow-agent-stream.browser.tsx`
- [x] 4.4 Wire the helper into `app/assets/streams/support-agent-stream.browser.tsx`
- [x] 4.5 Wire the helper into `app/assets/streams/route-agent-stream.browser.tsx` — update the `route-agent-input` element casts from `HTMLInputElement` to `HTMLTextAreaElement`, add an Enter-to-send / Shift+Enter-newline keydown handler (route-agent previously used a single-line `<input>`, so it has none), and reset the height after submit

## 5. Verify

- [x] 5.1 Run `npm run typecheck` — no errors
- [x] 5.2 Run `npm run lint` — no errors
- [x] 5.3 Run `npm test` — all pass (especially `app/actions/agent-events/controller.test.ts`)
- [ ] 5.4 Manual check on `/admin/workflowagent2` and the other three chat pages: no vertical scrollbar on load, input bar pinned at the bottom, textarea shows ≥2 lines and grows as the message wraps, Enter sends, Shift+Enter adds a newline, input resets after send
