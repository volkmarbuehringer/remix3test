# Testing Hygiene (ad-hoc verification, crash stacks, HTML escaping)

**Source:** consolidated from `ad-hoc-verification-safety`, `playwright-capture-swallowed-exception-stack`, `remix3-html-amp-escaped-assertions`

**Extracted:** 2026-08-30 … 2026-09-30
**Extended:** 2026-11-10 by the `/admin/uploads` PDF-export visual check
**Context:** Test-writing and verification practices that prevent false positives, live-data damage, and blind debugging. For harness failures see `test-harness-gotchas.md`; for state isolation see `state-isolation-and-e2e-serve.md`.

## Ad-hoc browser checks must not mutate the persistent database

Clicking through the running dev server is fine for read-only checks, but it shares the persistent `DATABASE_URL`. Exercising a destructive control to prove a behavior executes a real write.

The trap is the app's two-step arm/confirm control (`clearAll` in `app/actions/lists/public/lists-client.tsx`): the first click arms (`clearArmed = true`, label flips to "Wirklich alle löschen?") and starts a 4s timer; a second click within the window deletes every item and autosaves. A script that "reopens the menu and clicks confirm to test dismissal" performs a live delete.

Live destructive controls to avoid in ad-hoc checks:

- `/lists` overflow menu → `✕ Alle löschen`, `✕ Auswahl löschen`, `✔ Nur Erledigte löschen`
- row/sidebar delete forms (`data-confirm` → `ConfirmDelete`)

Instead:

1. **Prove the behavior non-destructively** — open the menu and dismiss via an outside click or `Escape`, or assert `details[open]`; never fire the action. See `lists-client-ops.test.e2e.ts` → "dismisses the overflow menu on outside click and Escape".
2. **Run destructive paths in the ephemeral test DB** — `t.serve(await createTestServer((request) => router.fetch(request)))` with self-seeded rows, deleted only in `finally` (`DELETE FROM lists WHERE id = $1`). See `state-isolation-and-e2e-serve.md`.
3. **Snapshot before touching a persistent DB** (row ids/counts), and avoid any click that can commit.
4. **Separate selection from mutation** — selection is often view-only and safe to automate.

## Screenshot a UI change from an ephemeral e2e run

To verify *how* a change looks (control placement, responsive wrap, dark mode), render the page from
a throwaway `*.test.e2e.ts` against the ephemeral test DB instead of clicking through the dev server
(§ above). Seed what the page needs, add the session cookie, screenshot at desktop and phone widths.
(`t.serve(createTestServer(...))` + cookie wiring: see `state-isolation-and-e2e-serve.md`.)

```ts
// e.g. app/actions/admin/uploads/tmp-visual-check.test.e2e.ts — delete after the check
let server = await createTestServer((request) => router.fetch(request))
let page = await t.serve(server)
await page.context().addCookies([{ name: 'session', value: adminCookie.slice(8), url: server.baseUrl }])
await page.setViewportSize({ width: 1440, height: 900 })
await page.goto(routes.admin.uploads.index.href())
await page.locator('[data-uploads-pdf]').waitFor({ timeout: 15_000 })
await page.waitForTimeout(500)
await page.screenshot({ path: 'tmp/uploads-pdf-desktop.png' })
```

- **Write the image under the repo's gitignored `tmp/`.** In an agent shell `/tmp` is private to one
  command execution: `page.screenshot({ path: '/tmp/x.png' })` succeeds inside the test run, yet the
  next tool call sees no such file (checked 2026-11-10: bash `printf > /tmp/x`, then `ls /tmp/x` in a
  new execution → missing; the same file under `tmp/` persists). The e2e worker's cwd is the repo
  root, so the relative `tmp/<name>.png` path above lands in the workspace.
- Repeat at a phone viewport (`{ width: 390, height: 844 }`, `fullPage: true`) and assert the page
  does not scroll sideways:
  `page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)`
  ≤ 1.
- Delete the seeded rows in the test (`DELETE … WHERE filename LIKE '<prefix>-%'`) and then delete the
  throwaway `*.test.e2e.ts` — it is a verification artifact, not a test to ship.

## Capture a stack swallowed by a crash card

When the client runtime catches a render/DOM error and renders its own error card, Playwright's `pageerror` and console listeners only see the message, never the stack — the app's `try/catch` consumes the exception.

Wrap the throwing DOM API in `page.addInitScript` (runs before app code, re-arms per document) and stash the stack on `window`:

```ts
await page.addInitScript(() => {
  const orig = (Node.prototype as any).insertBefore
  ;(Node.prototype as any).insertBefore = function (node: Node, child: Node | null) {
    try {
      return orig.call(this, node, child)
    } catch (e: any) {
      ;(window as any).__ibStack = e.stack
      ;(window as any).__ibParent = this.nodeName
      ;(window as any).__ibNode = node.nodeName
      throw e
    }
  }
})
```

Drive until the card shows, then read `window.__ibStack`.

- Wrapping **one method** is enough when the message names it (`Node.insertBefore`); otherwise wrap `insertBefore`/`appendChild`/`removeChild` together.
- Capture `this.nodeName`/`node.nodeName` to answer "inserted what into where" (`#text` into `#document`).
- This works because the card replaces content client-side without navigation; if the failure navigates, write to `sessionStorage` instead (it survives same-origin navigation) — `addInitScript` re-arms each document.
- The stack shows the full async chain; in the real case it revealed SSE `invalidate` → `window.location.reload()` → Navigation-API interception → frame reload → stream diff.

## Rendered HTML escapes `&` in test assertions

`assert.ok(text.includes('?filter=enabled&sort=name&order=asc'))` fails even though the component renders that URL. `response.text()` returns serialized HTML, and `&` in attribute values becomes `&amp;`:

```html
<a href="/admin/users?filter=enabled&amp;sort=name&amp;order=asc">Aktiv</a>
```

Match the escaped form:

```ts
let text = await response.text()
assert.ok(
  text.includes('?filter=enabled&amp;sort=name&amp;order=asc'),
  'Aktiv tab should reset the offset',
)
```

- `&` → `&amp;` (and `"` → `&quot;`) in rendered attribute values; absence assertions need the escaped form too.
- Prefer asserting a redirect `Location` header when possible — headers keep the raw `&` and are not HTML-escaped.

## When to Use

- You are about to verify a UI change against the running dev server and the path includes a delete/reset/confirm control.
- A control arms on the first click and confirms on the second; a scripted double-click is a live delete.
- A crash card hides the real exception stack from `pageerror`/console.
- An assertion on an `href`/`action`/query string in rendered HTML fails unexpectedly.
- You need a screenshot to check a UI change's placement or responsive layout without touching the
  dev server (and `/tmp` images vanish between agent tool calls).
