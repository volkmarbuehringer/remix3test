---
name: remix-middleware-error-centralization
description: 'Tests break when error handling moves from controllers to middleware — expect shifted error sources and formats'
user-invocable: false
origin: auto-extracted
---

# Middleware Error Centralization Test Shift

**Extracted:** 2026-06-26
**Context:** Adding a `jsonBody()` middleware to parse JSON in middleware instead of try/catch in each controller

## Problem

When you centralize error handling (body parsing, validation, auth) from individual controllers into shared middleware, existing tests break in non-obvious ways:

```
Before:           After:
┌──────────┐      ┌──────────────┐
│ Controller│     │  Middleware   │ ← new error source
│ try/catch │     │ parse body    │
│ return 400│     │ return 400    │
└──────────┘      └──────────────┘
                        │
                   ┌──────────┐
                   │ Controller│
                   │ body ready│
                   └──────────┘
```

Common test failures:

1. **Wrong status code** — test sends bad JSON expecting 200 + error body, now gets 400 from middleware
2. **Wrong error format** — middleware returns `{ error: "..." }` but controller returned `{ errors: [...] }`
3. **Wrong error location** — test asserts on controller-specific side effects (logging, DB writes) that no longer happen because middleware short-circuits
4. **Missing header checks** — test validates Content-Type in controller; middleware now handles it, but the handler has no guard and `undefined` body causes runtime errors
5. **Null body storage** — test sends non-JSON Content-Type with JSON body; middleware skips parsing, body is `undefined`, but controller tries to `JSON.stringify(undefined)` which returns `undefined` (the value, not the string), causing DB constraint violations

## Solution

### 1. Guard against undefined body in controllers

When middleware conditionally parses (only on matched Content-Type), controllers must handle the case where no body was parsed:

```ts
// ❌ Before — body was always set by try/catch
let body = await request.json()

// ✅ After — middleware may have skipped
let body = context.get(JsonBody)
if (!body) {
  return new Response('Expected JSON body', { status: 400 })
}
```

### 2. Check test assertions against middleware-level responses

Tests that send invalid payloads now hit middleware, not the controller. Update assertions:

```ts
// ❌ Before — test checked controller-specific response
assert.equal(response.status, 422) // controller-level error

// ✅ After — middleware returns its own status
assert.equal(response.status, 400) // middleware-level error
```

### 3. Keep defense-in-depth for streaming/chunked bodies

`Content-Length` is not present in chunked transfer encoding. Middleware that checks `Content-Length` for size limits can be bypassed. If controllers have existing post-parse size checks, keep them as defense-in-depth:

```ts
// Middleware: checks Content-Length (can be bypassed with chunked)
if (contentLength > maxSize) return 413

// Controller: re-checks serialized size (defense-in-depth)
let serialized = JSON.stringify(body)
if (serialized.length > MAX_SIZE) return 413 // keep this
```

### 4. Update tests that check Content-Type rejection

Tests that send non-JSON Content-Type expecting controller-level rejection must be updated when middleware handles it:

```ts
// ❌ Before — controller checked Content-Type, returned 400
await POST('/webhook', { headers: { 'Content-Type': 'text/plain' } })
assert.equal(response.status, 400)

// ✅ After — middleware skips parse, controller returns 400
// OR middleware rejects earlier with different format
```

## When to Use

- Refactoring controller-level error handling into shared middleware
- Adding a body-parsing middleware to replace per-controller `request.json()`, `request.formData()`, or similar
- Any change that moves error responses from controller scope to middleware scope
- After such a refactor, when existing tests unexpectedly fail despite "no behavior change"
