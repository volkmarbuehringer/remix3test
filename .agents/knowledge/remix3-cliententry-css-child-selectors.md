---
title: "Remix 3 ClientEntry Parent CSS Child Selectors for Nested Buttons"
tags: [remix3, clientEntry, css, serialization, button-group]
created: 2026-06-03
status: active
---

## Problem

`clientEntry` components extend `SerializableProps` — only
JSON-serializable values can be passed as props. CSS `MixinDescriptor`
objects (produced by `css()`) are **not** serializable, so you cannot
pass `btnMix` or similar styling props to a `clientEntry` component.

This blocks the common pattern of creating a joined "Edit | Del" button
group where the parent needs to style child Button components.

## Solution

Use **parent-container CSS with child selectors** instead of passing
mixins as props:

```tsx
const actionBtnGroup = css({
  display: 'inline-flex',
  alignItems: 'stretch',
  '& > a > button': {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderRight: 'none',
  },
  '& > form > button': {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
})

// Usage — no mix props needed on DelButton
<div mix={actionBtnGroup}>
  <a href={editUrl}>
    <Button tone="secondary" mix={smallBtnStyle}>Edit</Button>
  </a>
  <DelButton action={delUrl} offset={...} sort={...} order={...} filterValue={...} />
</div>
```

The CSS targets the known DOM structure:
- Edit button is inside `<a><button/></a>` → `& > a > button`
- Del button is inside `<form><button/></a>` (from DelButton) → `& > form > button`

## Why

`remix/ui` CSS-in-JS uses scoped selectors. The `&` in `css()` template
literals resolves to the generated scoped class. Combined with child
combinators (`>`), you can precisely target nested elements without
needing to pass CSS objects through serializable prop boundaries.
