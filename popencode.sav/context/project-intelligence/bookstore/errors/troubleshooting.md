<!-- Context: project-intelligence/bookstore/errors | Priority: medium | Version: 1.0 -->

# Troubleshooting Guide

## Unit Tests Hanging

**Symptom**: Tests complete but process doesn't exit.

**Cause**: Database connection pool stays open.

**Fix**: Add cleanup hook:
```typescript
import { closeDatabasePool } from './data/setup.ts'
after(async () => { await closeDatabasePool() })
```

## E2E Tests Fail - Port Error

**Symptom**: `net::ERR_CONNECTION_REFUSED`

**Cause**: Server not running or wrong port.

**Fix**: 
```bash
# Start server
pnpm start

# Verify port 44100 is used
curl http://localhost:44100
```

## Admin Access Denied

**Symptom**: 403 Forbidden on admin pages.

**Cause**: Missing null check on user.

**Fix**: Always check user exists:
```typescript
if (!user || user.role !== 'admin') { /* 403 */ }
```

## Cart Button State Wrong

**Symptom**: Button shows "Add" when item is in cart.

**Cause**: Stale server-rendered state.

**Fix**: Reload page after cart actions:
```typescript
// Use window.location.href to preserve URL params
let url = window.location.pathname + window.location.search
window.location.href = url
```

## Inline Edit Not Working

**Symptom**: Click on cell doesn't enter edit mode.

**Cause**: Client assets not rebuilt.

**Fix**: Rebuild after modifying `app/assets/*.tsx`:
```bash
npx esbuild app/assets/*.tsx --outbase=app/assets --outdir=public/assets --bundle --minify --splitting --format=esm --entry-names='[dir]/[name]' --chunk-names='chunks/[name]-[hash]' --sourcemap --alias:node:fs=./browser-shims.js --alias:node:fs/promises=./browser-shims.js --alias:node:path=./browser-shims.js --alias:node:url=./browser-shims.js --alias:node:async_hooks=./browser-shims.js
```

## Image Upload Fails

**Symptom**: 500 error on book creation with cover.

**Cause**: Upload directory not writable or missing.

**Fix**: Check `uploads/` directory permissions.

## Textarea Shows Empty Value

**Symptom**: Edit form textarea is empty despite data existing in database.

**Cause**: Used `value` prop on `<textarea>` - Remix SSR doesn't support this.

**Fix**: Use children instead of value prop:
```tsx
// ❌ Wrong
<textarea name="description" value={book.description} />

// ✅ Correct
<textarea name="description">
  {book.description}
</textarea>
```

**Reference**: `app/ui/form/textarea-input.tsx`

## Select Dropdown Not Showing Current Value

**Symptom**: Dropdown always shows first option regardless of actual value.

**Cause**: Used `value` prop on `<select>` - Remix SSR requires `selected` prop on `<option>`.

**Fix**: Use `selected` prop on each option:
```tsx
// ❌ Wrong
<select value={book.in_stock ? 'true' : 'false'}>
  <option value="true">Yes</option>
  <option value="false">No</option>
</select>

// ✅ Correct
<select>
  <option value="true" selected={book.in_stock === true}>Yes</option>
  <option value="false" selected={book.in_stock === false}>No</option>
</select>
```

**Reference**: `app/ui/form/select-input.tsx`
