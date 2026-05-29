## Context

The app has a reusable `createRateLimiter()` utility at `app/utils/rate-limiter.ts` with configurable window, per-user tracking, and cleanup. The login controller (`app/actions/auth-login-controller.tsx`) uses an inline per-email Map-based rate limiter (5 attempts / 15s window) rather than the shared utility. The register controller (`app/actions/auth-register-controller.tsx`) has no rate limiting at all.

Breadcrumbs use a centralized `ROUTE_LABELS` map at `app/ui/route-labels.ts`. The `getBreadcrumbs()` function in `app/ui/breadcrumbs.tsx` walks the path segments and looks up each segment in `ROUTE_LABELS` to build a trail. However, many routes lack entries, causing breadcrumbs to collapse to just "Home". The breadcrumb pattern guide at `.opencode/context/.../breadcrumb-pattern.md` still describes an older hardcoded if-statement approach that was replaced by the `ROUTE_LABELS`-based implementation.

## Goals / Non-Goals

**Goals:**
- Add per-email rate limiting to the POST `/register` endpoint using the existing `createRateLimiter()` utility
- Add complete `ROUTE_LABELS` entries for all active routes so breadcrumbs display correctly everywhere
- Update the breadcrumb pattern guide to document the current `ROUTE_LABELS`-based approach
- Keep rate limiting behavior consistent with the login pattern (5 attempts / 15s window)

**Non-Goals:**
- Do NOT refactor the login controller to use the shared rate limiter utility (scope is register-only)
- Do NOT add rate limiting to other endpoints
- Do NOT redesign the breadcrumb system or switch to route-registry-based breadcrumbs
- Do NOT modify the rate limiter utility itself

## Decisions

### Decision 1: Use the shared `createRateLimiter()` utility for register (not inline Map)

The login controller uses an inline `Map<string, { count, firstAt }>` pattern. For register, the existing `createRateLimiter()` utility will be used instead.

**Rationale**: The shared utility already exists and handles cleanup, window logic, and the check/set/attempt API. Using it validates the utility works in production and avoids duplicating Map management code. The slight API difference (`.attempt()` vs inline Map logic) is acceptable since these are independent controllers — consistency in behavior matters more than identical implementation.

**Alternative considered**: Inline Map mirroring login — rejected because it would duplicate code the utility already provides.

### Decision 2: Per-email rate limiting, not per-IP

The rate limiter will key on the normalized email address from the form data, matching the login controller's approach.

**Rationale**: Per-email limiting prevents automated account creation for specific addresses. Per-IP is intentionally excluded because (a) the rate limiter utility doesn't natively support IP tracking, (b) NAT environments create false positives, and (c) email-based limiting directly addresses the abuse scenario.

### Decision 3: Static module-level instance, not request-scoped

The rate limiter will be a module-level singleton, same as the login controller's inline Map.

**Rationale**: Rate limiters are inherently stateful across requests. Module-level singletons survive hot-reloads and persist in memory. This matches the existing login pattern.

### Decision 4: Missing route labels are added to the existing `ROUTE_LABELS` map

Rather than creating a new lookup mechanism, missing entries are added to the existing centralized map.

**Rationale**: The map already works — it just has gaps. Filling gaps is simpler and lower-risk than introducing a new pattern. The `getBreadcrumbs()` function already handles partial matches (walks up parent segments), so adding `/admin/nutzer` automatically fixes `/admin/nutzer/create`, `/admin/nutzer/42`, etc.

## Risks / Trade-offs

- **[Risk] Register rate limiter runs in-process memory** → Mitigation: Only tracks failed registration attempts (not successful ones), so the Map stays small. If the server restarts, rate limits reset — acceptable for a registration throttle.
- **[Risk] Wrong ROUTE_LABELS key format** → Mitigation: Follow existing conventions — no trailing slashes, static paths before parameterized ones. Test by navigating to each route after adding.
- **[Risk] Breadcrumb guide might fall out of sync again** → Mitigation: The guide now documents that `ROUTE_LABELS` is the single source of truth. Adding routes is a one-line change that's obvious when following the existing pattern.
