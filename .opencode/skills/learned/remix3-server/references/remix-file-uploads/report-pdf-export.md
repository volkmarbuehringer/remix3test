# Report/List PDF Exports: Share the View, Bound the Cost

**Source:** `remix3-report-pdf-export`

**Extracted:** 2026-09-20
**Extended:** 2026-11-10
**Context:** `/verwaltung/report1` (Monatsauswertung) already rendered from `year/month/user_id/filter/sort/order`; a PDF export had to return exactly the view the page shows. Extended 2026-11-10 by the `/lists` view export: the view exists only in client state, and one long item label took pdfmake ~35 s to lay out. Extended 2026-11-10 (second) by `/admin/users` → `/admin/output`: the export is a sibling admin route, so the shared parser/loader moved to a data module and the marker branch reuses the grid's own renderer.

## Problem

A report page and its export must agree on the rows. Re-parsing the query string inside the export lets the file drift from the page (wrong month, ignored name filter). Copying an existing export controller also tends to copy `users-pdf`'s bare `if (X-Remix-Frame) redirect(url.href)`, which is a documented redirect loop. Unbounded user text is the second trap: with `break-all` a ~250 KB cell takes ~35 s and ~166 MB (§6).

## Solution

### 1. Same route object + controller, static child leaf

```ts
report1: route('report1', { index: get('/'), pdf: get('/pdf') }),
```

```ts
createController(routes.verwaltung.report1, {
  middleware: [requireAuth(), requireAdmin()],
  actions: {
    async index(context) { /* render the page */ },
    async pdf(context) { /* return the attachment */ },
  },
})
```

### 2. One parser for both actions

Factor the query parsing into `parseReport1Query(context, overrides?)`: it clamps `year` (2000–2100) / `month` (1–12), resolves `user_id`/`filter`, runs `parseSort` with the same allowed columns/defaults, and computes `monthStart`/`monthEnd`. The HTML loader and the `pdf` action both call it.

The export runs the same data function with a large page size and zero offset:

```ts
let { rows, hasMore } = await runReport1(context.db, {
  ...query, effectivePageSize: REPORT1_EXPORT_LIMIT /* 10_000 */, offset: 0,
})
// hasMore becomes the "auf 10.000 Einträge begrenzt" truncation note
```

### 3. Generate with the repo helpers, not raw pdfmake

```ts
let buffer = await buildReport1Pdf({ periodLabel, filterLabel, rows, truncated })
return pdfAttachmentResponse(buffer, `monatsauswertung-${year}-${String(month).padStart(2, '0')}.pdf`)
```

`generatePdfBuffer` (`app/utils/pdf-utils.ts`) already sets the Roboto fonts and `setUrlAccessPolicy(() => false)`; a new builder only supplies `pageSize`/`content`/`styles` (see `app/utils/user-summary-pdf.ts`, `app/utils/report1-pdf.ts`). Reuse `monthNameDE()` (`app/utils/date-utils.ts`) so the page heading and the PDF period label share one month-name source.

### 4. Trigger the download with `data-rmx-document`

```tsx
<a href={pdfUrl(state)} data-rmx-document>PDF exportieren</a>
```

Frame/download semantics are already documented — do not restate them: `remix3-frame-cliententry` → `references/frame-navigation.md` §"data-rmx-document: Binary Downloads & Cross-Section Links".

### 5. ⚠️ Do NOT bare-redirect a framed export

`users-pdf` ships `if (X-Remix-Frame === 'true') redirect(url.href)`, which loops: `fetch()` preserves the header across same-origin redirects, so the frame re-requests, the controller 302s again, and the browser eventually aborts with `NetworkError`. Use the marker shim (as `users-export` does):

```ts
const FRAME_DOWNLOAD_PARAM = 'frameDownload'

if (context.request.headers.get('X-Remix-Frame') === 'true') {
  let url = new URL(context.url)
  if (url.searchParams.get(FRAME_DOWNLOAD_PARAM) === '1') {
    return renderReport1Page(context, await loadReport1PageData(context)) // HTML terminates the chain
  }
  url.searchParams.set(FRAME_DOWNLOAD_PARAM, '1')
  return redirect(url.href) // exactly one hop
}
```

`data-rmx-document` keeps the happy path out of the frame entirely; the shim only covers a framed direct hit.

The marker response is followed **in-frame** by `frameRedirects()` and the client mounts the 200 fragment before `entry.tsx` reconciles `frame.src` from `X-Remix-Redirect-To`, so the marker branch must render the **real page** (full sidebar/query state), not a minimal placeholder. `/lists` initially rendered a one-row sidebar there; fixed 2026-11-10.

### 6. Bound the layout cost of user text

