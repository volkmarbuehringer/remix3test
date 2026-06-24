## Context

The webhook requests viewer (`/webhook-requests`) is a standalone SSR page (not inside a frame) that lists `webhook_requests` rows with pagination, sorting, and filtering. Currently it only supports "Resenden" actions on existing rows and "Erstellen" via a separate page at `/webhook-requests/create` which uses the `WebhookComposer` clientEntry component.

The existing `WebhookComposer` is a flat key-value grid (key + value text inputs) with a live JSON preview. It currently always starts with one empty row and submits via `POST /webhook-requests/create`. Other admin grids (client, nutzer, offerings) follow a two-column `?editing=` pattern with `PUT /:id` for updates, using `RestfulForm`, `GridStateHiddenInputs`, and `editingRedirect` utilities.

This change adds edit capability that follows the established two-column sidebar pattern while reusing the `WebhookComposer` component.

## Goals / Non-Goals

**Goals:**
- Add an "Edit" button per row in the webhook requests grid
- Implement `put('/webhook-requests/:id')` route and handler for updating the payload
- Reuse `WebhookComposer` in edit mode, pre-populated with existing payload
- Use the established `?editing=` sidebar pattern (two-column layout, sticky edit panel)
- Preserve pagination/sort/filter state throughout the edit flow
- Visually highlight the row being edited

**Non-Goals:**
- Inline cell editing (no click-to-edit in the table cell)
- Editing columns other than `payload` (token, headers, source_ip, timestamps all remain read-only)
- Nested JSON support beyond flat key-value pairs (the WebhookComposer only builds flat `{string: string}` objects)
- History/versioning of payload changes
- Batch editing of multiple rows

## Decisions

1. **Reuse WebhookComposer instead of building a separate edit component**
   - Why: The edit UI is identical to create (key-value grid + preview). Adding an `initialPayload` prop and a dynamic form action keeps everything in one place.
   - Alternative considered: A separate `WebhookEditPage`/`WebhookEditPanel` — would duplicate most of the composer's logic.

2. **Follow the `?editing=` two-column sidebar pattern**
   - Why: This is the established convention for admin grids in this codebase (client, nutzer, offerings). The webhook grid is standalone (not frame-based) so a sidebar works well.
   - Alternative considered: Navigate to a separate edit page (like the create flow) — would lose grid context and require back-navigation.

3. **PUT route at `/webhook-requests/:id` with `methodOverride`**
   - Why: Consistent with all other update routes (`PUT /admin/client/:id`, `PUT /admin/nutzer/:id`, `PUT /verwaltung/offerings/:id`). Uses existing `methodOverride` middleware via `_method=PUT` in form POST.

4. **Convert stored JSON back to key-value rows for the composer**
   - Why: The stored payload may have been created via the API (nested objects, arrays, numbers). The flat key-value grid can only represent `{string: string}`. Non-string values are `String()`-ified for display; nested objects are `JSON.stringify()`-ified.

5. **Update only the `payload` column**
   - Why: Other columns (token, headers, source_ip, timestamps, hermes_status, callback data) are either set at creation or managed by the system. Editing them is out of scope.

6. **Reuse existing `GridStateHiddenInputs` and `editingRedirect`**
   - Why: These utilities already handle the grid state preservation pattern used by other admin controllers.

## Risks / Trade-offs

1. **Payload flattening on edit** → The WebhookComposer only supports `{string: string}`. If an existing payload was created via the API with nested structure `{"a":{"b":1}}`, loading it into the composer will show `a` = `'{"b":1}'`. Saving it will stringify it further to `{"a":"{\"b\":1}"}` (double-encoded). This is the same limitation as the create flow and is accepted behavior.
   - Mitigation: Document that edit is best-effort for non-flat payloads; the primary use case is editing flat key-value payloads created via the composer.

2. **UUID primary keys** → The `id` column is UUID (not serial int). The `?editing=` pattern must work with string IDs. The `buildEditUrl` helper already accepts `string | number`. The query for row fetch uses `WHERE id = $1::uuid`.

3. **Resend form uses inline `<form>` with `<button>`** → The Aktion column currently has a resend form. Adding an edit link alongside it is straightforward — an `<a>` tag is simpler and avoids nested form issues.
