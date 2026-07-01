## Why

The `global-rate-limit.ts` middleware duplicates the IP resolution fallback chain that already exists in `app/lib/request-ip.ts` (`sourceIp()`). If the fallback chain ever changes (adding header sources, changing parse order), the two will drift. This is a mechanical deduplication with no behavioral change.

## What Changes

- Replace the inline IP fallback chain in `global-rate-limit.ts` with a call to `sourceIp(context.request) || 'unknown'`
- Remove the `trustProxy` option from the middleware (rate-limiting is mitigation, not auth — always use the full chain)
- Remove now-dead imports (`trustProxy` parameter, unused option plumbing)

## Capabilities

### New Capabilities

None — purely internal code quality improvement.

### Modified Capabilities

None — no spec-level behavior changes.

## Impact

- `app/middleware/global-rate-limit.ts` — ~10 lines removed, falls back to shared utility
- `app/lib/request-ip.ts` — no change needed (already exports `sourceIp`)
- No behavioral difference in production; no test changes needed
