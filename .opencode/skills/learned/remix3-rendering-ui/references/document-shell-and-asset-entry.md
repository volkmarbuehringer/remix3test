# Remix 3 Document Shell and Asset Entry

**Source:** installed guide `node_modules/remix/guides/04-rendering-ui.md` — "Rendering pages through request context" (L180–219) and "Document shells, head content, and HTML responses" (L221–273).

**Extracted:** 2026-09-26

**Context:** Editing the shared document shell, adding head tags/preloads/styles, wiring the browser entry script or import map, or returning a rendered page with a status/headers.

## Problem

The guide's starter keeps the shell in `app/actions/document.tsx` and imports a `scriptEntry` from `app/assets.ts`. In this app the shell is `app/ui/document.tsx` and the entry is request-scoped middleware state, so following the guide literally would create a second shell and a per-component asset URL instead of the one entry the page already resolves.

## Solution

Use the guide for the head/shell rules; wire them to these app seams.

- **Shell component:** `app/ui/document.tsx` exports `Document` (the shared shell; AGENTS.md notes `app/ui/` owns it). Page modules render their content inside it rather than each building `<html>`/`<head>`.
- **Entry data:** `getAssetEntry()` from `app/middleware/asset-entry.ts` returns `{ href, importMap, preloads }`. The `loadAssetEntry` middleware computes it once per request with `assetServer.getScriptEntry(defaultScriptEntry)` (`app/assets.ts`'s `assetServer`), then stores it on a context key. There is no `scriptEntry` export on `app/assets.ts` as the guide shows.
- **Head wiring:** render `<ImportMap value={entry.importMap} nonce={getCspNonce()} />` and a `modulepreload` link per `entry.preloads` href. For the body script, use `entry.href` with the fallback `routes.assets.href({ path: 'app/assets/entry.tsx' })` (see `app/ui/document.tsx`).
- **Frames skip the entry:** `loadAssetEntry` only loads when `!context.request.headers.get('X-Remix-Frame')`. Do not assume `getAssetEntry()` is populated in a fragment/frame render — keep global head, import-map, and preload work on document responses.
- **CSP nonce:** inline `<script>` and `<ImportMap>` carry `getCspNonce()` (`app/middleware/security-headers.ts`). See `security-gotchas` (CSP inline scripts) before adding another inline script.
- **Response pipeline:** `createHtmlResponse()` (guide L271–273) preserves or prepends `<!DOCTYPE html>` and sets `Content-Type: text/html; charset=UTF-8` unless supplied — note the app test comment at `app/router.test.ts:170` that it always adds the doctype. `context.render(tree, { status, headers })` adds a status/headers (guide L206–215).

## When to Use

- Adding `title`/`meta`/og tags, modulepreloads, global styles, or the entry script.
- Debugging a missing/unpopulated import map or entry in a frame fragment.
- Returning a rendered page with a non-200 status or custom headers.

## Reference

- `node_modules/remix/guides/04-rendering-ui.md` L180–273
- `app/ui/document.tsx`, `app/middleware/asset-entry.ts`, `app/middleware/security-headers.ts`
