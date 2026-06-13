## 1. Middleware Layer

- [x] 1.1 Migrate `app/middleware/security-headers.ts` to use `SuperHeaders` with typed accessors (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, CSP, Permissions-Policy, HSTS)
- [x] 1.2 Migrate `app/middleware/auth.ts` — typed `ContentType` for 401 response, typed `location` for redirect
- [x] 1.3 Migrate `app/middleware/admin.ts` — typed `location` for redirect

## 2. Asset / Entry Layer

- [x] 2.1 Migrate `app/assets/entry.tsx` — typed `Accept` via `headers.accept = new Accept(...)`

## 3. File Download Controllers

- [x] 3.1 Migrate `app/actions/uploads/controller.tsx` — `ContentType`, `ContentDisposition` classes
- [x] 3.2 Migrate `app/actions/verwaltung/pdf/controller.tsx` — typed download headers
- [x] 3.3 Migrate `app/actions/verwaltung/users-pdf/controller.tsx` — typed download headers
- [x] 3.4 Migrate `app/actions/verwaltung/users-export/controller.tsx` — typed download headers

## 4. Redirect Standardization

- [x] 4.1 Migrate `app/actions/admin/users/controller.tsx` redirects to typed `location`
- [x] 4.2 Migrate `app/actions/admin/lists/controller.tsx` redirects to typed `location`
- [x] 4.3 Migrate `app/actions/nutzer/controller.tsx` redirects to typed `location`
- [x] 4.4 Migrate `app/actions/client/controller.tsx` redirects to typed `location`
- [x] 4.5 Migrate remaining ~16 action controllers with raw redirect headers

## 5. Test Assertions

- [x] 5.1 Migrate test files using `response.headers.get('Set-Cookie')` to use `SetCookie.from()`
- [x] 5.2 Migrate test files using raw Cache-Control assertions to `CacheControl.from()`
- [x] 5.3 Migrate remaining raw header assertions in test files (Content-Type, Content-Disposition in PDF tests)

## 6. Verify

- [x] 6.1 Run `npm run typecheck` — no type errors
- [x] 6.2 Run `npm test` — all existing tests pass
- [x] 6.3 Run `npm run lint` — no lint errors