`wordBreak: 'break-all'` is not a cheap wrap. pdfmake's `TextBreaker.splitWords` turns a `break-all` cell into **one word object per character** (`node_modules/pdfmake/src/TextBreaker.js`; the style is read via `getStyleProperty(..., 'wordBreak', 'normal')`), and layout cost grows superlinearly with one cell's length. Measured 2026-11-10 with the installed pdfmake 0.3.14 through `generatePdfBuffer`:

| one item label | build time |
| --- | --- |
| 10,000 chars | 164 ms |
| 50,000 chars | ~3.0 s |
| 100,000 chars | ~10.5 s |
| 200,000 chars | ~21 s (with spaces) / ~27 s (unbroken) |
| 250,000 chars | ~34.5 s, ~166 MB heap |

The same 200k label with `wordBreak: 'normal'` built in 461 ms but was **clipped** (16 KB vs 857 KB PDF), so the wrap is required for fidelity — bound the input and the export, do not drop the wrap. `requireAuth()` and the 256 KB `jsonBody` cap do not help: one authenticated request can carry a ~250 KB cell and blocks the single Node process for the whole layout.

Three layers (all in `app/utils/list-pdf.ts` / `app/data/lists.ts`):

1. **Write boundary** — `LIST_ITEM_LABEL_MAX_CHARS = 2_000` in `app/data/lists.ts`, enforced by `listItemSchema` in both the page controller (`app/actions/lists/controller.tsx`) and the token API (`app/actions/api/lists/controller.tsx`); the editor's composer/edit textareas mirror the cap.
2. **Export clamp** (covers rows written before the cap) — `clampCell()` cuts a cell at 2,000 chars with a surrogate-safe ellipsis; `LIST_PDF_MAX_ITEMS = 5_000`; `LIST_PDF_MAX_TOTAL_CHARS = 100_000` counts labels plus joined tags.
3. **Never silently truncate** — the summary line states `Es sind nur X von Y Einträgen enthalten` and `Lange Einträge sind gekürzt`; an empty filtered view reads `Keine Einträge für diese Ansicht.` instead of the empty-list message.

After the clamp the 250k-char label builds in **80 ms**; the worst realistic shape (5,000 × 20 chars) is ~1.1–1.4 s. `app/utils/list-pdf.test.ts` asserts the clamped cell length + ellipsis, the row cap, and the subset count.

### 7. Export a view that lives only in client state

Report pages keep their view in the URL, so the export re-parses it (§2). The `/lists` editor keeps search/status/hide-done/sort/reverse in client closure state, so there is nothing to re-parse — round-trip the controls and reuse the same pure pipeline:

1. **Shared contract** — `app/actions/lists/public/lists-view-params.ts` exports `LIST_VIEW_PARAMS` (`q`, `status`, `hideDone`, `sort`, `reverse`), `ListViewState`, and `listViewSearchParams()`, which emits only non-default controls. `lists-view.tsx`'s `pdfViewHref()` builds the header link; a default view yields `/lists/:id/pdf`, so the sidebar's whole-list export is unchanged.
2. **Server parse + same pipeline** — `app/actions/lists/list-pdf-view.ts` validates the enums (unknown values fall back to defaults) and `selectListPdfItems()` calls the **same** `buildVisibleItems()` the editor uses (from `./public/lists-state.ts`), so text/tag search, status, hide-done, sort and reverse cannot drift.
3. **Self-describing file** — `createListPdfDocument(list, { viewLabel, totalCount })` renders `Ansicht: Status Offen · A–Z · umgekehrt · Suche „alpha“` and `1 von 3 Einträgen` (`app/utils/list-pdf.ts`).
4. **Live href** — the anchor is `data-rmx-document` and the href is rebuilt from the view props on every `handle.update()`; the browser test asserts the exact href after each control change.

The `data-rmx-document` requirement is the frame rule from `remix3-frame-cliententry` → `frame-navigation.md`. `app/actions/lists/lists-pdf-export.test.e2e.ts` clicks the link inside the frame and asserts a real download (`page.waitForEvent('download')`, filename, `%PDF`); if the frame swallowed it, no download event would fire. The transient `shuffleOrder` ("mischen") is deliberately not encoded — no reproducible order exists, so the export uses the selected sort/manual order.

### 8. Export a URL-held grid from a separate route

The page and its export need not share a route map. `/admin/users` exports
through `GET /admin/output` (`app/actions/admin/output/controller.tsx`), which
`routes.admin.users` cannot own because `/admin/output` is not a child of
`/admin/users`.

- **Share parsing and loading in a data module** — `app/data/admin-users.ts`
  exports `parseUsersQuery(url)` (search/status resolution plus the sort
  whitelist) and `loadUsersPage(db, { offset, pageSize, ... })`. The page
  controller (`renderUsersIndex`) and the output controller both call them, so
  the file cannot drift from the grid. This is §2 with the parser moved out of
  the controller.
