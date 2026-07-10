## Context

`loadAssetEntry` middleware runs on every request and resolves the script entry's href and preloads via the asset server. For frame requests (`X-Remix-Frame: true`), the parent document already loaded all assets — frame content is rendered inline, not as a standalone page. For SSE connections, no HTML is ever rendered. Skipping the asset resolution on these request types saves unnecessary I/O without affecting correctness.

## Goals / Non-Goals

**Goals:**

- Skip `assetServer.getHref()` + `assetServer.getPreloads()` for frame requests
- Preserve identical behavior for full-page requests

**Non-Goals:**

- Skip for any other request type (SSE, API, auth POSTs)
- Refactor the consumer (`document.tsx`) — it already handles missing asset entry
- Lazy-load on first access (over-engineered for this use case)

## Decisions

### Decision: Conditional skip based on `X-Remix-Frame` header

**Rationale**: The `X-Remix-Frame` header is set by the Remix frame runtime on all frame fetches. If present, the response will be rendered inside a `<frame>` element on a page that already loaded the script entry. The asset entry data will never be consumed. The consumer (`getAssetEntry()`) returns `AssetEntry | undefined` and the call site uses `entry?.scriptSrc ?? fallback` — no code change needed.

### Not doing: skip for SSE or other request types

**Rationale**: SSE endpoints and API routes also don't need asset entry, but detecting them requires pattern-matching on the URL or adding a custom header. Frame detection is a single, reliable header check. Further scoping can be done in a follow-up if performance data warrants it.

## Risks / Trade-offs

| Risk                                                                                 | Mitigation                                                                                                                               |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| A frame route unexpectedly renders a full document that needs the script entry       | Frame routes always render content inline inside `<frame>` — the runtime never navigates a frame to a full page without the parent shell |
| The `X-Remix-Frame` header could be absent in some frame scenarios                   | All frame fetches from `followFrameRedirects()` and the client-side frame runtime set this header. It's a framework contract             |
| The fallback `routes.assets.href(...)` path in document.tsx might behave differently | The fallback was already the pre-existing default before `loadAssetEntry` was added — it's the safe path                                 |
