---
name: remix3-cliententry-css-child-selectors
description: "Use parent-container CSS child selectors instead of passing mixin props to clientEntry components in Remix 3"
user-invocable: false
origin: auto-extracted
---

# Remix 3: ClientEntry CSS Child Selectors for Nested Buttons

**Extracted:** 2026-06-14
**Context:** Creating a joined "Edit | Del" button group where the parent needs to style child Button components inside a `clientEntry` component.

## Problem

`clientEntry` components extend `SerializableProps` — only JSON-serializable values can be passed as props. CSS `MixinDescriptor` objects (produced by `css()`) are **not** serializable, so you cannot pass `btnMix` or similar styling props to a `clientEntry` component.

This blocks the common pattern of creating a joined "Edit | Del" button group where the parent needs to style child Button components.

## Solution

Use **parent-container CSS with child selectors** instead of passing mixins as props:

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

`remix/ui` CSS-in-JS uses scoped selectors. The `&` in `css()` resolves to the generated scoped class. Combined with child combinators (`>`), you can precisely target nested elements without needing to pass CSS objects through serializable prop boundaries.

## When to Use

- Creating joined button groups where one button is a `clientEntry` component
- Styling children of a container that wraps `clientEntry` components
- Any pattern where you'd normally pass a CSS mixin as a prop but the child is a `clientEntry`
