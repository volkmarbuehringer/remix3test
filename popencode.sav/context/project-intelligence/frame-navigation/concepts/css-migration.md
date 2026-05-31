<!-- Context: frame-navigation/concepts/css-migration | Priority: medium | Version: 1.0 | Updated: 2026-03-25 -->

# CSS Class Migration Guide

**Purpose**: Convert inline `css()` styles to CSS classes for dark mode compatibility.

---

## Why Migrate?

Inline `css()` styles in Remix components can't respond to `[data-theme='dark']`. CSS classes in `admin.css` can.

---

## Migration Steps

### 1. Identify Inline Styles

```tsx
// ❌ Before - inline style
let titleStyle = css({
  color: '#0f172a',           // hardcoded
  backgroundColor: '#ffffff',  // hardcoded
})

// ✅ After - CSS class
// In admin.css:
.main-page-title {
  color: var(--text-primary);
  background-color: var(--bg-primary);
}

// In component:
<h1 class="main-page-title">Title</h1>
```

### 2. Define CSS Variables

```css
/* In admin.css :root */
:root {
  --text-primary: #0f172a;
  --bg-primary: #ffffff;
  /* ... */
}

[data-theme='dark'] {
  --text-primary: #f8fafc;
  --bg-primary: #0f172a;
  /* ... */
}
```

### 3. Create Component Classes

```css
/* Group related components */
.component-name {
}
.component-title {
}
.component-body {
}

/* Dark mode */
[data-theme='dark'] .component-name {
}
[data-theme='dark'] .component-title {
}
```

### 4. Update Component

```tsx
// ❌ Before
export function Component() {
  return () => (
    <div mix={containerStyle}>
      <h1 mix={titleStyle}>Title</h1>
    </div>
  )
}

// ✅ After
export function Component() {
  return () => (
    <div class="component-container">
      <h1 class="component-title">Title</h1>
    </div>
  )
}
```

---

## Common Class Patterns

| Pattern           | Purpose                 |
| ----------------- | ----------------------- |
| `.page-*`         | Page-level elements     |
| `.main-*`         | Main app layout         |
| `.settings-*`     | Settings pages          |
| `.stat-*`         | Dashboard stats         |
| `.course-*`       | Course cards            |
| `.notification-*` | Notification components |

---

## Invalid CSS Properties Warning

Remix's `css()` function only accepts valid CSS properties. Using invalid properties like `class` will cause browser warnings:

```typescript
// ❌ Invalid - 'class' is not a CSS property
const tableStyle = css({
  width: '100%',
  borderCollapse: 'collapse',
  class: 'table-compact',  // ERROR: Unknown property 'class'
})

// ✅ Correct - use CSS classes via class attribute
const tableStyle = css({
  width: '100%',
  borderCollapse: 'collapse',
})
// Then in JSX: <table class="table-compact" mix={tableStyle}>
```

The browser will show: `Unknown property 'class'. Declaration ignored.`

---

## Verification

1. Check dark mode: Toggle theme, verify colors change
2. TypeScript: Run `pnpm typecheck`
3. Build: Run esbuild for client components
4. No inline styles: `grep -r "css({" app/**/*.tsx` should find none

---

## Files Changed

| File                 | Change                 |
| -------------------- | ---------------------- |
| `app/lib/Layout.tsx` | Inline → CSS classes   |
| `app/main/*.tsx`     | Inline → CSS classes   |
| `app/settings/*.tsx` | Inline → CSS classes   |
| `public/admin.css`   | ~300 new classes added |
