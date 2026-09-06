# Admin Uploads Multirow Delete — Design

## Context

The uploads grid (`POST /admin/uploads` renders at `/admin/uploads`) currently deletes one file at a time through a per-row trash button. See proposal.md — Why for motivation.

Constraints that shape the approach:

- **Frame action-path GET-resolve invariant**: the Remix frame runtime commits a submitted POST form action path as the frame `src`, and the SSE ConnectionIndicator reloads it on invalidate. That path must therefore also resolve as GET. The existing single delete handles this with the `destroy` (`POST /:id/delete`) + `destroyResolve` (`GET /:id/delete`) pair (see `app/routes.ts` and the controller's `destroyResolve` action). A bulk endpoint inherits the same rule.
- **Ownership scoping**: admins may operate on any row; a non-admin only on rows they claimed (`uploaded_by = user.id`). This split is enforced on both the read path (`getUploadsPage`, `getUploadDownload`) and the write path (`deleteUpload`, `claimUploads`).
- **Grid state is carried through a delete** via hidden inputs `_page`/`_sort`/`_order`/`_filter` (`UploadsGridStateHiddenInputs`) so the post-delete redirect returns to the same view.
- **Banners are rendered from props during re-render**; the upload error banner is driven by a `?uploadError=` URL param (see `uploadErrorFromParam`).

## Goals / Non-Goals

**Goals:**

- Add a checkbox column (per-row + header "select all") and an "Ausgewählte löschen" bulk action to the uploads grid.
- Add one bulk delete endpoint that deletes all selected rows in a single database operation, honoring ownership.
- Preserve the grid view (page/sort/order/filter) after a bulk delete, and show a "N Dateien gelöscht." banner when rows were removed.
- Add a count-based confirmation before submitting the bulk delete.
- Keep the existing per-row delete (and its context-menu entry) working unchanged.

**Non-Goals:**

- Cross-page selection: checkboxes only cover the currently-loaded page; "select all" selects that page's rows only. Selection is not persisted across pagination/sort/filter changes.
- Server-side "select all matched results" (matching the filter) — the selection is the set of checkboxes on the current page.
- Removing or changing the per-row delete.
- Auditing which rows were skipped for ownership reasons (deletion is best-effort per row, mirroring single delete).

## Decisions

### 1. Dedicated bulk endpoint vs reusing the `action` POST route

**Decision:** Add a dedicated `POST /admin/uploads/delete-many` plus a matching `GET /admin/uploads/delete-many` resolver.

**Why:** Mirrors the existing `destroy`/`destroyResolve` pair and keeps the upload handler (multipart) separate from delete. The `uploadFormData` middleware is specialized to the uploads action path; a separate delete path avoids entangling multipart parsing with bulk delete.

**Alternative (rejected):** Reuse `POST /admin/uploads` (the `action` route) and dispatch on a hidden `_action` field. This needs no new GET resolver because `/admin/uploads` already GETs as `index`, but it conflates upload and delete in one handler and couples the delete to the upload multipart middleware. Rejected for clarity.

### 2. Selected ids wire format

**Decision:** Render each row checkbox as `<input type="checkbox" name="ids" value="<id>">` and read them server-side with `context.formData.getAll('ids')`. The "select all" header toggle is a separate control (not named `ids`) that the clientEntry mirrors onto the row checkboxes.

**Why:** Checkboxes are themselves the form fields, so no JavaScript is needed to sync selection into hidden inputs; only checked rows are submitted. `formData.getAll('ids')` yields a `string[]`, mapped to numbers.

**Alternative (rejected):** A single comma-separated `ids` hidden field maintained by JS. Works but requires JS to keep a hidden field in sync with the checkboxes and re-introduces the parse step. The repeated-field approach is simpler and matches how FormData already collapses repeated names.

### 3. Data function `deleteUploads(db, ids, userId?)`

**Decision:** Add `deleteUploads(db, ids: number[], userId?: number): Promise<number>` that deduplicates the ids, then runs:

- admin: `DELETE FROM uploads WHERE id = ANY($1::int[])`
- non-admin: `DELETE FROM uploads WHERE id = ANY($1::int[]) AND uploaded_by = $2`

and returns `affectedRows ?? 0`.

**Why:** A single `= ANY($1::int[])` statement is one round-trip and reuses the array-clause pattern already proven in `claimUploads` (which uses `id = ANY($1::int[])`). Ownership is enforced in the WHERE clause, so a non-admin cannot delete another user's rows even if they pass those ids — matching `deleteUpload`.

**Alternative (rejected):** Loop `deleteUpload` over each id. Simpler to write but does N round-trips and re-runs the ownership check N times; worse for large selections.

### 4. Client-side selection + confirmation

**Decision:** Add a single clientEntry `admin-uploads-bulk-delete.tsx` that:
- wires the header "select all" toggle to the row checkboxes on the current page,
- updates the bulk button label ("Ausgewählte löschen (N)") and its disabled state,
- on submit, counts `input[name="ids"]:checked` and confirms `"${n} Dateien wirklich löschen?"` (blocking submission when cancelled).

**Why:** One cohesive component keeps selection state and the count-based confirm together, mirroring the existing `ConfirmDelete` capture-phase delegation but scoped to the bulk form.

**Alternative (rejected):** Extend the existing `ConfirmDelete` clientEntry by setting `data-confirm` on the bulk form. The message would need to be static (no dynamic count) because `data-confirm` is fixed at SSR time; deriving the count would still require new JS. A dedicated clientEntry is cleaner.

### 5. Deleted-count banner

**Decision:** After a successful bulk delete, redirect to the uploads grid with a `?deleted=N` query param and render a "N Dateien gelöscht." banner in `renderUploadsPage` (asymmetric with the `uploadError` param handling; `deleted` is read from the URL and cleared immediately by the redirect being a fresh GET). The redirect also carries the preserved grid state (`_page`/`_sort`/`_order`/`_filter`).

**Why:** Reuses the existing URL-param-driven banner pattern; no session flash plumbing. The frame reload after a POST hits the same redirect target as a fresh GET.

**Alternative (rejected):** `session.flash` + top-level Layout banner. The uploads page renders banners via props in a frame fragment, and the `remix3-session-flash-frames` note warns fragments don't render the Layout flash banner — so a URL param is the consistent choice. Silent reload (no banner) was considered but the page already has banner infrastructure; adding the count is a small, worthwhile improvement.

### 6. Selection scope

**Decision:** Selection is limited to the rows rendered on the current page. Deleting posts only those selected ids, so the operation is bounded and the grid-state redirect stays coherent.

**Why:** Keeps the feature scoped and avoids persisting a selection set across pages. Cross-page selection is a separate, larger design (selection repository + "select all N results").

## Risks / Trade-offs

- **[Bulk delete removes rows across page boundaries]** → Because selection is current-page only, a user cannot delete rows on other pages in one action. Accepted as a non-goal (see Non-Goals).
- **[Client-side count can drift from server-side deleted count]** → The banner count comes from `deleteUploads`'s `affectedRows` (what was actually deleted), not the client send count. The labels/confirm use the client count as guidance only.
- **[A non-admin selecting another user's row (e.g. an admin-visible row) sees it silently not-deleted]** → Ownership is enforced in the WHERE clause; the row is left untouched and not counted. Mirror of existing single-delete behavior; accepted.
- **[New route path `/delete-many` must not collide with `/:id/delete`]** → `/delete-many` is a single fixed segment, while `/:id/delete` requires two segments (`X/delete`), so they cannot overlap. Verified against the route contract.
- **[Frame reload races the POST]** → The `delete-many` GET resolver renders the grid on the same path, so the invalidate reload and the post-POST redirect both land on a valid GET, matching the existing `destroyResolve` behavior.

## Migration Plan

No schema or data migration. Ship the code change; the new route and `deleteUploads` function are additive. Rollback is a revert of the route additions and the controller/UI changes — no data impact.

## Open Questions

None. (The remaining choices are implementation-level and can be decided during coding without changing the specs, approach, or task breakdown.)
