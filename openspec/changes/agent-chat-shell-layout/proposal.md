## Why

The four agent chat pages (`/admin/workflowagent2`, `/admin/workflow-agent`, support-agent, route-agent) render with `height: 100vh` while sitting inside two nested shells (app shell + admin sidebar). The page is exactly as tall as the chrome stacked above it, so the content frame always shows a ~10% vertical scrollbar at load. The input box is also a single-line 2.4rem textarea (`rows={1}`, `resize: none`) that clips multi-line instructions even though the server accepts up to 5000 characters.

A prior change (`agent-ui-navigation-scroll-layout`) claimed this `100vh` fix for route-agent, but the current code still uses `100vh` — the fix never actually landed and needs to be done properly this time.

## What Changes

- Add a **full-height layout mode** to the sidebar shell: when a configured agent-chat target is served, the shell grid and content column constrain to the frame's available height instead of growing to content height
- Change the four chat pages from `height: 100vh` to `flex: 1; min-height: 0`, so the page fills the available area and the input bar stays pinned — no load-time vertical scrollbar
- **Enlarge the message input**: visible default height ~1.5× current (≥2 lines), auto-grows with content up to a maximum, then scrolls internally; Enter-to-send and Shift+Enter-newline preserved
- Apply consistently across all four agent chat pages: `agent-events`, `workflow-agent`, `support-agent`, `route-agent`. Note: `route-agent` is currently served standalone (not through the admin sidebar shell), so it gets the page-height and input fixes via its own container rather than the shell's full-height mode

## Capabilities

### New Capabilities

- none

### Modified Capabilities

- `agent-chat-ux`: add a requirement that the chat page fills the available content area (no page-level scrollbar on load, input bar always visible), and extend the existing multi-line input requirement to cover a visible default height of at least two lines plus auto-grow up to a maximum with internal scrolling

## Impact

- `app/ui/sidebar-layout.tsx` — full-height mode (config flag + conditional shell/content styles)
- `app/ui/admin-layout.tsx` — register the three admin-shell chat targets for full-height mode (`agent-events`, `workflow-agent`, `support-agent`; `route-agent` is standalone and not registered)
- `app/ui/{agent-events,workflow-agent,support-agent,route-agent}-page.tsx` — page height (`flex: 1; min-height: 0` in the shell pages; `height: 100%` for standalone route-agent), textarea sizing (`rows`, `min-height`, `max-height`, `overflow-y`; route-agent `<input>` becomes a `<textarea>`)
- `app/assets/streams/{agent-events,workflow-agent,support-agent,route-agent}-stream.browser.tsx` — auto-grow listener on the textarea and height reset on submit
- `app/ui/auto-grow-textarea.ts` — small shared helper for the auto-grow behavior (new)
- Tests: `app/actions/agent-events/controller.test.ts` may need no changes (layout-only), but run `npm run typecheck`, `npm run lint`, `npm test` to confirm
