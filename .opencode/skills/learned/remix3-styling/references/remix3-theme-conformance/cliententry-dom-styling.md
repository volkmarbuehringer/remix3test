# In clientEntry / Browser DOM Code

**Source:** `remix3-theme-object-conformance`, `remix3-theme-css-variable-prefix`

Stream files and other non-component DOM code build style strings by hand. Import `theme` and interpolate the token names — it is a plain frozen object of strings, safe to import client-side:

```ts
// GOOD
icon.style.color = theme.colors.action.primary.background
card.style.cssText = `border:1px solid ${theme.colors.border.default};background:${theme.surface.lvl1}`
```

This keeps type-checking (the key must exist on the contract) while still resolving per-theme.

### Do not re-wrap the token (`var(${theme.…})`)

Because `theme.*` leaves already include `var(...)`, wrapping them again produces
`var(var(--rmx-…))`. The parser drops the **whole** declaration — assigning to
`element.style.x` rejects it outright — and the element silently falls back to
the cascade: no background, no border, inherited text colour. Two reasons it
survives review: the source contains no `var(--rmx-` literal, so
`check-theme-conformance` stays green, and the code *looks* like correct token
usage.

Recorded 2026-09-10: the uploads pending-file chips shipped like this —
`chipStyle` (`background`, `border`), `chipSizeStyle.color` and the chip remove
button's `color` in `app/actions/admin/public/admin-uploads-dropzone.tsx` were
all dead declarations, so the chips rendered as bare text with no pill chrome.
Now asserted against the resolved tokens in
`app/actions/admin/uploads/uploads-dropzone.test.e2e.ts`.
