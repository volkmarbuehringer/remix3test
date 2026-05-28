## 1. Routes — Add POST create route

- [x] 1.1 Add `create: post('/')` to the client route tree in `app/routes.ts`

## 2. Controller — Add create action and ?creating=true support

- [x] 2.1 Add `create` action in `app/actions/client/controller.tsx` that reads form data, validates with schema, inserts a row, and redirects to `/client?editing=<new-id>`
- [x] 2.2 Update `index` action to detect `?creating=true` and pass `creating: true` to `ClientPage`

## 3. Component — Create ClientCreatePage

- [x] 3.1 Create `app/actions/client/create-page.tsx` with a blank form using `<RestfulForm method="POST" action="/client">` and fields for name, email, role (default "Viewer"), status (default "Active"), registered (default today's date)

## 4. Page — Update ClientPage with Add New button

- [x] 4.1 Update `app/actions/client/page.tsx` to accept `creating: boolean` prop
- [x] 4.2 Render `ClientCreatePage` in the edit column when `creating=true`
- [x] 4.3 Add "Add New" button above the grid, hidden during edit or create
- [x] 4.4 Verify all three states work: default (single-column with button) / editing (two-column, no button) / creating (two-column, no button)

## 5. Tests — Add create route tests

- [x] 5.1 Add test cases to `app/actions/client/controller.test.ts` for POST /client create and GET /client?creating=true
