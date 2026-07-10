# Navbar Active Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add active-route highlighting to the bookstore navbar by reading the current request URL inside `Layout()`.

**Architecture:** Use `getContext()` from `remix/async-context-middleware` to access `context.request.url` inside the `Layout()` render function. Compare each nav link's path against the current pathname with an `isActive()` helper. Apply `nav-active` CSS class to the matching link.

**Tech Stack:** Remix 3 (Remix), TypeScript, CSS

---

### File Structure

| File                          | Action | Responsibility                                                                                   |
| ----------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| `bookstore/app/ui/layout.tsx` | Modify | Add `getContext` import, path tracking, `isActive()` helper, and `nav-active` class on nav links |
| `bookstore/public/app.css`    | Modify | Add `.nav-active` styles                                                                         |

---

### Task 1: Add active-route logic to Layout

**Files:**

- Modify: `bookstore/app/ui/layout.tsx`
- Modify: `bookstore/public/app.css`

- [ ] **Step 1: Add `getContext` import to `layout.tsx`**

Add this import at the top of `bookstore/app/ui/layout.tsx`, alongside the existing imports:

```typescript
import { getContext } from 'remix/async-context-middleware'
```

- [ ] **Step 2: Add path tracking and `isActive()` helper**

Inside the inner render function of `Layout()`, right after `let user = getCurrentUserSafely()`, add:

```typescript
// Get current path from request context
let currentPath = ''
try {
  let context = getContext()
  currentPath = new URL(context.request.url).pathname
} catch {
  /* SSR-only — ignored in non-request contexts */
}

// Match nav links — exact match OR sub-route prefix
let isActive = (path: string) => {
  if (!currentPath) return false
  if (currentPath === path) return true
  return currentPath.startsWith(path + '/')
}
```

- [ ] **Step 3: Apply `nav-active` class to each `<a>` in the `<nav>`**

For each `<a>` in the `<nav>` block, add `class={isActive(href) ? 'nav-active' : undefined}`.

Change each nav link from:

```tsx
<a href={routes.home.href()}>Home</a>
```

to:

```tsx
<a href={routes.home.href()} class={isActive(routes.home.href()) ? 'nav-active' : undefined}>
  Home
</a>
```

The links to update:

- `routes.home.href()` → Home
- `routes.books.index.href()` → Books
- `routes.books1.href()` → Books1
- `routes.chat.index.href()` → Chat
- `routes.agent.index.href()` → Agent
- `routes.agent2.index.href()` → Agent2
- `routes.about.href()` → About
- `routes.checker.index.href()` → Checker
- `routes.uitry.index.href()` → UI Try
- `routes.contact.index.href()` → Contact
- `routes.cart.index.href()` → Cart
- `routes.account.index.href()` → Account
- `routes.auth.login.index.href()` → Login
- `routes.auth.register.index.href()` → Register

Do NOT add `nav-active` to:

- The `<h1><a href={routes.home.href()}>` (site title/brand, not a nav link)
- The Admin link (if admin): `routes.admin.index.href()` — this IS a nav link also: `routes.admin.index.href()` → Admin — add it.
- The Logout `<button>` (it's a form submit, not a nav link)

- [ ] **Step 4: Add `.nav-active` CSS class**

Add these styles to `bookstore/public/app.css`, after the existing `nav a:hover` rule (around line 79):

```css
nav a.nav-active {
  background: rgba(255, 255, 255, 0.2);
  font-weight: 600;
  border-bottom: 2px solid #fff;
}
```

Use `a.nav-active` selector (instead of just `.nav-active`) to avoid conflicts with non-nav elements.

- [ ] **Step 5: Verify the implementation**

Run the typecheck to make sure everything compiles:

```bash
pnpm run typecheck
```

Then check that the dev server starts:

```bash
pnpm run dev
```

Open the app in a browser, navigate between pages, and verify:

- Home highlights only on `/`
- Books highlights on `/books`, `/books/genre/fiction`, `/books/some-slug`
- About highlights only on `/about`
- Chat highlights on `/chat`
- Login highlights only on `/login`
- Account highlights on `/account`, `/account/settings`, `/account/orders`
- No link is highlighted on an unmatched route
- The brand/title link (📚 Bookstore) never gets highlighted

- [ ] **Step 6: Commit**

```bash
git add bookstore/app/ui/layout.tsx bookstore/public/app.css
git commit -m "feat: add active-route highlighting to navbar"
```
