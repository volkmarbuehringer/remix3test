<!-- Context: project-intelligence/errors/assistant-form-error | Priority: high | Version: 1.0 | Updated: 2026-04-09 -->

# Diagnosis: Assistant Controller Form Error

**Error**: `TypeError: Body is unusable: Body has already been read` at line 23 in assistant/controller.tsx

**Location**: `bookstore/app/controllers/assistant/controller.tsx:23`

---

## The Problem

The assistant controller's action handler fails when calling `get(FormData)`:

```typescript
async action({ get, url }) {
  let formData = get(FormData)  // Line 23 - Throws error
}
```

**Root cause**: The request body stream has already been consumed before the action handler runs.

---

## Code Analysis

### Working Examples (Same Pattern)
These controllers use `get(FormData)` successfully:

```typescript
// api/controller.tsx:51-52 ✓ Works
async weather({ get }) {
  let formData = get(FormData)
}

// checkout/controller.tsx:40-43 ✓ Works  
async action({ get }) {
  let formData = get(FormData)
}

// auth/login/controller.tsx:27-28 ✓ Works
async action(context) {
  let user = await verifyCredentials(passwordProvider, context)
  // auth provider uses context.get(FormData) internally
}
```

### Failing Code
```typescript
// assistant/controller.tsx:21-23 ✗ Fails
async action({ get, url }) {
  let formData = get(FormData)  // Error: Body already read
}
```

---

## Why API Works But Assistant Fails

Both use the same pattern, but the difference is likely in:

1. **Middleware ordering** - If another middleware reads the body before `formData` middleware
2. **Request timing** - Race condition in request handling
3. **Route registration** - Different route types may trigger different middleware chains

Looking at the router.ts configuration:
```typescript
// router.ts:72 - formData middleware is registered globally
middleware.push(formData({ uploadHandler }))
```

The middleware SHOULD cache FormData for all routes. The error suggests the cache is not being hit.

---

## Potential Fixes

### Fix 1: Verify Middleware is Reached
Ensure no middleware before `formData()` reads the request body:

```typescript
// router.ts - Current order (should be correct)
middleware.push(logger())        // OK - doesn't read body
middleware.push(compression())   // OK - doesn't read body  
middleware.push(staticFiles())   // OK - doesn't read body
middleware.push(formData({...})) // Should parse body FIRST
middleware.push(methodOverride()) // May read FormData (OK - after formData)
```

### Fix 2: Debug the Request Flow
Add logging to verify middleware execution:

```typescript
// Temporary debug in router.ts
middleware.push((ctx, next) => {
  console.log('[Middleware] Before formData:', ctx.url.pathname)
  return next()
})
middleware.push(formData({ uploadHandler }))
middleware.push((ctx, next) => {
  console.log('[Middleware] After formData, has FormData?', ctx.has(FormData))
  return next()
})
```

### Fix 3: Alternative - Direct Request Access (Workaround)
If `get(FormData)` consistently fails, use the underlying request:

```typescript
async action({ request }) {
  // Clone request to avoid "already read" error
  let clonedRequest = request.clone()
  let formData = await clonedRequest.formData()
  
  let { message } = s.parse(messageSchema, formData)
  // ... rest of handler
}
```

**Note**: This bypasses the middleware cache and should be avoided if possible.

### Fix 4: Check for Double Route Mapping
Verify the assistant route isn't mapped twice:

```typescript
// router.ts:90
router.map(routes.assistant, assistantController)

// Ensure this appears ONLY ONCE in the file
```

---

## Working Pattern (Recommended)

The checkout controller uses identical patterns successfully:

```typescript
// checkout/controller.tsx
export default {
  middleware: [requireAuth()],  // Has auth middleware
  actions: {
    async action({ get }) {
      let formData = get(FormData)  // Works fine
      let shippingAddress = s.parse(shippingAddressSchema, formData)
      // ...
    },
  },
} satisfies Controller<typeof routes.checkout>
```

Compare with assistant:
```typescript
// assistant/controller.tsx
export default {
  // No middleware - should be simpler
  actions: {
    async action({ get, url }) {
      let formData = get(FormData)  // Fails
      // ...
    },
  },
} satisfies Controller<typeof routes.assistant>
```

**Key difference**: None apparent. Both should work identically.

---

## Investigation Steps

1. **Check if error is consistent** - Does it happen on every request or intermittently?
2. **Verify request headers** - Ensure `Content-Type: application/x-www-form-urlencoded`
3. **Test without schema parsing** - Does `get(FormData)` alone fail, or only after parsing?
4. **Compare request objects** - Log `request.bodyUsed` before calling `get(FormData)`
5. **Check middleware chain** - Add debug logging to verify formData middleware runs

---

## Related Documentation

**Immediate fix resources**:
- `development/remix3/errors/body-unusable.md` - Troubleshooting guide
- `development/remix3/guides/form-data-handling.md` - Correct patterns
- `development/remix3/lookup/form-data-reference.md` - Quick reference

**Pattern examples**:
- `bookstore/app/controllers/checkout/controller.tsx` - Working example
- `bookstore/app/controllers/api/controller.tsx` - API route example
- `bookstore/app/middleware/auth.ts:42` - FormData in middleware

---

## Most Likely Cause

Based on code analysis, the most likely causes are:

1. **Middleware not being invoked** for this specific route (check route mapping)
2. **Request already consumed** by browser or proxy before reaching the app
3. **Framework bug** specific to certain route configurations

**Recommendation**: Start with Fix 3 (request.clone()) as immediate workaround, then investigate root cause with Fix 2 (debug logging).
