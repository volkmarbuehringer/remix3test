## Why

Every page load triggers dozens of `/assets/` requests (JS modules, CSS, source maps), each logged individually. This drowns out meaningful request logs (routes, API calls, errors). Asset errors (404, 500) are still worth logging.

## What Changes

- Replace the current bare `logger()` middleware with a filtered version that skips successful (status < 400) `/assets/` requests
- Keep logging all asset errors (status >= 400)
- Keep logging all non-asset requests unchanged

## Capabilities

### New Capabilities
- `asset-logger-filter`: Suppress successful asset request logs while preserving error logging

### Modified Capabilities
*(none — purely an infrastructure change)*

## Impact

- `app/middleware/root.ts` — replace `logger()` with a filtered variant