- **Build the link without `offset`** — reuse `buildFilterParams(value, sort,
  order, 0, undefined, status)`, which omits `offset` at 0, so the export
  covers every matching row (capped) rather than the visible page. The export
  ignores `?offset=` server-side; assert both the link and the all-rows result.
- **Reuse the grid renderer for the marker branch** — export the page renderer
  (`renderUsersIndex`) from the page controller and call it for the
  `frameDownload=1` request (§5) instead of duplicating the data load and JSX.
- **Bound admin text too** — the admin user form does not cap name/e-mail, so
  `app/utils/admin-users-pdf.ts` clamps each cell at 300 chars, caps rows at
  10,000, and discloses both in the count line (`X von Y Benutzern — Hinweis:
  … — Lange Einträge sind gekürzt.`). Format date+time cells as two lines
  (`toLocaleDateString` + `\n` + `toLocaleTimeString`); `toLocaleString('de-DE')`
  produces `"15.01.2024, 01:00"`, which wraps at the comma in a narrow auto
  column and leaves the comma dangling.

## Testing

- Server test via `router.fetch(url, { headers: { Cookie } })`: assert `Content-Type: application/pdf`, a `Content-Disposition` filename, and `String.fromCharCode(...bytes.subarray(0, 4)) === '%PDF'`.
- Assert the page's link carries the active params: `data-rmx-document`, `/report1/pdf?`, `month=3`, `filter=Admin`.
- Assert the shim: framed request → 302 whose `Location` carries `frameDownload=1`; the marked framed request → 200 HTML (not `%PDF`).
- Download e2e when the link sits in a frame: `page.waitForEvent('download')`, assert `download.url()` carries the view params, the suggested filename, and `%PDF` in the downloaded bytes (`app/actions/lists/lists-pdf-export.test.e2e.ts`).
- To prove a filtered export applied the view server-side, compare `Content-Length` of the full and filtered PDFs (`app/actions/lists/controller.test.ts`); DOM/text assertions cannot see compressed PDF streams.
- For a grid export served from a sibling route, assert the page link carries
  the filter/status/sort and **omits `offset`**, and that a request with
  `?offset=N` returns the same byte length as one without it (all-rows
  behavior).
- Adding an export anchor inside a grid row makes broad row locators
  (`[data-row-id] a`, `[data-list-id] a`) ambiguous in Playwright strict mode;
  scope existing e2e locators to the row's navigation href when the export link
  lands (see `app/actions/lists/lists-client-edit.test.e2e.ts`).
- Browser/client behaviors are a separate skill: `remix3-testing` (`references/test-harness-gotchas.md`, `references/testing-hygiene.md`).

## When to Use

- Adding a PDF/CSV export to an existing list/report page in this app.
- A user reports an export or button "does nothing" and expects a generated file. A label like "Auswertung erstellen" on a button that only re-filters reads as broken — label the filter submit for what it does and give the export its own control.
- Reusing `users-pdf` / `users-export` / `pdf` as a template — start from `pdf-utils.ts`, and take the frame guard from `users-export`, not `users-pdf`.
- A styled view (search/status/sort/reverse) needs an export of exactly those rows — including when the state lives only in client state rather than the URL.
- A PDF cell receives unbounded user text (labels, notes, tags) — bound it before pdfmake; see §6.
- The export lives on a sibling output route rather than under the grid; share
  the parser/loader in a data module and reuse the grid renderer for the frame
  marker (§8).

## References

- `app/utils/pdf-utils.ts` (`generatePdfBuffer`, `pdfAttachmentResponse`), `app/utils/report1-pdf.ts`, `app/utils/user-summary-pdf.ts`, `app/utils/date-utils.ts`
- `app/actions/verwaltung/report1/controller.tsx` — page + export sharing `parseReport1Query` and the marker shim
- `app/actions/verwaltung/users-export/controller.tsx` — original marker-shim implementation
- `app/utils/list-pdf.ts`, `app/data/lists.ts` — bounded list PDF (cell/row/char clamps, view label/subset count)
- `app/actions/lists/list-pdf-view.ts`, `app/actions/lists/public/lists-view-params.ts` — client-held view round-trip
- `app/actions/lists/lists-pdf-export.test.e2e.ts` — framed download e2e
- `app/actions/admin/output/controller.tsx`, `app/data/admin-users.ts`, `app/utils/admin-users-pdf.ts` — sibling-route export for the admin users grid (shared parse/loader, marker reuses `renderUsersIndex`)
- `app/actions/admin/admin-users-pdf.test.e2e.ts` — framed admin-grid download e2e
- `remix3-frame-cliententry` → `references/frame-navigation.md` — §data-rmx-document, §Guard the controller against frame requests
- `remix-file-uploads` §5 (download endpoint) and §6 (ZIP attachments)