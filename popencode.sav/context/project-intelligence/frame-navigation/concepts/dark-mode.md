<!-- Context: frame-navigation/concepts/dark-mode | Priority: medium | Version: 1.0 | Updated: 2026-03-25 -->

# Dark Mode Implementation

**Purpose**: Theme toggle that persists preference to localStorage and applies via `data-theme` attribute on `<html>`.

---

## Core Concept

Dark mode uses CSS custom properties with `[data-theme='dark']` selectors. ThemeToggle component manages preference client-side; server renders initial theme based on cookie.

---

## Key Points

- Theme stored in localStorage (`lms-admin-theme`)
- System preference detected via `prefers-color-scheme: dark`
- `data-theme='dark'` attribute toggled on `<html>` element
- CSS variables provide semantic colors (light → dark values)
- All pages share same CSS file, dark mode is pure CSS

---

## ThemeToggle Component

```tsx
// app/assets/theme-toggle.tsx
const STORAGE_KEY = 'lms-admin-theme'
type Theme = 'light' | 'dark'

function getInitialTheme(): Theme {
  let stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'dark' || stored === 'light') return stored
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
  return 'light'
}

function applyTheme(theme: Theme) {
  localStorage.setItem(STORAGE_KEY, theme)
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
}
```

---

## CSS Structure

```css
/* Light mode - default */
:root {
  --bg-primary: #ffffff;
  --text-primary: #0f172a;
  /* ... */
}

/* Dark mode */
[data-theme='dark'] {
  --bg-primary: #0f172a;
  --text-primary: #f8fafc;
  /* ... */
}

/* Components use variables */
.card {
  background-color: var(--bg-primary);
  color: var(--text-primary);
}
```

---

## Dark Mode Override Pattern

```css
/* Base component styles */
.component {
}

/* Dark mode variants */
[data-theme='dark'] .component {
  background-color: var(--bg-primary);
  border-color: var(--border-default);
}
```

---

## Files

| File                          | Purpose                                          |
| ----------------------------- | ------------------------------------------------ |
| `app/assets/theme-toggle.tsx` | ThemeToggle client component                     |
| `app/lib/Layout.tsx`          | Includes ThemeToggle in sidebar                  |
| `public/admin.css`            | All CSS variables + dark overrides (~2700 lines) |

---

## Reference

- MDN: `prefers-color-scheme` media query
- CSS Custom Properties: `var(--name)`
