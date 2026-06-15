## 1. Grid page: inline delete form

- [x] 1.1 Remove `DelButton` import from `grid-page.tsx`
- [x] 1.2 Replace `DelButton` call in the actions cell with a server-rendered `<form method="POST" action="/client/${row.id}" rmx-target="client-grid" data-confirm="Delete this row?">` containing `GridStateHiddenInputs` and a submit `<Button type="submit" tone="danger">Del</Button>`

## 2. Remove client-del-button.tsx

- [x] 2.1 Delete `app/assets/client-del-button.tsx`

## 3. Controller: redirect to grid fragment

- [x] 3.1 In the `destroy` action in `app/actions/client/controller.tsx`, change the redirect target from `/client` to `/client/grid` so the Frame navigates to the grid fragment URL
