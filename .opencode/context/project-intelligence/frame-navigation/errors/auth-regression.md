<!-- Context: frame-navigation/errors/auth-regression | Priority: high | Version: 1.0 | Updated: 2026-03-25 -->

# Authentication Regression Bug

## Status: ✅ FIXED

## Problem (Original)

The `hasAuthCookie` function was accepting any non-empty string as valid:

```typescript
// Insecure (before)
if (typeof cookie === 'string') {
  return cookie.length > 0 // Accepts ANY non-empty string
}
```

## Fix Applied

```typescript
// Now secure
let userId = parseInt(cookie, 10)
return !isNaN(userId) && userId > 0
```

## Files Affected

- `app/auth/session.ts`
