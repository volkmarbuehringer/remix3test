## Context

See proposal.md for the motivation. Relevant current-state facts that shape this design:

- The base transport already exists and is shared: `app/assets/entry.tsx` frame runtime, `createController` actions, `renderAdminPage` (`createSidebarLayout`), `RestfulForm` (PUT/DELETE via `_method` + auto-CSRF), `GridStateHiddenInputs`, `mixins/admin-urls.ts`, `utils/grid-state.ts`.
- `/admin/users` is the closest existing reference but carries client-mutating features: the row toggle and the context-menu activate/deactivate both call `fetch(POST toggle-disabled, JSON)` then `frame.reload()`.
- **Flash visibility constraint**: `app/ui/layout.tsx` reads `session.get('error'|'success')` and renders the banner, but only in the full document `Layout`. Frame fragments render through `createSidebarLayout`'s `LayoutComponent`, which has **no flash banner** — so a `session.flash` set by an admin redirect would be consumed but never shown.

## Goals / Non-Goals

**Goals:**
- A canonical, copyable admin CRUD base (controller + page pair) so every admin page/form converges: SSR-first, frame `data-rmx-target`, controlled submission, server-rendered row actions, PRG, grid-state round-trip.
- Make `session.flash` visible inside admin frame fragments so PRG error/success messages display.
- Remove the client-mutating toggle path (JSON fetch + `frame.reload()`) in favor of a server form.
- Keep the context menu and one-click toggle as *input affordances* that submit server forms (no direct mutation).

**Non-Goals:**
- No factory/codegen scaffold (see D1). No client-side rendering.
- Not changing the `/verwaltung` layout (uses a separate `verwaltung-layout.tsx`) beyond reusing the same primitives.
- Not removing the context-menu affordance — only re-routing its actions through server forms.
- No spec changes beyond the `admin-page-base` capability already captured.

## Decisions

### D1. Base = copyable template + one shared error-render helper, not a factory
The base is expressed as a reference controller + page pair (clean `/admin/users`) that each new page copies, plus a single extracted helper that removes the largest recurring boilerplate (`renderGridFormError`). The per-page logic that differs (audit logging, password complexity, `email exists`, bespoke sort/filter predicates) stays in the page controller.

- **Why not a factory** (`adminCrud(config)`): the differing logic isn't uniform enough to express as extension hooks without a larger type surface; a factory front-loads complexity before 2–3 pages converge. A template + one helper is lower-ceremony and still yields convergence.
- **Alternative rejected**: a generic `makeAdminCrud` codegen — deferred until the pattern is proven on more pages.

The one helper worth extracting:
```tsx
renderAdminGridFormError(
  render, activeItem, page,
  { formValues, fieldErrors, formError, grid },   // grid = {offset, sort, order, filter, pageSize}
) → Response                                        // renderAdminPage(..., { status: 200 })
```
It closes over the `parseSafe` → `issuesToFieldErrors` → 200-fragment re-render shape currently duplicated in every controller, and centralizes the "errors must be a 200, not 400" rule.

### D2. Toggle becomes a server form with Post/Redirect/Get
The row toggle button becomes a server-rendered form; the controller action becomes PRG.

Row toggle form (no `_method` override — the route is already `POST`):
```tsx
<RestfulForm
  method="POST"
  action={routes.admin.users.toggleDisabled.href({ id: row.id! })}
  data-rmx-target={frames.adminContent}
  data-toggle-form={row.id}          // key the context menu can find it
>
  <GridStateHiddenInputs state={{ offset: String(offset), sort: sortColumn, order: sortDirection, filter: filter ?? '' }} />
  <button type="submit" mix={[iconActionStyle]}>…shield/check icon…</button>
</RestfulForm>
```

Controller PRG:
```ts
async toggleDisabled(context) {
  let id = parseId(context.params.id)
  let user = id ? await context.db.findOne(users, { where: { id } }) : null
  if (!user) {
    context.session.flash('error', 'Benutzer nicht gefunden.')
    return redirect(gridListUrl(context.formData))     // PRG back to the grid
  }
  await context.db.exec(`UPDATE users SET disabled_at = $1, token_version = token_version + 1 WHERE id = $2`, [user.disabled_at ? null : Date.now(), id])
  return redirect(gridListUrl(context.formData))        // success → PRG, grid-state preserved
}
```

