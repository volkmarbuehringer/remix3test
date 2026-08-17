## 1. Client-Entry Preloads

- [x] 1.1 Update `app/middleware/render.tsx` `resolveClientEntry` to run `assetServer.getHref(entryId)` and `assetServer.getPreloads(entryId)` in `Promise.all` and return `preloads` alongside `href`/`exportName`
- [x] 1.2 Add/update a test asserting `resolveClientEntry` output includes preload hrefs for a client entry

## 2. Redirect Handling on Frame Reload

- [x] 2.1 Add the `response.redirected && options?.target` branch to `resolveFrameResponse` in `app/assets/entry.tsx`, navigating the top frame via `window.location.assign(response.url)` (extracted into `app/assets/frame-response.browser.tsx`)
- [x] 2.2 Add a browser test covering a redirecting frame reload (top-frame navigation, no document UI injected into the subframe)

## 3. Subframe Auth Distinction

- [x] 3.1 Update `requireAuth` in `app/middleware/auth.ts` to treat a request as a subframe request only when both `X-Remix-Frame: true` and `X-Remix-Target` are present
- [x] 3.2 Add auth middleware tests: subframe header combination returns 401 fragment; `X-Remix-Frame` without `X-Remix-Target` redirects to login
- [x] 3.3 Run existing `app/middleware/auth.test.ts` and controller tests to confirm no 401/redirect regressions

## 4. GET Filter History

- [x] 4.1 Add `rmx-history="replace"` to the GET filter form in `app/actions/client/grid-page.tsx`
- [x] 4.2 Add `rmx-history="replace"` to the GET filter form in `app/ui/admin-lists-page.tsx`
- [x] 4.3 Update/extend controller tests asserting the filter form carries `rmx-history="replace"`

## 5. Verification

- [x] 5.1 Run `npm test` (or the targeted test files) and `npm run typecheck`
- [x] 5.2 Run `npm run lint` and `npm run format`
- [x] 5.3 Smoke-test a redirecting frame reload and a GET filter change via `npm run hmr`