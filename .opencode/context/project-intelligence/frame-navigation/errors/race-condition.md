<!-- Context: frame-navigation/errors/race-condition | Priority: high | Version: 1.0 | Updated: 2026-03-25 -->

# Database Initialization Race Condition

## Status: ✅ FIXED

## Problem (Original)

If two requests arrive simultaneously, both could see `null` and overwrite each other's initialization promise.

## Fix Applied

```typescript
let initializePromise: Promise<void> | null = null

export async function initializeLmsDatabase(): Promise<void> {
  if (initializePromise) return initializePromise

  let promise = initialize()
  initializePromise = promise

  promise.catch(() => {
    if (initializePromise === promise) {
      initializePromise = null
    }
  })

  return initializePromise
}
```

## Files Affected

- `app/data/setup.ts`
