<!-- Context: project-intelligence/newapp/guides/showcase-registry | Priority: high | Version: 2.0 | Updated: 2026-05-13 -->

# Guide: Showcase Registry Pattern

**Core Idea**: UI showcase sub-routes (`/ui/:component`) are driven by typed `SHOWCASE_PAGES` and `SHOWCASE_SECTIONS` records instead of an if/else chain. Adding a showcase page means adding one entry — no controller changes. The sections array also drives dynamic nav items in the header.

---

## The Registry

`app/ui/showcase-registry.ts` defines typed contracts:

```tsx
// Typed page/section IDs — add new ones here when adding pages
export type ShowcasePageId = 'button' | 'form' | 'theme'
export type ShowcaseSectionId = 'components' | 'theme'

type ShowcaseComponent = (handle?: any) => () => RemixNode

export type ShowcasePageEntry = {
  description: string
  eyebrow: string
  label: string
  navLabel?: string           // optional shorter label for nav bar
  path: string                // e.g. '/ui/button'
  render: ShowcaseComponent   // was 'component' in v1, renamed
  sectionId: ShowcaseSectionId
}

export type ShowcaseSection = {
  id: ShowcaseSectionId
  label: string
  pageIds: ReadonlyArray<ShowcasePageId>
}
```

### Sections (NEW)

`SHOWCASE_SECTIONS` groups pages into navigable categories — used by `nav.ts` to build dynamic nav items:

```tsx
export const SHOWCASE_SECTIONS = [
  { id: 'components', label: 'Components', pageIds: ['button', 'form'] as const },
  { id: 'theme', label: 'Theme Tokens', pageIds: ['theme'] as const },
] as const satisfies ReadonlyArray<ShowcaseSection>
```

### Page Entries

`SHOWCASE_PAGES` uses typed keys (`ShowcasePageId`), not `Record<string, ...>`:

```tsx
export const SHOWCASE_PAGES: Record<ShowcasePageId, ShowcasePageEntry> = {
  button: {
    render: ShowcaseButtonPage,
    description: 'Primary, ghost, and danger variants.',
    eyebrow: 'Component',
    label: 'Button',
    path: '/ui/button',
    sectionId: 'components',
  },
  form: {
    render: ShowcaseFormPage,
    description: 'Input fields, focus states, and error states.',
    eyebrow: 'Component',
    label: 'Form',
    path: '/ui/form',
    sectionId: 'components',
  },
  theme: {
    render: ShowcaseThemePage,
    description: 'Surface levels, colors, spacing, and typography.',
    eyebrow: 'Theme',
    label: 'Theme Tokens',
    path: '/ui/theme',
    sectionId: 'theme',
  },
}
```

## How It Works

1. **Controller reads** `SHOWCASE_PAGES[context.params.component as ShowcasePageId]` in the `uiComponent` action
2. **Missing slug** returns 404 immediately — no fallthrough to stale handlers
3. **Index page** (`/ui`) iterates `Object.entries(SHOWCASE_PAGES)` to render link cards
4. **Nav bar** (`app/ui/nav.ts`) uses `SHOWCASE_SECTIONS.flatMap(...)` to build dynamic nav links — adding a section entry auto-adds nav items

Controller (`app/actions/controller.tsx`):

```tsx
uiComponent(context) {
  let render = context.get(Renderer)!
  let page = SHOWCASE_PAGES[context.params.component as ShowcasePageId]
  if (!page) return new Response('Not Found', { status: 404 })
  return render(
    <Layout>
      <page.render />    {/* ← was page.component() in v1 */}
    </Layout>,
  )
},
```

Index page renders link cards from the registry (same pattern as v1):

```tsx
{Object.entries(SHOWCASE_PAGES).map(([slug, page]) => (
  <ShowcaseLinkCard
    key={slug}
    eyebrow={page.eyebrow}
    title={page.label}
    description={page.description}
    href={`/ui/${slug}`}
  />
))}
```

