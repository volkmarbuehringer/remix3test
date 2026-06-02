## 1. Route Relocation

- [x] 1.1 Move `nutzer` route from `adminRoutes.admin.nutzer` to a top-level entry in the main `routes` definition in `app/routes.ts`, keeping the same route structure (index, create, update, destroy, resetPassword, toggleLock, toggleActive)
- [x] 1.2 Update `app/router.ts` to map the nutzer controller from the new top-level route instead of `adminRoutes.admin.nutzer`
- [ ] 1.3 Run `npm run typecheck` to verify route types resolve correctly

## 2. Navbar & Sidebar Navigation

- [ ] 2.1 Add `{ label: 'Nutzer', href: '/nutzer', adminOnly: true }` to `NAV_SECTIONS` in `app/ui/nav.ts`
- [ ] 2.2 Remove `'nutzer'` from `AdminNavItem` type union in `app/ui/admin-layout.tsx`
- [ ] 2.3 Remove `{ id: 'nutzer', label: 'Nutzer', route: routes.admin.nutzer.index }` from `NAV_GROUPS` in `app/ui/admin-layout.tsx`
- [ ] 2.4 Remove the `'nutzer'` case from `navIcon()` switch in `app/ui/admin-layout.tsx`

## 3. Controller — Layout & Rendering

- [ ] 3.1 Replace `renderAdminPage` import with `Layout` import from `app/ui/layout.tsx` in `app/actions/admin-nutzer-controller.tsx`
- [ ] 3.2 Change the `index` handler to render via `context.render(<Layout title="Nutzer"><NutzerPage ... /></Layout>)` instead of `renderAdminPage(context.render, 'nutzer', ...)`

## 4. Controller — Form Validation Upgrade

- [ ] 4.1 Import `minLength` from `remix/data-schema/checks`, `email` from `remix/data-schema/checks`, `issuesToFieldErrors` and `readFormFieldValues` from `app/utils/schema-utils.ts`
- [ ] 4.2 Add `minLength(8)` pipe to `name` field and `email()` pipe to `email` field in `nutzerSaveSchema`
- [ ] 4.3 Define `NUTZER_FORM_KEYS` constant matching schema field names
- [ ] 4.4 Replace manual validation (`if (parsed.name.length < 8)...`) in `update` handler with `s.parseSafe(nutzerSaveSchema, formData)` + `issuesToFieldErrors` pattern
- [ ] 4.5 On parseSafe failure in `update`: `context.render(<Layout title="Nutzer"><NutzerPage ... formValues={rawValues} fieldErrors={fieldErrors} editing={context.params.id} ... /></Layout>, { status: 400 })` instead of `buildNutzerErrorRedirect`
- [ ] 4.6 Replace manual validation in `create` handler with `parseSafe` + `context.render()` pattern (same as update)
- [ ] 4.7 Remove `buildNutzerErrorRedirect` helper function (no longer needed)
- [ ] 4.8 Rebuild the edit row from `rawValues` on validation failure so the edit panel shows the submitted data

## 5. Page Component — URL & Props Updates

- [ ] 5.1 Change `ADMIN_BASE` constant from `'/admin/nutzer'` to `'/nutzer'` in `app/ui/admin-nutzer-page.tsx`
- [ ] 5.2 Remove `rmx-target={frames.adminContent}` from all filter, sort, pagination, and action links in `app/ui/admin-nutzer-page.tsx`
- [ ] 5.3 Remove `frames` import from `app/ui/admin-nutzer-page.tsx` (no longer needed)
- [ ] 5.4 Add `formValues?: Record<string, string>` and `fieldErrors?: Record<string, string>` to `AdminNutzerPageProps`
- [ ] 5.5 Pass `formValues` and `fieldErrors` through to `AdminNutzerEditPage` and `AdminNutzerCreatePage` when editing/creating

## 6. Edit Form Component — Value Preservation & Error Display

- [ ] 6.1 Add `formValues?: Record<string, string>` and `fieldErrors?: Record<string, string>` to `AdminNutzerEditPageProps`
- [ ] 6.2 Change text input `value` attributes to `value={formValues?.fieldName ?? row.fieldValue}` (e.g. `value={formValues?.name ?? row.n_name ?? ''}`)
- [ ] 6.3 Change checkbox `checked` to `checked={formValues?.fieldName !== undefined ? formValues.fieldName === 'on' : row.fieldValue}`
- [ ] 6.4 Add error styling mixins (`inputErrorStyle`, `fieldErrorStyle`) matching `ClientEditPage` pattern
- [ ] 6.5 Add per-field error display `<div mix={fieldErrorStyle}>{fieldErrors.fieldName}</div>` below each input
- [ ] 6.6 Update form `action` from `/admin/nutzer/${row.n_id}` to `/nutzer/${row.n_id}`
- [ ] 6.7 Update cancel URL from `/admin/nutzer` to `/nutzer`

## 7. Create Form Component — Value Preservation & Error Display

- [ ] 7.1 Add `formValues?: Record<string, string>` and `fieldErrors?: Record<string, string>` to `AdminNutzerCreatePageProps`
- [ ] 7.2 Change input `value` attributes to `value={formValues?.fieldName ?? ''}`
- [ ] 7.3 Change checkbox `checked` to `checked={formValues?.fieldName === 'on'}`
- [ ] 7.4 Add error styling mixins and per-field error display (same pattern as edit form)
- [ ] 7.5 Update form `action` from `/admin/nutzer` to `/nutzer`
- [ ] 7.6 Update cancel URL from `/admin/nutzer` to `/nutzer`

## 8. Context Menu Asset — URL Updates

- [ ] 8.1 Update all `/admin/nutzer` URLs to `/nutzer` in `app/assets/nutzer-table-interactive.tsx`
- [ ] 8.2 Update frame reload logic to full page reload (`window.location.reload()`) since the page is no longer inside a frame

## 9. Verification

- [ ] 9.1 Run `npm run typecheck` and fix any type errors
- [ ] 9.2 Run `npm run lint` and fix any lint errors
- [ ] 9.3 Run `npm test` and ensure existing tests pass
- [ ] 9.4 Review controller tests in `app/actions/admin-nutzer-controller.test.tsx` and update if needed for new paths/validation behavior
