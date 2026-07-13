## 1. Add Route-Agent to main navbar

- [x] 1.1 Add `{ label: 'Route-Agent', href: '/route-agent', adminOnly: true }` to `NAV_SECTIONS` in `app/ui/nav.ts`

## 3. Route-agent page: scrollable message area + height fix

- [x] 3.1 Change `pageStyle` from `height: 100vh` to `flex: 1, minHeight: 0` in `app/ui/route-agent-page.tsx`
- [x] 3.2 Replace the `#agent-bar` div with a `#route-agent-messages` div styled like the test-agent timeline: `flex: 1, minHeight: 0, overflowY: auto, display: flex, flexDirection: column, gap, padding, border, borderRadius, background`
- [x] 3.3 Remove `#route-agent-form` from the page template — the form is now inside the messages-area concept; keep it at the bottom but let the layout flex column keep it visible

## 4. Route-agent stream: message bubble rendering

- [x] 4.1 Refactor `app/assets/route-agent-stream.tsx` to render message bubbles into `#route-agent-messages` (user + assistant) instead of setting bar text
- [x] 4.2 Add tool card rendering (collapsible cards with args streaming, result display) matching test-agent pattern
- [x] 4.3 Add reasoning block rendering (details/summary) matching test-agent pattern
- [x] 4.4 Add auto-scroll to bottom on new content
- [x] 4.5 Add approval card rendering in the page (or keep inline `prompt()` — decide: use approval card for consistency)
- [x] 4.6 Preserve existing tool-result navigation handler (`navigateFrame`)

## 5. Verify

- [x] 5.1 Run `npm run typecheck` — no errors
- [x] 5.2 Run `npm run lint` — no errors
