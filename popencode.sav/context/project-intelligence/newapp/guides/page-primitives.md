<!-- Context: project-intelligence/newapp/guides/page-primitives | Priority: high | Version: 1.0 | Updated: 2026-05-11 -->

# Guide: Shared Page Primitives

**Core Idea**: Consistent page structure uses a small vocabulary of reusable components (`PageSection`, `ShowcaseLinkCard`) and CSS constants (`panelCss`, `pageStackCss`, `bodyTextCss`, etc.) — so every page gets consistent spacing, typography, and layout without reinventing per-page.

---

## Primitives in `app/ui/page-primitives.tsx`

### PageSection

A labeled section with optional title and description:

```tsx
import { PageSection } from '~/ui/page-primitives.tsx'

<PageSection
  title="Section Title"
  description="Optional description text"
>
  {/* Section content */}
</PageSection>
```

Renders:
```
<section>
  <header>
    <h2>Section Title</h2>       (optional)
    <p>Optional description</p>  (optional)
  </header>
  {children}
</section>
```

### ShowcaseLinkCard

An anchor card with eyebrow, title, and description:

```tsx
<ShowcaseLinkCard
  eyebrow="Component"
  title="Button"
  description="Primary, ghost, and danger variants."
  href="/ui/button"
/>
```

Composes `panelCss` + `linkCardCss` for consistent card appearance.

---

## Shared CSS Constants

The same file exports CSS constants used across pages:

| Export | Purpose |
|--------|---------|
| `panelCss` | Panel with border, bg, shadow, padding |
| `panelInsetCss` | Inset panel variant (darker bg) |
| `panelElevatedCss` | Elevated panel variant (stronger shadow) |
| `panelHeaderCss` | Vertical stack header layout |
| `panelBodyCss` | Content body with gap |
| `pageStackCss` | Top-level page vertical stack (xxl gap) |
| `featureGridCss` | Feature card grid (lg gap) |
| `exampleGridCss` | Example/component grid (lg gap) |
| `bodyTextCss` | Body text (sm size, secondary color) |
| `eyebrowTextCss` | Eyebrow label (xxxs, uppercase, meta spacing) |
| `panelTitleTextCss` | Section title (lg, semibold) |
| `panelDescriptionTextCss` | Section description (sm, secondary) |
| `captionTextCss` | Caption (xs, muted) |

---

## Usage Pattern

Every page follows this structure:

```tsx
export function MyPage() {
  return () => (
    <div mix={pageStackCss}>          // ← top-level vertical stack
      <PageSection                     // ← labeled section
        title="My Section"
        description="About this section"
      >
        <div mix={exampleGridCss}>    // ← grid for cards/items
          <ShowcaseLinkCard ... />     // ← link cards
          {/* or other content */}
        </div>
      </PageSection>
    </div>
  )
}
```

## When to Add a New Primitive

Add a shared CSS constant or component when the same pattern appears in 2+ pages. Start with per-page CSS, then extract once duplicated. Avoid premature abstraction.

## 📂 Codebase References

- **Primitives file**: `app/ui/page-primitives.tsx` — All component definitions + CSS constants
- **Consumer**: `app/ui/showcase-pages.tsx` — Showcase index, button, form, theme pages
- **Consumer**: `app/ui/scaffold-home-page.tsx` — Home page (uses parallel pattern with its own CSS)

## Related

- [Remix 3 layout patterns](../../development/remix3/ui/guides/layout.md) — General layout structure
- [Remix 3 app layout](../../development/remix3/ui/guides/app-layout.md) — App shell patterns
- [Dual theme pattern (remix3)](../../development/remix3/ui/guides/dual-theme-pattern.md) — Theme tokens referenced by CSS constants (`theme.space.*`, `theme.colors.*`)
