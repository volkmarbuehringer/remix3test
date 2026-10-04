# Server-rendered view switching inside a `<Frame>`

**Extracted:** 2026-10-04

**Context:** Replacing a page-wide tab `clientEntry` (four `hidden` panels +
`aria-selected` + hash deep-linking) with URL-addressable, frame-swapped sections.
Verified on `/settings`: `app/ui/settings-enhance.browser.tsx` (283 lines) + its
376-line test deleted; `app/actions/settings/controller.tsx` net +4 lines.

## Problem

A page renders mutually exclusive sections (tabs/steps) and a `clientEntry` toggles
them. The client version carries a lot of code — `hidden` handling, hash ↔ server
reconciliation, roving tabindex, focus-banner ordering, `media (scripting: none)`.
If each section is server-renderable and URL-addressable, the whole thing can be a
blocking `<Frame>` plus `data-rmx-target` links, with no page `clientEntry`.

The obvious attempt fails non-obviously: **a frame's content is fetched by a separate
GET that never sees the POST action's state.** A validation error or success message
passed to the POST render is dropped, because the POST response's `<Frame src>`
resolves its own `index` action.

## Solution

### 1. Active view in the URL — query, not hash

Since remix #11940 a hash-only change does not reload a frame, so `#tab` cannot
drive one. Use `?tab=`/`?step=` and validate server-side.

### 2. Blocking `<Frame>` (no `fallback`)

`@tsx
<Frame name={frames.settingsPanel} src=`${{routes.settings.index.href()}?tab=${{activeTab}`} />
`@

No `fallback` means the server waits and serializes the section into the initial
HTML, so first paint and no-JS both show the active section.

### 3. Branch on `X-Remix-Target` — three render shapes

`@tsx
function SettingsView(handle: Handle<SettingsViewProps>) {
  return () => {
    let { isFrame, inline, ...props } = handle.props
    if (isFrame) return <SettingsTabs {...props} />       // frame GET → fragment only
    if (inline) {                                         // full-document POST
      return (
        <Layout title="Einstellungen">
          <PageSection title="Einstellungen" titleHidden description="…">
            <SettingsTabs {...props} />
            <PasswordToggle />
            <ConfirmDelete />
          </PageSection>
        </Layout>
      )
    }
    return <SettingsPage {...props} />                    // full GET → shell + Frame
  }
}
`@

- frame GET → fragment only, **no** `Layout` and **no** nested `<Frame>` (omitting
  this re-renders the shell inside the frame: the double-load/nesting failure);
- full GET → shell + `<Frame>`;
- full-document POST → section **inline**.

Set `isFrame` once per action from
`context.request.headers.get('X-Remix-Target')`; pass `inline` only on the POST
action's render sites.

### 4. Links and forms

`@tsx
<a href=`${{routes.settings.index.href()}?tab=${{tab.id}`}
   aria-current={active ? 'page' : undefined}
   data-rmx-target={frames.settingsPanel}>…</a>

<form action={routes.settings.action.href()} method="POST"
      data-rmx-target={frames.settingsPanel}>…</form>
`@

### 5. The trap: full-document POST must render inline

The POST action's `<Frame src="/settings?tab=password">` resolves a fresh
`GET /settings?tab=password` through `index`, which never got
`passwordError`/`passwordSuccess`/`deleteError`. Symptom: `POST /settings`
(no `X-Remix-Target`) returns 200 but the banner is absent; tests fail
(`should show success message`), and no-JS users lose validation entirely. Fix =
the `inline` branch. With the runtime the form targets the frame and the action's
`SettingsTabs` fragment carries the state; without it the inline branch does.

### 6. What the deleted clientEntry did, and what replaces it

| Client responsibility | Replacement |
| --- | --- |
| Tab show/hide + URL | server `?tab=` + blocking frame + `data-rmx-target` |
| Live complexity / match | **server** validation + per-field errors; a static rules list is guidance — use neutral bullets (`•`), not `○` |
| Password eye toggles | inline `PasswordToggle` script (document-level, survives frame swaps) |
| Submit-busy / banner focus | dropped; `role="alert"` still announces |
| Delete confirmation | `ConfirmDelete` clientEntry remains (or rely on `required`) |

Server validation is authoritative; only *pre-submit* live feedback is lost.

### 7. Accessibility

Without the keyboard JS you cannot implement the APG tabs pattern (roving
`tabindex`, Arrow/Home/End). Prefer `<nav>` + `aria-current="page"` over
`role="tab"`. See `remix3-client-entries` → `references/aria-tabs.md` for the
clientEntry version this replaces.

## Profitability — a conversion only *reduces* code if it deletes a `clientEntry`

**Context:** `/appointments/new`, 2026-10-04. A follow-up framed the
period/status/sort/pagination controls, then the create/delete panel + wizard.
Net result: production **+95**, tests **+430**, client **+14** (`AppointmentsNewStep2Live`
hardening), and **no** `.browser.*`/`clientEntry` file deleted.

Cause: the controls were already server-rendered `<a href>`/`<form>` elements —
there was no URL-building/toggling JS left to delete. The pattern's cost
(`data-rmx-target` attributes, `isFrame`/`inline` render branches, tests) has
nothing to offset it.

**Rule before starting:** the reduction in this pattern is the deleted
`clientEntry` (the settings case removed 283 production + 376 test lines). If the
candidate is already a server link/form, the conversion is **capability, not
reduction** — it removes full-document navigations, it does not shrink code.

1. Check whether a `clientEntry`/`.browser.*` file will actually be deleted. No
   deletion ⇒ expect a net LOC increase; say so before starting.
2. Estimate: added `data-rmx-target` attributes + controller `isFrame`/`inline`
   branches + server/browser/e2e tests **vs** the deleted client entry + its tests.
3. Genuine client code (live filter, pre-submit feedback, scroll lock/reveal) stays:
   converting it adds server code *and* keeps the enhancement, so it is never a reduction.
4. For a smaller client bundle, the real levers are deleting the enhancement
   (server-rendered confirm may already cover its value) or making the filter a
   server GET form — not wrapping an already-server page in a frame.

**Report wording:** distinguish "moved view state into the URL + Frame" from
"reduced client-side code". They are not the same claim.

## When to Use

- Two or more mutually exclusive sections, each server-renderable and
  URL-addressable, currently toggled by a `clientEntry` over `hidden` panels.
- You want tabs/steps to survive no-JS and add no page `clientEntry`.
- A frame-swapped section's POST validation/success message "disappears".

Do **not** use for transient DOM (expand/collapse), drag/drop, autosave editors,
streaming, dropdowns/modals that do not change the URL, or latency-free switches.

## Verification

- Fragment: `router.fetch(url, { headers: { 'X-Remix-Target': frames.x } })` returns
  the section with no document shell (`!html.includes('<html')`).
- Full GET: tab links with `aria-current` on exactly the active one; only the active
  panel.
- Full-document POST (no frame header): contains the error/success message.
- Switching/keyboard need a browser check; server tests only see HTML.

## Validated

- 2026-10-04 in `/home/lucky/remix3test`: `/settings` frame tabs, 19 server tests
  green, full suite 2136 tests / 0 fail. The trap appeared as 7 failing tests
  (`should show success message`) and was fixed by the `inline` branch.
