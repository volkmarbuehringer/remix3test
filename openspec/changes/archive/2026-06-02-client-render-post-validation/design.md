## Context

The `/client` route is a standalone CRUD lab at the root level (not under admin routes). It already renders via `Layout` directly — no `ShellOrFragment`, no `createSidebarLayout`. Its grid uses a `<Frame>` for async loading, but the outer page is a plain `context.render(<Layout><ClientPage .../></Layout>)`.

Currently, form validation uses `s.parse` with try/catch, returning `context.json({ ok: false, error: '...' }, { status: 400 })` on failure. This returns a JSON body with no HTML context — the browser shows raw JSON or the client must handle it with JavaScript.

Since the route is not frame-wrapped, `context.render(...)` in a POST action will render the full page directly into the response, making re-render-from-POST possible without any architectural changes.

## Goals / Non-Goals

**Goals:**
- Add `minLength(8)` to the `name` field schema so validation can fail for testing
- Use `parseSafe` instead of `s.parse` + try/catch for cleaner validation flow
- On validation failure, re-render the page with `context.render()` passing `formValues` and `fieldErrors`
- Form inputs preserve submitted values via `value={}` attributes
- Per-field error messages appear inline next to the relevant input
- Grid Frame continues to work independently (untouched)

**Non-Goals:**
- Does NOT remove or modify the Frame-based grid
- Does NOT change the route structure, middleware, or URL
- Does NOT add `clientEntry` or browser-only JavaScript
- Does NOT change the `destroy` action (DELETE returns a redirect, not a render)
- Does NOT add field-level validation beyond `minLength(8)` on name

## Decisions

### Validate with `parseSafe`, not `parse` + try/catch

`parseSafe` returns a Result type (`{ success: true, value }` | `{ success: false, issues }`) that makes validation control flow explicit. This follows the Remix skill reference pattern and the timeboxer auth demo. The existing `s.parse` + try/catch approach conflates schema failures with unexpected errors.

### Extract raw FormData values for preservation

Before calling `parseSafe`, extract all field values from `FormData` as strings. On validation failure, pass these raw values as `formValues` prop so the page can set `value={formValues.name}` on inputs. This is the key difference from auth pages which lose values.

### Map parseSafe issues to per-field error records

`parseSafe` returns issues with `path` arrays. Convert to `Record<string, string>` keyed by field name, picking the first issue per field. This simplifies the page component's rendering.

### Edit and Create share the same validation schema

Both `update` and `create` actions use the same `clientSaveSchema`. Adding `minLength(8)` to name applies to both. The controller already uses a shared schema — just modify it in place.

### Keep the Frame grid

The `<Frame name="clientGrid" src={frameSrc} />` in `ClientPage` continues to load the grid asynchronously. When re-render-from-POST sends new HTML, the Frame reloads its content independently. This means the grid data is always fresh, while the edit/create sidebar shows validation state. No coordination needed between the two.

## Risks / Trade-offs

[Double-submit on refresh] → Browser shows "confirm form resubmission" after a 400 POST. Same as auth pages. Acceptable for a lab/test route.

[Existing test breakage] → Tests that assert on JSON error responses will fail and need updating to assert on HTML error content instead. Mitigation: update tests as part of implementation.

[Grid state on re-render] → The Frame grid reloads independently when the page re-renders, so sort/filter/pagination state resets. Mitigation: preserve grid state params in the re-rendered form (hidden fields with `_offset`, `_sort`, `_order`, `_filter`), same as the existing redirect flow does.
