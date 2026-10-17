# `returnTo` Open Redirect: Reject Paths That Normalize to `//host`

**Source:** `remix3-return-to-open-redirect`

**Extracted:** 2026-09-17
**Context:** `getSafeReturnTo()` only rejected different-origin URLs, so `//remix.local//evil.com` passed and produced `Location: //evil.com`.

## Problem

A `returnTo` sanitizer that parses the value against a base URL and checks only `url.origin === base` misses a same-origin input whose **pathname** still starts with `//`:

```ts
new URL('//remix.local//evil.com', 'https://remix.local')
// origin:   https://remix.local  ← passes the origin check
// pathname: //evil.com           ← returned and used in Location
```

A browser treats `Location: //evil.com` as a protocol-relative URL and navigates to `evil.com`, so the check is an open redirect. Parsing alone does not save you — the returned path must be checked too.

Upstream fixed the same class in `@remix-run/auth`'s `sanitizeReturnTo` (PR #11857):

```diff
-  if (url.origin !== returnToBaseURL) {
+  if (url.origin !== returnToBaseURL || url.pathname.startsWith('//')) {
```

## Solution

Add the pathname guard to any `returnTo`/redirect sanitizer:

```ts
if (!returnTo.startsWith('/')) return undefined
let url = new URL(returnTo, baseURL)
if (url.origin !== baseURL || url.pathname.startsWith('//')) return undefined
return url.pathname + url.search + url.hash
```

The app's `app/utils/redirect.ts` (`getSafeReturnTo`) now does this, with a regression test in `app/utils/redirect.test.ts` (`//remix.local//evil.com` → `undefined`).

The input gate still matters: `startsWith('/')` rejects absolute URLs, and URL parsing already normalizes backslashes (`/\evil.com` resolves off-origin and is rejected by the origin check).

## When to Use

- Reviewing or writing a `returnTo` / `next` / `redirect` query-param sanitizer
- A sanitizer checks `origin` (or `host`) but returns `pathname` / `pathname + search`
- Auditing open-redirect hardening against the `//host` normalization bypass
