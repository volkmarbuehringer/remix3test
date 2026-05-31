<!-- Context: development/remix3/session/guides/flash-messages | Priority: medium | Version: 1.0 -->

# Guide: Flash Messages

**Core**: Flash messages are key/value pairs that survive exactly one round-trip — set on one request, available on the next, then automatically cleared. Perfect for post-redirect success/error feedback.

## Core Concept

Flash uses a separate `#nextMap` during `flash()` and moves those values to `#flashMap` on the next request's `read()`. `get(key)` checks `valueData` first, then `flashData`. Session starts dirty if flash data exists, ensuring flash values are serialized and cleared.

## Key Points

- `session.flash('key', 'value')` — sets a value readable on the NEXT request only
- `session.get('key')` — checks `valueData` first, falls back to `flashData`
- Flash values are consumed once: read during the next request, then cleared on `save()`
- Session starts already `dirty` if flash data is present (forces save to clear it)
- Perfect for redirect-after-POST (PRG) patterns with toasts and error messages

## Quick Example

```typescript
// POST handler
session.flash('success', 'Item created!')
return redirect('/items')

// GET handler (next request)
let msg = session.get('success') // 'Item created!' — available once
// After save(), flash is cleared
```

## Reference

- **Source**: `packages/session/src/lib/session.ts` — `flash()`, `get()`, and dirty tracking

## Related

- `session-core.md` — How flash maps to Session internal state
- `../guides/standard-pattern.md` — Read→modify→save with flash
- `../../auth/guides/session-middleware.md` — Flash usage in login/logout flows
