# form action must be a valid GET inside `<Frame>`

**Extracted:** 2026-08-25

**Re-validated:** 2026-11-15 (§06 re-audit) — the resolver inventory, the redirecting `show` shape, and the download marker guard were checked against `app/routes.ts` and the owning controllers.

## Problem

A form lives inside a `<Frame>` and posts to a **method-only** param route:

```tsx
<RestfulForm method="PUT" action={routes.admin.widgets.update.href({ id: row.id })} data-rmx-target="admin-content">
```

When the frame runtime handles this form submission, it reuses the form's **action path** as the frame's address. From `@remix-run/component` `navigation.ts` `getSourceElementNavigation`:

```ts
state = {
  target: form.getAttribute('data-rmx-target') ?? undefined,
  src: form.getAttribute('data-rmx-src') ?? event.destination.url, // ← falls back to the ACTION url
  ...
}
```

So the frame address becomes `/widgets/12`. With `update: put('/:id')` and **no** `get('/:id')`, a GET of that address — on reload, on the SSE `invalidate` reload, or as the frame settles — returns **404**. Symptom: the update returns 300/302 and the data IS saved, but the frame then lands on `GET /resource/:id → 404` (you'll see `Not Found: /resource/12` from the router), and `window.location.assign(response.url)` races with the action-path address.

The remix README states the intended contract: **form action == frame src** — so the action URL must also resolve as a GET.

**Trap — do NOT "fix" it with `data-rmx-src`.** `reloadFrameForNavigation` fetches `frame.src` carrying the submission *method* and body, so `data-rmx-src` must itself handle the POST/PUT. Pointing `data-rmx-src` at the index (`?editing=N`) makes the runtime PUT to the index → 404. The action path must stay the action path; you must make it a valid GET instead.

## Solution

Add a `get('/:id')` route that renders the same edit page as `?editing=N`, and a controller `show` action that loads the row and renders in edit mode:

```ts
// app/routes.ts
appointments: route('appointments', {
  index: get('/'),
  show: get('/:id'),
  create: post('/'),
  update: put('/:id'),
  destroy: del('/:id'),
  events: get('/events'),
})
```

```ts
// app/actions/.../controller.tsx — createController actions
async show(context) {
  let id = context.params.id
  let editRow = id ? (await fetchAppointmentEditRow(context.db, id)) ?? null : null
  if (!editRow) {
    return renderAppointmentsPage(context, await loadPageData(context, { error: 'Eintrag nicht gefunden.' }), { status: 404 })
  }
  return renderAppointmentsPage(context, await loadPageData(context, { editRow }))
}
```

For resource-helper routes, enable the generated `show` route instead of excluding it:

```ts
resources: resources('resources', { exclude: ['new', 'edit'] })   // was ['new','show','edit']
```

Static sibling routes are unaffected: a static `/events` still wins over `/:id` (route-pattern matcher prioritizes static segments), so `GET /resource/events` keeps hitting the SSE handler.

## Variant — standalone pages crash instead of 404 (validated 2026-08-30)

The same missing-GET contract applies to **standalone (non-Frame) pages**, where the top frame *is* the document — but the failure is a hard crash, not a 404 page. Case: `/webhook-requests` resend form (`POST /webhook-requests/:id/resend`, 303 PRG) crashed Firefox with `Node.insertBefore: Cannot insert a Text as a child of a Document` (Chromium: silent 404 + URL stuck on the action path).

Chain (stack-verified):

1. Post-#11668 the runtime intercepts the form submission and commits `topFrame.src` = the **POST action path** before the response arrives (the precommit handler `controller.redirect(event.destination.url, {history:'replace'})` also puts the action path in the address bar).
2. The action handler broadcasts SSE `invalidate` **before** returning the 303, so `ConnectionIndicator` fires `window.location.reload()` while the POST navigation is still in flight.
3. The runtime intercepts that reload and re-fetches `topFrame.src` = the action path → `GET /webhook-requests/:id/resend` → **404** (POST-only route).
4. `resolveFrameResponse` returns any status < 500 as renderable, so the runtime diff-renders the 404 body as a **fragment** into the document container (`renderFrameStream` finds no `rmx:flush` marker → fragment path) → `diffNodes` inserts a Text node into `#document` → `HierarchyRequestError` → fatal error card.

Fix is the same contract — the action path must resolve as a GET. Two resolver shapes, both validated:

- **Render in place** (`GET /webhook-requests/:id` → renders the grid with the edit panel, mirroring `?editing=<id>`; unknown/invalid id → 303 to the grid). Used for the PUT commit path.
- **PRG to the grid** (`GET /webhook-requests/:id/resend` → 303 to the grid URL preserving the grid-state query). This one also cleans up the committed action-path URL: the client `fetch` follows the 303, `unwrapFrameResolution` sets `redirectedTo = response.url`, and the reload path runs `frame.src = redirectedTo` + `navigation.navigate(redirectedTo, {history:'replace'})`. After the fix both Firefox and Chromium land on `/webhook-requests?offset=…&sort=…` with zero page errors.

Full-suite note: adding the GET resolver to a `system`-style route map means new `system.webhookRequest*` entries in `app/routes.ts` + `router.get(...)` wiring; static siblings (`/events`, `/create`) still outrank `/:id`.

## When to Use

- After a frame-targeted create/update/DELETE form, the frame lands on `GET /resource/:id → 404` (or you see the router's generic `Not Found: /resource/12`).
- A `put('/:id')` / `del('/:id')` admin form inside `<Frame>` where `?editing=N` works but `/<id>` does not.
- Adding a new CRUD collection to this frame admin: give each `/:id` an edit-render GET so the frame action path resolves.
- Do NOT use when you can keep `frame.src == form action` by making the action itself the frame src (then both GET and POST already resolve).

## Resolver shapes found in this app (2026-11-15 §06 audit)

The contract is the same for every frame-targeted write; the shape can vary:

- **Render in place** — `verwaltung.appointments.show` (`GET /:id` renders the edit panel), the chatlog/messages/uploads `*Resolve` routes (render the grid/list), and the admin `toggleDisabledResolve` (render the grid).
- **Redirect to the canonical page** — `admin.users.show` and `admin.lists.show` (`GET /admin/{users,lists}/:id`) and `lists.copyResolve`/`destroyResolve` (`GET /lists/:id/{copy,delete}`) return `303` to the grid/edit-panel URL. A reload only needs the stale path to land somewhere valid; the extra hop is cheaper than duplicating the index's data loading. The delete and update forms share `/admin/:collection/:id`, so the panel must tolerate a missing row after a delete.
- **One-shot marker for a download** — a framed request to a PDF/binary endpoint must not redirect to the *same* URL while still carrying `X-Remix-Frame` (fetch re-sends it and loops). Add `?frameDownload=1` on the first pass and answer the marked request with a page; see `verwaltung/{pdf,users-pdf}/controller.tsx` (`verwaltung/users-export` uses the same marker).