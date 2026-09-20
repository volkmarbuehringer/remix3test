---
name: remix3-report-pdf-export
description: "Use when adding a PDF/CSV export or download to an existing server-rendered list or report page in this app — share the page's period/filter/sort parser with the export action, generate with the pdfmake helpers, wire a static child route, and avoid the data-rmx-document / X-Remix-Frame download traps."
metadata:
  origin: auto-extracted
---

# Report Export Sharing the Page's Query Parser

**Extracted:** 2026-09-20
**Context:** `/verwaltung/report1` (Monatsauswertung) already rendered from `year/month/user_id/filter/sort/order`; a PDF export had to return exactly the view the page shows.

## Problem

A report page and its export must agree on the rows. Re-parsing the query string inside the export lets the file drift from the page (wrong month, ignored name filter). Copying an existing export controller also tends to copy `users-pdf`'s bare `if (X-Remix-Frame) redirect(url.href)`, which is a documented redirect loop.

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

Frame/download semantics are already documented — do not restate them: `remix3-frame-cliententry` → `references/frame-navigation.md` §"data-rmx-document: Binary Downloads".

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

## Testing

- Server test via `router.fetch(url, { headers: { Cookie } })`: assert `Content-Type: application/pdf`, a `Content-Disposition` filename, and `String.fromCharCode(...bytes.subarray(0, 4)) === '%PDF'`.
- Assert the page's link carries the active params: `data-rmx-document`, `/report1/pdf?`, `month=3`, `filter=Admin`.
- Assert the shim: framed request → 302 whose `Location` carries `frameDownload=1`; the marked framed request → 200 HTML (not `%PDF`).
- Browser/client behaviors are a separate skill: `remix3-playwright-browser-testing`.

## When to Use

- Adding a PDF/CSV export to an existing list/report page in this app.
- A user reports an export or button "does nothing" and expects a generated file. A label like "Auswertung erstellen" on a button that only re-filters reads as broken — label the filter submit for what it does and give the export its own control.
- Reusing `users-pdf` / `users-export` / `pdf` as a template — start from `pdf-utils.ts`, and take the frame guard from `users-export`, not `users-pdf`.

## References

- `app/utils/pdf-utils.ts` (`generatePdfBuffer`, `pdfAttachmentResponse`), `app/utils/report1-pdf.ts`, `app/utils/user-summary-pdf.ts`, `app/utils/date-utils.ts`
- `app/actions/verwaltung/report1/controller.tsx` — page + export sharing `parseReport1Query` and the marker shim
- `app/actions/verwaltung/users-export/controller.tsx` — original marker-shim implementation
- `remix3-frame-cliententry` → `references/frame-navigation.md` — §data-rmx-document, §Guard the controller against frame requests
- `remix-file-uploads` §5 (download endpoint) and §6 (ZIP attachments)
