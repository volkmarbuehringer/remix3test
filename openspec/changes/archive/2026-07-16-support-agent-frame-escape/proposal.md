## Why

Form submissions and JavaScript-driven navigation inside the support agent's primary frame escape the frame boundary and navigate the top-level page, causing the agent bar and input box to disappear. The user loses the agent entirely.

## What Changes

- Add a `submit` event listener on the support agent frame container that intercepts all form submissions from within the frame, sends them via `fetch()`, and reloads the frame instead of navigating the top-level page
- Add a shared `safeReload` utility that client entries use instead of bare `window.location.reload()` when they need to refresh after a fetch-based action
- Update `nutzer-table-interactive.tsx` to use `safeReload` instead of `window.location.reload()` and `window.location.href =`
- Wire the form fetch response to feed back to the agent when there is a pending question
- Extend pattern to other admin client entries as needed

## Capabilities

### New Capabilities
- `frame-form-intercept`: Intercepts form submissions within the support agent frame, sends them via fetch, feeds results to the agent when a question is pending, and reloads the frame to reflect changes
- `frame-aware-reload`: Shared utility that client entries use instead of bare `window.location.reload()` — reloads only the frame when inside an agent frame, falls back to top-level reload otherwise

### Modified Capabilities
- `support-agent-frame-layout`: The layout spec may need a requirement that the frame contains form navigation within itself
- `support-agent-navigate-tool`: The navigate tool spec may need a requirement about frame-scoped form handling during active agent sessions

## Impact

- `app/assets/support-agent-stream.tsx` — add form intercept handler
- `app/utils/frame-utils.ts` — new shared utility
- `app/assets/nutzer-table-interactive.tsx` — use `safeReload`
- Potentially other client entries with similar `fetch()` + `reload()` patterns
- No API or dependency changes
