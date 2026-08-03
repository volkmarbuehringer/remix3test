## Why

The webhook-requests controller (`app/actions/webhook-requests/controller.tsx:81`) and the webhook-requests create controller (`app/actions/webhook-requests/create/controller.tsx:15`) wrap their page in both `<Document>` and `<Layout>`. Since `Layout` already renders a `Document` internally, the emitted HTML nests a second `<html>` element inside the first document's `<body>`, producing invalid HTML.

## What Changes

- Remove the outer `<Document>` wrapper from the `/webhook-requests` index action so `Layout` alone supplies the document shell and its title.
- Remove the outer `<Document>` wrapper from the `/webhook-requests/create` index action the same way.
- Preserve the current page titles: pass them to `Layout` (`<Layout title="...">`) instead of the removed `Document`.
- No changes to page content, routes, forms, or actions.

## Capabilities

### New Capabilities

### Modified Capabilities
- `webhook-requests-viewer`: the `/webhook-requests` page SHALL render a single HTML document (one `<html>` root) instead of nesting a second document shell.
- `webhook-composer`: the `/webhook-requests/create` page SHALL render a single HTML document (one `<html>` root) instead of nesting a second document shell.

## Impact

- `app/actions/webhook-requests/controller.tsx` (index handler)
- `app/actions/webhook-requests/create/controller.tsx` (index handler)
- Rendered HTML of `/webhook-requests` and `/webhook-requests/create` (nested `<html>` removed; page title unchanged)
