## Why

When the route-agent page navigates a Frame to the uploads page and the user submits the file upload form, the browser performs a full-page POST navigation — replacing the entire route-agent page (including the agent input bar and message history) with the standalone admin uploads view. This breaks the agent-driven workflow: the user loses access to the agent after every upload.

## What Changes

- Add a `clientEntry` in the uploads controller that intercepts the form submit, sends it via `fetch`, and uses `handle.frame.replace()` to update the frame content in-place
- Add an `id` attribute to the upload form for the clientEntry to bind to
- No changes to the route-agent page, no changes to the upload logic, no new routes

## Capabilities

### New Capabilities

- `frame-form-interception`: client-side form submission handling for forms rendered inside Remix Frames, using `fetch` + `handle.frame.replace()` to keep the parent page intact

### Modified Capabilities

_(none — no spec-level requirement changes)_

## Impact

- `app/actions/uploads/controller.tsx` — add clientEntry import and handler component, add form id
- No routing changes, no data layer changes, no middleware changes
- Backward compatible: works identically when the uploads page is accessed directly (top-level frame) vs. inside the route-agent's child frame
