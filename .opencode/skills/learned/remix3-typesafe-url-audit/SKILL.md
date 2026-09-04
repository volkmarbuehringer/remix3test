---
name: remix3-typesafe-url-audit
description: "Find and convert hardcoded URL strings to the typed routes tree — grep patterns, form/param route hrefs, and test-fixture exclusions"
origin: auto-extracted
---

# Remix 3: Audit for Non-Typesafe URLs

**Extracted:** 2026-09-04
**Context:** Converting navbar links to the typed `routes.*` tree, then sweeping the app for remaining hardcoded `href`/`action`/`src` strings.

## Problem

Remix 3's `app/routes.ts` exports a typed route tree (`routes` + `system`) whose leaf routes expose `.href()` for type-safe URL generation. Hardcoded URL strings (`href="/admin/clients"`, `` action={`/admin/clients/${row.id}`} ``) bypass that contract: a typo like `/verwaltungs` compiles and typechecks fine, and a renamed route silently breaks the link. The vendor `remix` skill documents the `.href()` mechanism but not how to systematically find the offenders.

## Solution

Sweep `app/` with these regexes (Grep tool, `*.ts*`):

```
href="/[a-zA-Z]      action="/[a-zA-Z]      src="/[a-zA-Z]
url="/[a-zA-Z]       fetch("/[a-zA-Z]       redirect("/[a-zA-Z]
href={`/             action={`/             new URL("/[a-zA-Z]
```

Convert each match to the typed tree:

- Plain route: `routes.admin.clients.index.href()` (from `admin: route('admin', { clients: route('clients', { index: get('/') }) })`)
- Param route: `routes.admin.clients.update.href({ id: row.id })` — matches `update: put('/:id')`
- Form route in the `system` tree: `system.webhookRequestCreate.index.href()` — a `form('/webhook-requests/create')` route resolves via `.index.href()`, not a bare property
- Query-string composition stays as `routes.x.href() + '?param=' + v` (the tree returns the path only)

**Exclusions — these are NOT app navigation URLs, leave them:**

- Test fixtures with fake routes: `url="/test/subscribe"` in `streams.test.browser.tsx` (no such route exists; the component under test accepts arbitrary URLs)
- Serialized-output assertion strings: `'"href":"/verwaltung/appointments"'` in controller tests asserting on rendered JSON
- JSDoc/comment examples: `` * <ConnectionIndicator url="/admin/messages/subscribe" /> ``

Verify: `npm run typecheck` then run the touched files' tests (`npx remix test <file>`).

## When to Use

- Adding/editing nav links (`app/ui/nav.ts` `NAV_SECTIONS` / `MOBILE_ITEMS`) — use `routes.*.href()` from the start
- Building pages with `<RestfulForm>` / `<a>` / `<Frame>` targets
- After a route rename, to find links that no longer resolve
- Sweeping for hardcoded URL strings before a refactor

## Related

- `remix` vendor skill → `references/routing-and-controllers.md` "URL generation with `.href()`" (authoritative; this delta is the audit workflow, not the API)
- `remix3-frame-form-action-get-route` — form action paths must also resolve as GETs