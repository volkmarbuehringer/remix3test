# Responsive show/hide: one descriptor, width+pointer media, and the 800×400 browser suite

**Extracted:** 2026-11-04
**Context:** `/lists` compact-layout work (row action cluster/kebab, editor header, global header drawer) found three unrelated-looking hides failing for three different reasons. Code: `app/actions/lists/public/lists-styles.ts`, `app/actions/lists/public/lists-view.tsx`, `app/actions/lists/public/lists-client.tsx`, `app/ui/main-nav.tsx`.

## Problem

- A shared desktop-only `display: none` mixed into a control's base style does nothing, while the same mixin works on the parent.
- A touch-only treatment keyed on `(hover: none)` does not apply in a narrow mouse window.
- A browser component test flips because it runs at 800×400 and its JS fallback keys on rendered geometry instead of input capability.

## 1. Own the base display and the hide in one class

`css()` emits one `@layer rmx.<class>` sub-layer per class; sub-layer registration order decides, not specificity or the media query (mechanism: `cascade-layer-overrides.md`). A shared hide composes unpredictably with a base style that sets `display`:

```tsx
// The nav hides because navLinksCss registered before desktopOnlyCss…
<nav mix={[navLinksCss, desktopOnlyCss]} />
// …but the login CTA stays visible: navBtnCss registered after it.
<a mix={[navBtnCss, desktopOnlyCss]}>Anmelden</a>
```

Keep the base and the media rule in one descriptor, and wrap inert groups instead of hiding a control through a shared class:

```ts
const navCollapseCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
  '@media (max-width: 900px)': { display: 'none' },
})
```

Use `!important` on the contested `display` only when the two-class composition is unavoidable (vendor mixin).

## 2. `(hover: none)` is input capability, not viewport width

A 390×844 mouse window still matches `hover: hover`. The `/lists` row kept its 10rem right gutter for the hover cluster and the label measured **2px**; the touch context at the same width measured 92px. Use the combined query for layout-affecting touch treatment and keep hit-area sizing on pointer capability:

```ts
// lists-styles.ts
'@media (hover: none), (max-width: 900px)': { display: 'none' }        // hover cluster
'@media (hover: none), (max-width: 900px)': { display: 'inline-flex' } // kebab
'@media (hover: none)': { width: '44px', height: '44px' }             // touch hit area

// lists-view.tsx
'@media (hover: none), (max-width: 900px)': { paddingRight: theme.space.md } // gutter
```

Verify both contexts: a narrow mouse window and a touch context (`isMobile`/`hasTouch`). Header drawer (900px), card-header stack, and status-strip scroll are width layout decisions, not capability decisions.

## 3. Component browser tests run at 800×400

In this repo, `*.test.browser.tsx` runs in an 800×400 viewport even though `playwright.config.ts` sets none, so a new `max-width: 900px` rule applies in the browser suite. The `/lists` kebab became rendered at 800, the `offsetParent !== null` focus heuristic focused it, and the row-focus assertions failed. Branch on pointer capability:

```ts
let touchPointer = window.matchMedia('(hover: none)').matches
if (touchPointer && trigger && trigger.offsetParent !== null) { trigger.focus(); return }
row.focus()
```

After a breakpoint change, run the affected browser suite in addition to the e2e geometry test; use `page.setViewportSize` at 390/820/1440 for real-layout assertions.

## Verification

- Geometry e2e: `app/actions/lists/lists-compact-layout.test.e2e.ts` asserts label/composer/status-strip/header width, cluster-vs-kebab visibility, `documentElement.scrollWidth <= innerWidth`, and the notification bell at 390/820/1440.
- Measure with a real server: `getBoundingClientRect()` and `getComputedStyle()`; `renderToString` has no layout.
- Verify layer contests with CDP, not `document.styleSheets` (see `cascade-layer-overrides.md`).

## Related

- `references/remix3-css-and-layout/cascade-layer-overrides.md` — per-class layer mechanism and `!important`/later-layer escapes.
- `references/remix3-css-and-layout/hover-reveal.md` — hover/focus reveal selectors.
- `references/remix3-client-entries/lists-editor.md` — `/lists` row/menu/focus specifics updated by this delta.
- `remix3-tooling` § Testing → `references/remix3-testing/cliententry-browser-tests.md` — media branches depend on the Playwright viewport.
