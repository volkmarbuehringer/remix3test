# Frame prefetching with a one-shot response cache

**Extracted:** 2026-10-23 · **Pin:** remix 3.1.0 (build `dfb4fc808` / source `5e5a244`)
**Vendor:** `@remix-run/component/src/runtime/prefetch.ts` (`startPrefetching`, `getIntentAnchor`), `run.ts` (`prefetch` option), installed guide `node_modules/remix/guides/05-interactivity.md` §"Prefetch links before navigation".

## Why the default prefetcher is not enough here

- `app/assets/entry.tsx` replaces the runtime default with `run({ resolveFrame })`: every frame request adds `X-Remix-Frame`/`X-Remix-Target`, a one-shot `X-Agent-Prefill` payload, `cache: 'no-store'`, and the 4xx-renders / 5xx-`ErrorCard` / 401-redirect policy, then reconciles `X-Remix-Redirect-To` into `frame.src`.
- The default prefetcher (`createDefaultPrefetch`) fetches HTML on its own and only discovers JavaScript/CSS/image/font `<link rel="prefetch">` hints. It never goes through the custom resolver, and the navigation resolves again — so its HTML is discarded and the app pays a second SSR per hovered link.
- The 3.1 answer is the `prefetch` hook: the runtime calls it on intent, the app stores the response the navigation *would* have fetched, and `resolveFrame` claims it. `run.ts` documents exactly this pairing ("use it with `resolveFrame` to reuse uncacheable HTML").

## Wiring

- `app/assets/frame-prefetch.browser.ts` — the one-shot cache: `prefetchFrame(src, options)` (the `PrefetchFrame` hook; the warm promise is kept in an `inFlight` map), `claimPrefetchedFrame(url, target, signal)` (stored entry **or** awaits a warm still in flight), `takePrefetchedFrame(url, target)` (sync claim), `clearPrefetchedFrames()`. Key is `target + ' ' + absolute href`; entries are single use, TTL 10 s, max 8, and consuming one clears the rest.
- `app/assets/frame-response.browser.tsx` — one request path, two modes: `fetchFrameResponse` classifies the outcome, `resolveFrameResponse` is navigation mode, `prefetchFrameResponse` is prefetch mode.
- `app/assets/entry.tsx` — `run({ prefetch })`; `resolveFrame` **awaits** `claimPrefetchedFrame` for a plain GET (method `get`/undefined, no `formData`), deletes the prefill entry on a hit, reconciles the redirect header for both cached and fetched responses, and only clears + fetches when the claim misses.

## Invariants

- **A prefetch must never navigate the document.** Redirect-with-`target` and 401 resolve to `undefined` in prefetch mode; only navigation mode calls `window.location.assign`. Otherwise hovering a stale link would yank the page.
- **Never consume `agentPrefillMap` during a prefetch.** The warmed HTML already contains the prefilled content; deleting the one-shot entry would starve a later navigation that misses the cache. The hit path deletes it; the real fetch keeps deleting on `response.ok`.
- **A click that beats the warm must await it, not refetch.** The runtime starts the prefetch on `pointerdown`, tens of ms before the click navigation. `claimPrefetchedFrame` awaits the in-flight promise (honoring the navigation `signal`) so a fast click does not clear the warm and start a second SSR; `clearPrefetchedFrames()` only runs after the claim misses. Do not reorder this into a sync `take` + clear.
- **Only plain GETs are warmable.** Cache lookups are gated on `isPlainGet`; `frame.reload({ method, body })` POSTs and form-data GETs bypass the cache entirely (the key does not encode method or body).
- **5xx is never cached.** The recovery card is a client-side component, not a reusable fragment; 4xx validation fragments are cached because a real navigation renders them.
- **CSP nonces.** Frame fragments carry the nonce of the response that rendered them. Reuse is same-document and short-lived; the app's frame content has inert JSON scripts plus import maps that the runtime appends with the installed map's nonce. Do not introduce executable `nonce={getCspNonce()}` inline scripts into frame fragments — a warmed copy would carry a stale nonce.
- **The override replaces the default prefetcher**, including its asset-hint discovery. Asset hints would have to be added inside `prefetchFrame` (read the warmed HTML, emit `<link rel="prefetch">`); not done, because the warm already removes the navigation round trip.

## Adoption points

Seven anchors carry `data-rmx-prefetch="intent"`: the admin-lists filter tabs (Alle/Mit Elementen/Leer), the lists pager prev/next, and the appointment sidebar week arrows. The runtime reads the attribute **on the anchor itself** (`getIntentAnchor` → `a[href][data-rmx-prefetch="intent"]`), so add it per link. Prefer same-origin GET anchors that already carry `data-rmx-target`; skip `data-rmx-document` links (runtime filters them), downloads, and JS-triggered reloads (a reload with no anchor never prefetches).

## Tests

- `app/assets/frame-prefetch.test.browser.ts` — single use, concurrent dedupe, in-flight claim (one request), abort-while-waiting, target keying, cross-origin skip, sibling invalidation, refused responses.
- `app/actions/admin/admin-lists-prefetch.test.e2e.ts` — the real runtime: hover the marked "Leer" tab, assert one fragment request, click, assert the count stays 1 and the URL moves to `status=empty`.
- `app/assets/frame-response.test.browser.ts` § `prefetchFrameResponse` — no navigation on redirect/401, 5xx skipped, 4xx cached, prefill retained on prefetch and consumed on navigation.
