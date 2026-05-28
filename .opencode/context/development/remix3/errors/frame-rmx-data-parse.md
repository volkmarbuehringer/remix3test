<!-- Context: development/remix3/errors | Priority: high | Version: 1.0 | Updated: 2026-04-07 -->

# Error: rmx-data Script Parsing Failure

**Symptom**: Browser console shows `[createFrame] Failed to parse rmx-data script` error, and client components fail to hydrate.

## Root Cause

When a frame request fails (404, 500, etc.), the previous implementation returned HTML error content:

```typescript
// ❌ BROKEN - Returns HTML that corrupts parent page JSON
if (!res.ok) {
  return `<pre>Frame error: ${res.status} ${res.statusText}</pre>`
}
```

This HTML gets embedded in the parent page's `<script id="rmx-data" type="application/json">` tag, corrupting the JSON structure.

**Page Structure**:
```html
<script id="rmx-data" type="application/json">
  {"pathname":"/admin/books","fragments":{...}}
  <pre>Frame error: 404 Not Found</pre>  ← JSON corruption!
</script>
```

## The Fix

Return an empty string instead of HTML on frame errors:

```typescript
// ✅ FIXED - Empty string is valid, allows fallback to show
if (!res.ok) {
  return ''
}
```

**Implementation**: `bookstore/app/utils/render.tsx` line 69-72

## Why This Works

| Aspect | Explanation |
|--------|-------------|
| Valid HTML | Empty string is valid (renders nothing) |
| Fallback | `<Frame fallback={...}>` displays instead |
| JSON integrity | Parent page's rmx-data stays valid |
| Accessibility | Empty frame ignored by screen readers |

## Related Errors

- `client-entry-issues.md` - Hydration failures from corrupted data
- `admin-routing-errors.md` - Frame routes returning 404s

## Codebase References

**Bug Location**: `bookstore/app/utils/render.tsx` (line 69-72)
**Fix Applied**: Return `''` instead of HTML on `!res.ok`

**Related**:
- `guides/render-utilities.md` - Frame SSR with proper error handling
- `guides/client-side-components.md` - Frame usage patterns