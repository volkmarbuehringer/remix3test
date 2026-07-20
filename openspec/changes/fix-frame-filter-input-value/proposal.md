## Why

After frame navigation (via agent `navigate` event or user filter form submission), the filter input in `/admin/users` shows empty even when the URL has `?filter=fritz`. This is caused by Remix Frame DOM reconciliation skipping `setAttribute('value')` when the current input value differs from the server-rendered value — `defaultValue` is never applied.

## What Changes

- In `workflow-agent-stream.tsx`: after `frame.reload()` in both `handleNavigate` and `handleFrameFormSubmit` GET branch, explicitly set the filter input's `.value` property from URL params
- In `route-agent-stream.tsx`: apply the same fix to `handleNavigate` for consistency

## Capabilities

### New Capabilities
- `frame-input-value-restore`: After frame reload completes, restore `<input name="filter">` value from the frame's current URL query parameters

### Modified Capabilities
*(none)*

## Impact

- `app/assets/workflow-agent-stream.tsx` — add value restoration in `handleNavigate` and `handleFrameFormSubmit`
- `app/assets/route-agent-stream.tsx` — add value restoration in `handleNavigate`
