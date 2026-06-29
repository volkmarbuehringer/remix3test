## 1. Shared lib: `app/lib/lists-api.ts`

- [x] 1.1 Create `app/lib/lists-api.ts` with `getAllLists(db, { offset, limit, filter })` — paginated + filterable query mirroring the admin controller's GIN-backed ILIKE search
- [x] 1.2 Add `getListById(db, id)` — wraps `db.findOne(lists, { where: { id } })` with type-safe return
- [x] 1.3 Add `createList(db, { description, items })` — validates inputs, calls `db.create(lists, ...)`, returns the created row
- [x] 1.4 Add `updateList(db, id, { description, items })` — checks existence, calls `db.updateMany(lists, ...)`, returns updated id
- [x] 1.5 Add `deleteList(db, id)` — checks existence, calls `db.delete(lists, { id })`, returns success indicator

## 2. Refactor existing controller

- [x] 2.1 Update `app/actions/lists/controller.tsx` `data` action to call `getListById` from the lib
- [x] 2.2 Update `save` action to call `createList` from the lib
- [x] 2.3 Update `update` action to call `updateList` from the lib
- [x] 2.4 Verify existing tests in `app/actions/lists/controller.test.ts` still pass with `npm test`

## 3. New API controller: `app/actions/api/lists/controller.tsx`

- [x] 3.1 Create `app/actions/api/lists/controller.tsx` with `authenticateWebhook()` inline auth
- [x] 3.2 Implement `index` action calling `getAllLists` from lib with pagination/filtering from query params
- [x] 3.3 Implement `show` action calling `getListById` from lib
- [x] 3.4 Implement `create` action calling `createList` from lib with JSON body parsing and validation
- [x] 3.5 Implement `update` action calling `updateList` from lib
- [x] 3.6 Implement `destroy` action calling `deleteList` from lib

## 4. Routes, CSRF exemption, and wiring

- [x] 4.1 Add API list route definitions to `app/routes.ts`: `export const apiLists = route('api/lists', { index: get('/'), show: get('/:id'), create: post('/'), update: put('/:id'), destroy: del('/:id') })`
- [x] 4.2 Update `app/middleware/skip-csrf.ts` to exempt `/api/` prefix paths
- [x] 4.3 Wire the new controller in `app/router.ts`: `router.map(routes.apiLists, apiListsController)`

## 5. Tests

- [x] 5.1 Add tests for shared lib functions in `app/lib/lists-api.test.ts`
- [x] 5.2 Add integration tests for the new API controller in `app/actions/api/lists/controller.test.ts` covering all CRUD endpoints, auth failure, validation errors
- [x] 5.3 Run full test suite (`npm test`) and fix any regressions
