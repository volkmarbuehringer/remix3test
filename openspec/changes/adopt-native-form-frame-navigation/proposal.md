# Change Proposal: Adopt Native Form-Driven Frame Navigation

## Why

Upstream Remix (#11668) made `<form>` submissions inside Frames fully native:
the runtime reads `rmx-target`/`rmx-src`/`rmx-reset-scroll`/`rmx-history`
directly from forms and drives the frame through `resolveFrame` instead of a
top-level reload. #11667 also made redirects from frame reloads follow into the
active frame.

Two app remnants from the pre-native era now duplicate or bypass that behavior:

1. The grid filter form (`grid-page.tsx`) omits `rmx-target`, so it is not
   intercepted by the native path and forces a full page reload when submitted
   from inside the admin frame.
2. `workflow-agent-stream.browser.tsx` re-implements generic form interception
   (`handleFrameFormSubmit`) that the runtime now provides natively, including
   the fetch-and-reload cycle the frame API does better.

## What Changes

- Add `rmx-target="admin-content"` to the grid filter form (`app/actions/client/grid-page.tsx`) so submissions are native frame navigations
- Delete the generic `handleFrameFormSubmit` shim and its container listener from `app/assets/streams/workflow-agent-stream.browser.tsx`
- Keep the route/support-agent interceptors, which route JSON POST responses into the agent SSE stream — a capability native interception lacks
- Update the `frame-form-intercept` spec to reflect native interception

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `frame-form-intercept`: Add a requirement that the workflow agent relies on native frame form interception; modify the GET-form scenario to require `rmx-target="admin-content"` on the grid filter form