### Nav Bar Integration

`app/ui/nav.ts` reads `SHOWCASE_SECTIONS` to build the "Showcase" nav group dynamically:

```tsx
import { SHOWCASE_SECTIONS, SHOWCASE_PAGES } from './showcase-registry.ts'

export const NAV_SECTIONS = [
  {
    id: 'pages',
    label: 'Pages',
    items: [
      { label: 'Home', href: '/' },
      { label: 'AI', href: '/ai' },
      { label: 'Admin', href: '/admin', adminOnly: true },
    ],
  },
  {
    id: 'showcase',
    label: 'Showcase',
    items: [
      { label: 'Overview', href: '/ui' },
      ...SHOWCASE_SECTIONS.flatMap((section) =>
        section.pageIds.map((id) => ({
          label: SHOWCASE_PAGES[id].navLabel ?? SHOWCASE_PAGES[id].label,
          href: SHOWCASE_PAGES[id].path,
        })),
      ),
    ],
  },
]
```

## Adding a Showcase Page

1. Create the page component in `app/ui/showcase-pages.tsx` (or a new file)
2. Add the page ID to the `ShowcasePageId` type union
3. Add the section ID to `ShowcaseSectionId` (if new section) or use existing
4. Add entry to `SHOWCASE_PAGES` with all fields (`path`, `sectionId`, `render`, etc.)
5. If a new section: add entry to `SHOWCASE_SECTIONS` with the page ID listed
6. **No changes** to `controller.tsx` or `routes.ts` needed
7. Nav items auto-appear via the `SHOWCASE_SECTIONS.flatMap()` in `nav.ts`

## Key Changes from v1

| Aspect | v1 (generic) | v2 (typed, sectioned) |
|--------|-------------|----------------------|
| Page IDs | `string` | `'button' \| 'form' \| 'theme'` (literal union) |
| Sections | None | `SHOWCASE_SECTIONS` array with `pageIds` |
| Component field | `component` | `render` |
| Path | Hardcoded in controller | `path` field in entry |
| Nav integration | Manual | Data-driven via `SHOWCASE_SECTIONS` |
| Controller lookup | `as string` | `as ShowcasePageId` |

## Scope: UI Showcase Only

This registry pattern is intentionally **scoped to the UI showcase** (`/ui/:component`). It is NOT a general-purpose routing mechanism. The decision to keep it scoped:

- Keeps the change small and self-contained
- Avoids premature abstraction of the routing layer
- If a pattern emerges across multiple route groups, extract into a shared utility

## Why Registry > if/else

| Concern | if/else chain | Registry record |
|---------|---------------|-----------------|
| Adding a page | New `if [...]` branch | One record entry (+ type union) |
| 404 handling | Must add else clause manually | Automatic: `if (!page) return 404` |
| Index page | Hardcoded link list | `Object.entries()` iteration |
| Nav items | Must add nav entries manually | Auto-generated from `SHOWCASE_SECTIONS` |
| Readability | Scattered conditionals | Single data structure |

## 📂 Codebase References

- **Registry**: `app/ui/showcase-registry.ts` — `SHOWCASE_PAGES` + `SHOWCASE_SECTIONS` + types
- **Consumer**: `app/actions/controller.tsx` — `uiComponent` action delegates to registry
- **Consumer**: `app/ui/showcase-pages.tsx` — `ShowcaseIndexPage` iterates registry for link cards
- **Consumer**: `app/ui/nav.ts` — Builds "Showcase" nav group from `SHOWCASE_SECTIONS` + `SHOWCASE_PAGES`
- **Tests**: `app/ui/showcase-registry.test.ts` — Verifies entries, sections, completeness

## Related

- [Nav registry pattern](./nav-registry.md) — Nav registry (`NAV_SECTIONS`) that reads from this one
- [App architecture](../concepts/architecture.md) — Controller delegates to page modules