- **Why PRG over JSON + `frame.reload()`**: satisfies the contract (no client mutation, no `frame.reload()`), keeps the grid URL reproducible, and aligns error handling with the soft-fork pattern.
- **Why redirect on error too** (rather than a 200 re-render with `fieldErrors`): the toggle has no fields, so there is nothing to annotate inline; a redirect + flash is the coarsest correct surface (D4).

### D3. Context-menu actions submit the existing server form, never `fetch`
The `AdminUsersContextMenu` clientEntry stops issuing `fetch(POST toggle-disabled, JSON)` and reading `meta[name=csrf-token]`. Its activate/deactivate item finds the row's toggle form (via `data-toggle-form`) and calls `form.requestSubmit()` — the same mechanism `handleDeleteAction` already uses for the delete form. CSRF comes from the form's hidden `_csrf`, so the manual token read is removed.

- **Why**: makes `clientEntry` an input affordance only (spec requirement #3); eliminates the client-mutating path and the `frame.reload()`.
- **Alternative rejected**: keep the JSON endpoint for the menu only — rejected because it leaves two divergent mutation paths and violates the contract.

### D4. Render flash in the admin sidebar shell so PRG messages are visible
Add a flash banner to `createSidebarLayout`'s `LayoutComponent` (top of the content pane) that reads `session.get('error'|'success')`, mirroring `app/ui/layout.tsx`. This makes PRG flash messages appear in frame fragments (the only rendering path for `data-rmx-target` navigations).

- **Why it's needed**: without it, `session.flash` set by an admin redirect is consumed on the next frame fetch but never displayed (see Context).
- **Alternative rejected**: re-render the grid fragment at 200 with an inline error banner instead of flash — simpler in isolation but inconsistent with the flash convention the other frames rely on, and it duplicates error surfacing per page.

### D5. Grid-state round-trip is mandatory
Every mutation carries hidden `_offset/_sort/_order/_filter` (`GridStateHiddenInputs`); every sort/paginate/filter/link uses the centralized builders in `mixins/admin-urls.ts`. After any PRG or fragment re-render, the grid SHALL be at the same offset/sort/filter, with the edited row in view after create/edit.

## Risks / Trade-offs

- **[Flash invisible in frame fragments]** → Mitigated by D4 (flash banner in the admin shell). Without D4, D2's error surface silently drops the message.
- **[Menu action needs the per-row form in the DOM]** → The toggle form is rendered for every row; if a view does not render it (e.g. a future filtered state), the menu action no-ops. Mitigation: `form?.requestSubmit()` guard and keep the form rendered on every row.
- **[Removing the JSON toggle endpoint changes a contract]** → Admin-only, so blast radius is small, but `app/actions/admin/admin-users.test.ts` must move from JSON assertions to a PRG round-trip. Low risk.
- **[PRG loses per-field error specificity for toggle errors]** → Acceptable: the toggle has no form fields; flash covers the edge cases (bad id, protected record).
- **[Adoption drift back toward client features]** → Contract enforced by spec; recommend a review convention that no admin page introduces a bare `fetch` mutation. Optionally a `ts`/lint gate later.

## Migration Plan

1. **Phase 1 — convert `/admin/users`**: toggle button → `RestfulForm` POST; controller `toggleDisabled` → PRG (+ `session.flash` on error); remove the JSON fetch + `meta[csrf-token]` read from `AdminUsersContextMenu` (menu submits `data-toggle-form`); add the flash banner to `createSidebarLayout`'s `LayoutComponent`; update `admin-users.test.ts`.
2. **Phase 2 — extract the shared helper**: `renderAdminGridFormError` from the `users` controller's `renderUsersFormError`; refactor the other admin CRUD controllers onto it (lists, offerings, appointments, resources).
3. **Phase 3 — adoption**: use the base template for the next new admin CRUD page; verify it converges with the reference (same transport, no client mutation).

**Rollback**: Phase 1 is isolated — revert the toggle to the JSON endpoint and the menu to `fetch`, and remove the shell flash banner, with no effect on other pages. Phases 2–3 are additive and revertible per page.

## Open Questions

- Whether `/verwaltung` pages also adopt the base (they render through a separate `verwaltung-layout.tsx`); defer — the contract is transport-level, so reuse should be possible, but layout integration is a separate follow-up.
- Whether the flash banner belongs in the shared `createSidebarLayout` shell or in a `renderAdminPage` wrapper (D4 chooses the shell so every admin page gets it consistently); re-open if non-admin frame layouts need it too.
