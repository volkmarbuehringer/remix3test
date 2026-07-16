## Context

Remix 3's `<Frame>` component is a server-rendered DOM region (delimited by comment markers) — not an iframe. It does not intercept HTML form submissions. When a plain `<form method="POST" enctype="multipart/form-data">` inside a Frame submits, the browser navigates the main window to the form action URL, replacing the parent page.

The route-agent page (`/route-agent`) uses a Frame named `lists-content` to show target pages (e.g., uploads). The uploads page's file upload form triggers this unwanted full-page navigation, destroying the agent UI (input bar, message history).

Existing clientEntries in the codebase already use `handle.frame.reload()` and `handle.frame.replace()` to update frame content asynchronously (e.g., `lists-client.tsx`, `grid-refresh-button.tsx`, `appointtype-panel.tsx`).

## Goals / Non-Goals

**Goals:**

- File uploads from within the route-agent's frame update in-place without navigating the main window
- The route-agent's input bar, message history, and SSE stream remain intact after upload
- Success/error feedback from the server (e.g., "Datei hochgeladen (ID: 123)") is preserved in the UI

**Non-Goals:**

- No changes to the route-agent page or its SSE stream handler
- No changes to the upload data layer, middleware, or file processing logic
- No new routes or API endpoints
- No changes to other forms in other frames

## Decisions

1. **`handle.frame.replace()` over `handle.frame.reload()`**
   - `reload()` does a GET to the frame's `src`, which loses the success/error banner from the POST response
   - `replace()` takes the POST response HTML directly and diffs it into the frame's DOM region, preserving all server-rendered state
   - `replace()` handles both full-document replacement (when at top-level) and fragment diffing (when in a child frame), so the same code works for direct access and frame access

2. **ClientEntry in uploads controller over event delegation in route-agent**
   - Keeps the interception logic co-located with the form it intercepts
   - The uploads page controls its own submission behavior
   - Consistent with the existing pattern used by `lists-client.tsx`, `grid-refresh-button.tsx`, and others

3. **`fetch` with `FormData` over manual multipart construction**
   - Browser sets `Content-Type: multipart/form-data; boundary=...` automatically
   - The existing `formData` middleware and `uploadHandler` process it identically to a browser form POST
   - CSRF token (`_csrf`) from `<CsrfTokenInput />` is included in the FormData automatically

## Risks / Trade-offs

- **Submit button feedback**: The button's name/value is not included in `new FormData(form)` (browser behavior) — but the uploads controller doesn't check for a submit button value, so this has no effect
- **Network errors**: If the fetch fails (network issue, server error), the form state needs to be restored (re-enable button, show error). The clientEntry handles this in a try/catch
- **Multiple rapid submissions**: The button is disabled during upload, preventing double-submit
