<!-- Context: project-intelligence/newapp/guides | Priority: high | Version: 1.0 | Updated: 2026-05-21 -->

# ReturnTo Security Pattern

## Overview

The `getSafeReturnTo()` utility prevents open-redirect attacks by validating that a `returnTo` query parameter only resolves to same-origin absolute paths. It hardens auth redirect flows against malicious redirect destinations.

## Source

`app/utils/redirect.ts`

## How It Works

```ts
export function getSafeReturnTo(returnTo: string | null): string | undefined {
  if (returnTo == null || returnTo === '') return undefined  // reject null/empty
  if (!returnTo.startsWith('/')) return undefined              // reject non-absolute

  let baseURL = 'https://remix.local'
  let url: URL
  try {
    url = new URL(returnTo, baseURL)                           // parse relative to fake origin
  } catch {
    return undefined                                           // reject unparseable
  }
  if (url.origin !== baseURL) return undefined                  // reject cross-origin resolution
  return url.pathname + url.search + url.hash                   // return sanitized path
}
```

### Key defense: URL parsing

The function uses `new URL(returnTo, 'https://remix.local')` to resolve the path and then compares the origin. This catches edge cases that simple string checks miss:

| Input | `startsWith('/')` | URL parsing | Result |
|-------|-------------------|-------------|--------|
| `/dashboard` | ✅ | origin matches | ✅ `/dashboard` |
| `//evil.com` | ✅ (yes, starts with `/`) | origin is `https://evil.com` | ❌ rejected |
| `\\evil.com` | ❌ | n/a | ❌ rejected |
| `http://evil.com` | ❌ | n/a | ❌ rejected |
| `javascript:alert(1)` | ❌ | n/a | ❌ rejected |
| `dashboard` (relative) | ❌ | n/a | ❌ rejected |

The URL parsing catches protocol-relative URLs (`//evil.com`) where `startsWith('/')` alone would pass but the resolved URL has a different origin.

## Call Sites

| File | How it uses `getSafeReturnTo` |
|------|------------------------------|
| `app/middleware/auth.ts` | `requireAuth()` captures current path, creates redirect with `returnTo` param |
| `app/middleware/admin.ts` | `requireAdmin()` passes `returnTo` from URL params |
| `app/actions/auth-login-controller.tsx` | After successful login, redirects user back to stored `returnTo` or home |

## Testing

Tests in `app/utils/redirect.test.ts` cover:

- **Happy path**: simple, nested, query-parameter paths all return untouched
- **Null/empty**: returns `undefined`
- **Open redirects**: full URLs (`http://`, `https://`), protocol-relative (`//`), `javascript:`, backslash (`\\`), relative without leading slash — all return `undefined`

9 test cases exercise all paths through the function.

## Why URL parsing over string checks

The original implementation used string checks only:
```ts
if (!returnTo.startsWith('/') || returnTo.startsWith('//')) return undefined
```

This was upgraded to URL parsing because:
- Browsers normalize backslashes in `Location` headers (e.g., `\evil.com` → `evil.com/`)
- Protocol-relative URLs like `//evil.com` pass the `startsWith('/')` check
- URL parsing catches all edge cases with a single origin comparison

## Reference

- [Auth Redirect Flow](./auth-redirect-flow.md) — how `returnTo` flows through the auth system
- [Auth Architecture](../concepts/auth-architecture.md) — overall auth middleware design
