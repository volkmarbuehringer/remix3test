## 1. Infrastructure — Compression Middleware

- [x] 1.1 Add `compression()` import from `remix/compression-middleware` to `app/router.ts`
- [x] 1.2 Insert `compression()` middleware in the middleware stack after `logger()` and before `formData()`
- [x] 1.3 Verify `compression()` does not break existing routes by starting the server and loading the home page

## 2. Infrastructure — Method Override Middleware

- [x] 2.1 Add `methodOverride()` import from `remix/method-override-middleware` to `app/router.ts`
- [x] 2.2 Insert `methodOverride()` middleware after `formData()` and before `session()` in the middleware stack
- [x] 2.3 Verify method override is working by confirming a POST with `_method=PUT` reaches a `put()` route handler

## 3. Form — RestfulForm Component

- [x] 3.1 Create `app/ui/restful-form.tsx` that renders a `<form method="POST">` with hidden `_method` input for PUT, DELETE, PATCH methods
- [x] 3.2 Handle GET and POST methods as plain forms (no hidden override field)
- [x] 3.3 Pass through all additional props (action, encType, className, children) to the underlying `<form>` element
- [x] 3.4 Verify RestfulForm renders correct markup by checking output in the showcase

## 4. Form — Validation Schema Upgrades

- [x] 4.1 Upgrade login schema in `app/actions/auth-login-controller.tsx`: add `email()` pipe to email field, add `minLength(1)` to password field
- [x] 4.2 Add try/catch around login `s.parse()` call, rendering login page with error message on parse failure
- [x] 4.3 Upgrade register schema in `app/actions/auth-register-controller.tsx`: add `email()` pipe to email field, change password to `s.string().pipe(minLength(8))`, change name to `s.string().pipe(minLength(1))`
- [x] 4.4 Add try/catch around register `s.parse()` call, rendering register page with error message on parse failure
- [x] 4.5 Add validation schema to client save action in `app/actions/client/controller.tsx` using `defaulted()` for null-safe field access
- [x] 4.6 Verify invalid form data shows appropriate error messages in the UI

## 5. Infrastructure — Asset Entry Middleware

- [x] 5.1 Create `app/middleware/asset-entry.ts` with `loadAssetEntry()` factory function that resolves `scriptSrc` and `scriptPreloads` from the asset server
- [x] 5.2 Add the asset entry middleware to the router middleware stack after `loadAuth()` and before `render()`
- [x] 5.3 Update `app/ui/document.tsx` to read `scriptSrc` from context when the middleware is present, falling back to the current hardcoded URL
- [x] 5.4 Verify the document still renders correctly with both middleware present and absent

## 6. Form + Routes — RESTful Client CRUD

- [x] 6.1 Update `app/routes.ts`: change client save from `post('/save')` to `put('/:id')`; change client destroy from `post('/destroy/:rowId')` to `del('/:id')`
- [x] 6.2 Update `app/actions/client/controller.tsx` to use RESTful route names: rename `save` action to `update`, use `context.params.id` instead of form rowId
- [x] 6.3 Update client grid page and edit page to use new RESTful route paths and `RestfulForm`
- [x] 6.4 Update `app/assets/client-del-button.tsx` to send `_method=DELETE` with new route URL
- [x] 6.5 Verify client CRUD works end-to-end: create, read, update, delete with proper HTTP methods

## 7. Infrastructure — Router Factory

- [x] 7.1 Define and export `createNewappRouter(options?)` factory function in `app/router.ts`, accepting optional `sessionCookie` and `sessionStorage` parameters
- [x] 7.2 Move the middleware array construction and all `router.map()` calls inside the factory function
- [x] 7.3 Update `server.ts` to call `createNewappRouter()` and use the returned instance
- [x] 7.4 Verify the server starts and all routes work identically via the factory
- [x] 7.5 Run the full test suite to confirm no regressions from the refactoring
