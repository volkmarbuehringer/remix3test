## 1. Schema and Controller

- [x] 1.1 Add `minLength(8)` to the `name` field in `clientSaveSchema` in `app/actions/client/controller.tsx`
- [x] 1.2 Replace `s.parse` + try/catch with `s.parseSafe` in the `update` action
- [x] 1.3 Replace `s.parse` + try/catch with `s.parseSafe` in the `create` action
- [x] 1.4 On `parseSafe` failure, extract raw string values from `FormData` for all form fields
- [x] 1.5 Build `fieldErrors` record from `parseSafe` issues (first issue per field path)
- [x] 1.6 On `update` validation failure: re-render with `context.render(<Layout><ClientPage formValues={...} fieldErrors={...} editRow={...} ... /></Layout>, { status: 400 })`
- [x] 1.7 On `create` validation failure: re-render with `context.render(<Layout><ClientPage formValues={...} fieldErrors={...} creating ... /></Layout>, { status: 400 })`
- [x] 1.8 Preserve grid state on re-render by passing `_offset`, `_sort`, `_order`, `_filter` through form values

## 2. Page Components

- [x] 2.1 Add `formValues` and `fieldErrors` optional props to `ClientPage`, forwarded to `ClientEditPage` and `ClientCreatePage`
- [x] 2.2 Add `formValues` and `fieldErrors` optional props to `ClientEditPage` component
- [x] 2.3 Set `value={formValues?.name}` on the name input when `formValues` is provided
- [x] 2.4 Set `value={formValues?.email}` on the email input when `formValues` is provided
- [x] 2.5 Render per-field error text below each input when `fieldErrors[name]` exists
- [x] 2.6 Add error border styling to inputs when the corresponding `fieldErrors` entry exists
- [x] 2.7 Add `formValues` and `fieldErrors` optional props to `ClientCreatePage` with same pattern as edit page

## 3. Navigation

- [x] 3.1 Add `{ label: 'Client Lab', href: '/client' }` to `NAV_SECTIONS` in `app/ui/nav.ts`

## 4. Test Updates

- [x] 4.1 Update `app/actions/client/controller.test.ts` for new parseSafe + re-render behavior
- [x] 4.2 Update `app/actions/client/edit-page.test.ts` for new props
- [x] 4.3 Update `app/actions/client/grid-page.test.ts` if affected

## 5. Verification

- [x] 5.1 Run `npm run typecheck` and fix any type errors
- [x] 5.2 Run `npm test` in newapp and ensure all tests pass
- [x] 5.3 Manual: GET `/client` shows grid with "Client Lab" in navbar
- [x] 5.4 Manual: POST create with name "Bob" re-renders with error and preserved values
- [x] 5.5 Manual: PUT update with name "Al" re-renders with error and preserved values
- [x] 5.6 Manual: Valid submission (name 8+ chars) succeeds and redirects normally
