## Context

The app tracks `remix` `preview/main`. Between Aug 10–15 2026 the upstream demos and template adopted four conventions the app has not: client-entry preloads in `resolveClientEntry` (`#11681`), redirect-bail during frame reloads (`#11667`), the subframe auth distinction (`X-Remix-Frame` + `X-Remix-Target`, `#11667`), and `rmx-history="replace"` for GET filter forms (`#11670`). See proposal.md — Why. The app already has form-driven frame navigation (`getRequestBody` in `app/assets/entry.tsx`) and HMR, so those parts are in sync.

## Goals / Non-Goals

**Goals:**
- Close the four upstream-convention gaps with minimal diffs that mirror the demo code exactly.
- Keep frame reload, auth, and filter behavior consistent with `preview/main` so future upgrades don't surprise.

**Non-Goals:**
- No migration to colocated `public/` directories (`#11616`) — the `.browser.*` convention stays for now.
- No adoption of SQL-file seeding (`#11640`) — `app/data/seed.ts` remains.
- No TS7/dependency changes; already in sync.

## Decisions

**D1 — Preloads in `resolveClientEntry` (`app/middleware/render.tsx`).** Mirror `demos/bookstore/app/middleware/render.tsx` exactly: run `getHref` and `getPreloads` in `Promise.all` and return `preloads` alongside `href`/`exportName`. `getPreloads` already exists on `assetServer` (used by `app/middleware/asset-entry.ts`), so no new API surface.
- Alternative considered: adding preloads only at the top-level entry via `asset-entry.ts` (already done) — but that misses per-`clientEntry` graphs, which is the point of `#11681`.

**D2 — Redirect bail in `resolveFrameResponse` (`app/assets/entry.tsx`).** Add the demo's branch after the fetch, before the `!response.ok` error card:
```ts
if (response.redirected && options?.target) {
  window.location.assign(response.url)
  return new Promise<never>(() => {})
}
```
The server-side `followFrameRedirects` in `render.tsx` stays as-is — it covers SSR frame resolution; this covers the client-side reload path.

**D3 — Subframe auth distinction (`app/middleware/auth.ts`).** Change the `isFrameRequest` boolean to require both headers, exactly like `demos/frame-navigation/app/middleware/auth.ts`:
```ts
let isSubFrameRequest =
  context.request.headers.get('X-Remix-Frame') === 'true' &&
  context.request.headers.get('X-Remix-Target') != null
```
Frame-navigation GET links (targeted) keep returning 401 fragments; top-frame reloads of frame-destined URLs redirect to login.

**D4 — `rmx-history="replace"` on GET filter forms.** Add the attribute to the GET filter forms in `app/actions/client/grid-page.tsx:364` and `app/ui/admin-lists-page.tsx:260`. Pure additive; no JS changes.

## Risks / Trade-offs

- **Redirect bail changes UX for redirecting frame reloads** — a frame reload that redirects now triggers a full page load instead of swapping subframe content. This matches upstream intent (`#11667`) and is the correct behavior when the destination is not subframe-renderable. → Validate with an e2e test on a route that redirects (e.g. settings/auth).
- **401→redirect change could affect SSR-then-frame flows** — the auth middleware's `requireAuth` is also hit on initial document loads; the `X-Remix-Target` gate only alters behavior for header combinations that are already frame-specific, so non-frame requests are unaffected. → Existing `auth.test.ts` covers the redirect path; add a subframe-header case.
- **`rmx-history` requires the new `preview/main` runtime** — already pinned, so no action; verify the attribute is honored by the current `dom-navigation` polyfill version in tests.

## Migration Plan

Single deploy. No data migration. Rollback = revert the four-file diff.

## Open Questions

None that affect specs, approach, or task breakdown.