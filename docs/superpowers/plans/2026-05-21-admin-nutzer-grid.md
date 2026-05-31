# Admin Nutzer Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only admin grid at `/admin/nutzer` with sorting, filtering, and pagination over the `nutzer` + `login` join.

**Architecture:** Typed route → controller (raw SQL with parameterized queries) → SSR page component. Follows the `admin-lists` + `admin-messages` patterns.

**Tech Stack:** Remix 3, PostgreSQL (raw `pool.query`), Remix UI (SSR components, `css()` tagged templates, `theme` tokens).

---

### Task 1: Add nutzer route definition

**Files:**
- Modify: `app/routes.ts`

- [ ] **Step 1: Add nutzer route under adminRoutes**

Add the `nutzer` sub-route inside the `admin` route tree, after `lists`:

```typescript
    lists: route('lists', {
      index: get('/'),
      destroy: post('/:id/delete'),
    }),

    nutzer: route('nutzer', {
      index: get('/'),
    }),
```

The full section should look like:

```typescript
// Admin routes (separate tree, handled by their own controllers with admin middleware)
export const adminRoutes = route({
  admin: route('admin', {
    index: get('/'),

    chatlog: route('chatlog', {
      index: get('/'),
      destroy: post('/:id/delete'),

      fragments: route('fragments', {
        detail: get('/detail/:id'),
      }),
    }),

    messages: route('messages', {
      index: get('/'),
      action: post('/'),
      destroy: post('/:id/delete'),
      subscribe: get('/subscribe'),
    }),

    lists: route('lists', {
      index: get('/'),
      destroy: post('/:id/delete'),
    }),

    nutzer: route('nutzer', {
      index: get('/'),
    }),

    // Fragment routes for nested frame content
    fragments: route('fragments', {
      stats: get('/stats'),
      recentActivity: get('/recent-activity'),
      userDetail: get('/user-detail/:userId'),
    }),
  }),
})
```

- [ ] **Step 2: Verify the route compiles**

Run: `pnpm run typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/routes.ts
git commit -m "feat: add /admin/nutzer route definition"
```

---

### Task 2: Create the controller

**Files:**
- Create: `app/actions/admin-nutzer-controller.tsx`

This controller handles the `GET /admin/nutzer` request with:
- Parse `sort`, `order`, `offset`, `filter` from URL params
- Build a parameterized SQL join query with `WHERE ILIKE`, `ORDER BY`, `LIMIT/OFFSET`
- Pagination: fetch `PAGE_SIZE + 1` rows to detect `hasMore`

- [ ] **Step 1: Create the controller file**

```typescript
import { createController } from 'remix/router'

import { adminRoutes as routes } from '../routes.ts'
import { pool } from '../data/setup.ts'
import type { AppContext } from '../types/context.ts'
import { requireAuth } from '../middleware/auth.ts'
import { requireAdmin } from '../middleware/admin.ts'
import { renderAdminPage } from '../ui/admin-layout.tsx'
import { AdminNutzerPage } from '../ui/admin-nutzer-page.tsx'
import { parseSort } from '../utils/sort-params.ts'

const PAGE_SIZE = 10

const SORTABLE_COLUMNS = [
  'n_vorname',
  'n_name',
  'n_email',
  'n_verpflichtung',
  'l_login',
  'l_aktiv',
  'l_gesperrt',
  'l_letzte_login',
] as const

const SEARCH_COLUMNS = ['n_vorname', 'n_name', 'n_email', 'l_login']

export default createController<typeof routes.admin.nutzer, AppContext>(routes.admin.nutzer, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      let offset = Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
      let filter = context.url.searchParams.get('filter') || undefined

      let { column, direction } = parseSort(context.url, {
        allowedColumns: SORTABLE_COLUMNS,
        defaultColumn: 'n_name',
        defaultDirection: 'asc',
      })

      let query = `
        SELECT n_vorname, n_name, n_email, n_verpflichtung,
               l_login, l_passwort, l_aktiv, l_gesperrt, l_letzte_login
        FROM nutzer
        INNER JOIN login ON l_id = n_lid
      `

      let params: unknown[] = []
      let paramIndex = 0

      if (filter && filter.length <= 200) {
        paramIndex++
        let searchPattern = `%${filter}%`
        let conditions = SEARCH_COLUMNS.map((col) => `${col} ILIKE $${paramIndex}`)
        query += ` WHERE (${conditions.join(' OR ')})`
        params.push(searchPattern)
      }

      paramIndex++
      query += ` ORDER BY ${column} ${direction === 'desc' ? 'DESC' : 'ASC'}`
      query += ` LIMIT $${paramIndex}`
      params.push(PAGE_SIZE + 1)

      paramIndex++
      query += ` OFFSET $${paramIndex}`
      params.push(offset)

      let result = await pool.query(query, params)
      let rows = result.rows as Array<Record<string, unknown>>
      let hasMore = rows.length > PAGE_SIZE
      if (hasMore) rows = rows.slice(0, PAGE_SIZE)

      return renderAdminPage(
        context.render,
        'nutzer',
        <AdminNutzerPage
          rows={rows}
          offset={offset}
          hasMore={hasMore}
          prevOffset={Math.max(0, offset - PAGE_SIZE)}
          nextOffset={offset + PAGE_SIZE}
          sortColumn={column}
          sortDirection={direction}
          filter={filter}
        />,
      )
    },
  },
})
```

- [ ] **Step 2: Verify the controller type-checks**

Run: `pnpm run typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/actions/admin-nutzer-controller.tsx
git commit -m "feat: add admin-nutzer controller with SQL join, sort, filter, pagination"
```

---

### Task 3: Create the page component

**Files:**
- Create: `app/ui/admin-nutzer-page.tsx`

- [ ] **Step 1: Create the page component file**

```typescript
import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'

import { frames } from '../routes.ts'

interface NutzerRow {
  n_vorname: string | null
  n_name: string | null
  n_email: string | null
  n_verpflichtung: boolean
  l_login: string
  l_passwort: string | null
  l_aktiv: boolean
  l_gesperrt: boolean
  l_letzte_login: string | null
}

interface AdminNutzerPageProps {
  rows: NutzerRow[]
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
}

const SORTABLE_COLUMNS: Array<{ key: string; label: string }> = [
  { key: 'n_vorname', label: 'Vorname' },
  { key: 'n_name', label: 'Name' },
  { key: 'n_email', label: 'Email' },
  { key: 'n_verpflichtung', label: 'Verpflichtung' },
  { key: 'l_login', label: 'Login' },
  { key: 'l_aktiv', label: 'Aktiv' },
  { key: 'l_gesperrt', label: 'Gesperrt' },
  { key: 'l_letzte_login', label: 'Letzter Login' },
]

// ── Helpers ──

function sortArrow(field: string, sortField: string, sortOrder: 'asc' | 'desc'): string {
  if (field !== sortField) return '\u2195'
  return sortOrder === 'asc' ? '\u2191' : '\u2193'
}

function buildSortUrl(
  field: string,
  currentSort: string,
  currentOrder: 'asc' | 'desc',
  offset: number,
  filter?: string,
): string {
  let newOrder: 'asc' | 'desc' =
    field === currentSort ? (currentOrder === 'asc' ? 'desc' : 'asc') : 'asc'
  let params = new URLSearchParams()
  params.set('offset', '0')
  params.set('sort', field)
  params.set('order', newOrder)
  if (filter) params.set('filter', filter)
  return '/admin/nutzer?' + params.toString()
}

function buildPaginationUrl(
  newOffset: number,
  sort: string,
  order: 'asc' | 'desc',
  filter?: string,
): string {
  let params = new URLSearchParams()
  params.set('offset', String(newOffset))
  params.set('sort', sort)
  params.set('order', order)
  if (filter) params.set('filter', filter)
  return '/admin/nutzer?' + params.toString()
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return '\u2014'
  return new Date(ts).toLocaleString()
}

function boolLabel(val: boolean): string {
  return val ? 'Ja' : 'Nein'
}

// ── Styles ──

const pageStyle = css({
  maxWidth: '1000px',
})

const titleStyle = css({
  margin: 0,
  fontSize: theme.fontSize.xxl,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

const descriptionStyle = css({
  margin: `0 0 ${theme.space.lg}`,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
})

const filterBarStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  marginBottom: theme.space.md,
})

const filterInputStyle = css({
  flex: '1',
  maxWidth: '300px',
  padding: `${theme.space.xs} ${theme.space.sm}`,
  fontSize: theme.fontSize.sm,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  background: theme.surface.lvl0,
  color: theme.colors.text.primary,
  outline: 'none',
  '&:focus': {
    borderColor: theme.colors.action.primary.background,
    boxShadow: `0 0 0 2px ${theme.colors.focus.ring}`,
  },
  '&::placeholder': { color: theme.colors.text.muted },
})

const tableWrapStyle = css({
  marginBottom: theme.space.xl,
  background: theme.surface.lvl1,
  borderRadius: theme.radius.lg,
  border: `1px solid ${theme.colors.border.default}`,
  overflowX: 'auto',
})

const tableStyle = css({
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: theme.fontSize.sm,
})

const thStyle = css({
  textAlign: 'left',
  padding: `${theme.space.sm} ${theme.space.md}`,
  background: theme.surface.lvl2,
  color: theme.colors.text.secondary,
  fontWeight: theme.fontWeight.semibold,
  fontSize: theme.fontSize.xs,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  borderBottom: `1px solid ${theme.colors.border.default}`,
  whiteSpace: 'nowrap',
})

const thSortableStyle = css({
  textAlign: 'left',
  padding: `${theme.space.sm} ${theme.space.md}`,
  background: theme.surface.lvl2,
  borderBottom: `1px solid ${theme.colors.border.default}`,
  whiteSpace: 'nowrap',
})

const sortLinkStyle = css({
  color: theme.colors.text.secondary,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  fontWeight: theme.fontWeight.semibold,
  fontSize: theme.fontSize.xs,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  '&:hover': { color: theme.colors.text.primary },
})

const sortArrowStyle = css({
  display: 'inline-block',
  fontSize: '0.7rem',
  lineHeight: '1',
  color: theme.colors.text.muted,
})

const sortArrowActiveStyle = css({
  display: 'inline-block',
  fontSize: '0.8rem',
  lineHeight: '1',
  color: theme.colors.action.primary.background,
  fontWeight: theme.fontWeight.bold,
})

const tdStyle = css({
  padding: `${theme.space.sm} ${theme.space.md}`,
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
  color: theme.colors.text.primary,
  verticalAlign: 'middle',
})

const tdMonoStyle = css({
  padding: `${theme.space.sm} ${theme.space.md}`,
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
  color: theme.colors.text.muted,
  verticalAlign: 'middle',
  fontFamily: theme.fontFamily.mono,
  fontSize: theme.fontSize.xs,
})

const boolBadgeYes = css({
  display: 'inline-block',
  padding: `2px ${theme.space.sm}`,
  borderRadius: theme.radius.full,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
})

const boolBadgeNo = css({
  display: 'inline-block',
  padding: `2px ${theme.space.sm}`,
  borderRadius: theme.radius.full,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  background: theme.surface.lvl3,
  color: theme.colors.text.muted,
})

const clearLinkStyle = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
  textDecoration: 'none',
  '&:hover': {
    color: theme.colors.text.primary,
    textDecoration: 'underline',
  },
})

const emptyStateStyle = css({
  textAlign: 'center',
  padding: theme.space.xxl,
  color: theme.colors.text.muted,
})

const paginationStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: theme.space.md,
  background: theme.surface.lvl0,
  borderRadius: theme.radius.md,
  border: `1px solid ${theme.colors.border.default}`,
})

const paginationInfoStyle = css({
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.muted,
})

const pageLinkStyle = css({
  padding: `${theme.space.sm} ${theme.space.md}`,
  background: theme.surface.lvl2,
  color: theme.colors.text.secondary,
  borderRadius: theme.radius.md,
  fontSize: theme.fontSize.sm,
  textDecoration: 'none',
  '&:hover': {
    background: theme.surface.lvl3,
    color: theme.colors.text.primary,
  },
})

const pageLinkDisabledStyle = css({
  padding: `${theme.space.sm} ${theme.space.md}`,
  borderRadius: theme.radius.md,
  fontSize: theme.fontSize.sm,
  opacity: 0.4,
  cursor: 'not-allowed',
  pointerEvents: 'none',
})

const maskedStyle = css({
  color: theme.colors.text.muted,
  letterSpacing: '0.1em',
  fontFamily: theme.fontFamily.mono,
})

// ── Component ──

export function AdminNutzerPage(handle: Handle<AdminNutzerPageProps>) {
  return () => {
    let { rows, offset, hasMore, prevOffset, nextOffset, sortColumn, sortDirection, filter } =
      handle.props
    let pageStart = rows.length > 0 ? offset + 1 : 0
    let pageEnd = offset + rows.length

    return (
      <div mix={pageStyle}>
        <h2 mix={titleStyle}>Nutzer</h2>
        <p mix={descriptionStyle}>
          Übersicht aller Nutzer mit Login-Daten. Sortierbar, filterbar, read-only.
        </p>

        {/* Filter bar */}
        <form method="GET" action="/admin/nutzer" mix={filterBarStyle}>
          <input
            type="text"
            name="filter"
            placeholder="Suche nach Name, Email oder Login..."
            defaultValue={filter ?? ''}
            mix={filterInputStyle}
          />
          <button
            type="submit"
            mix={css({
              padding: `${theme.space.xs} ${theme.space.md}`,
              background: theme.colors.action.primary.background,
              color: theme.colors.action.primary.foreground,
              border: 'none',
              borderRadius: theme.radius.md,
              fontSize: theme.fontSize.sm,
              cursor: 'pointer',
              '&:hover': { opacity: 0.9 },
            })}
          >
            Suchen
          </button>
          {filter && (
            <a href="/admin/nutzer" mix={clearLinkStyle}>
              Zurücksetzen
            </a>
          )}
        </form>

        {/* Table */}
        <div mix={tableWrapStyle}>
          {rows.length === 0 ? (
            <div mix={emptyStateStyle}>
              {filter
                ? 'Keine Nutzer gefunden für diese Suche.'
                : 'Keine Nutzer vorhanden.'}
            </div>
          ) : (
            <table mix={tableStyle}>
              <thead>
                <tr>
                  {SORTABLE_COLUMNS.map((col) => (
                    <th key={col.key} mix={thSortableStyle}>
                      <a
                        href={buildSortUrl(col.key, sortColumn, sortDirection, offset, filter)}
                        rmx-target={frames.adminContent}
                        mix={sortLinkStyle}
                      >
                        {col.label}
                        <span
                          mix={
                            col.key === sortColumn
                              ? sortArrowActiveStyle
                              : sortArrowStyle
                          }
                        >
                          {sortArrow(col.key, sortColumn, sortDirection)}
                        </span>
                      </a>
                    </th>
                  ))}
                  <th mix={thStyle}>Passwort</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={idx}
                    mix={css({
                      '&:nth-child(even)': { background: theme.surface.lvl0 },
                      '&:hover': { background: theme.surface.lvl3 },
                    })}
                  >
                    <td mix={tdStyle}>{row.n_vorname ?? '\u2014'}</td>
                    <td mix={tdStyle}>{row.n_name ?? '\u2014'}</td>
                    <td mix={tdStyle}>{row.n_email ?? '\u2014'}</td>
                    <td mix={tdStyle}>
                      <span mix={row.n_verpflichtung ? boolBadgeYes : boolBadgeNo}>
                        {boolLabel(row.n_verpflichtung)}
                      </span>
                    </td>
                    <td mix={tdStyle}>{row.l_login}</td>
                    <td mix={tdStyle}>
                      <span mix={boolBadgeYes ? boolBadgeYes : boolBadgeNo}>
                        {boolLabel(row.l_aktiv)}
                      </span>
                    </td>
                    <td mix={tdStyle}>
                      <span mix={row.l_gesperrt ? boolBadgeYes : boolBadgeNo}>
                        {boolLabel(row.l_gesperrt)}
                      </span>
                    </td>
                    <td mix={tdStyle}>{formatTimestamp(row.l_letzte_login)}</td>
                    <td mix={tdMonoStyle}>
                      <span mix={maskedStyle}>{row.l_passwort ? '\u2022'.repeat(10) : '\u2014'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {(offset > 0 || hasMore) && (
          <div mix={paginationStyle}>
            {rows.length > 0 && (
              <span mix={paginationInfoStyle}>
                Zeige {pageStart}\u2013{pageEnd}
              </span>
            )}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {offset > 0 ? (
                <a
                  href={buildPaginationUrl(prevOffset, sortColumn, sortDirection, filter)}
                  rmx-target={frames.adminContent}
                  mix={pageLinkStyle}
                >
                  \u2190 Zurück
                </a>
              ) : (
                <span mix={pageLinkDisabledStyle}>\u2190 Zurück</span>
              )}
              {hasMore ? (
                <a
                  href={buildPaginationUrl(nextOffset, sortColumn, sortDirection, filter)}
                  rmx-target={frames.adminContent}
                  mix={pageLinkStyle}
                >
                  Weiter \u2192
                </a>
              ) : (
                <span mix={pageLinkDisabledStyle}>Weiter \u2192</span>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }
}
```

Note on the `boolBadgeYes` issue: The `l_aktiv` badge uses a potentially incorrect ternary. Fix this by always rendering aktiv without the conditional:

For the Aktiv column, replace this:
```tsx
<span mix={boolBadgeYes ? boolBadgeYes : boolBadgeNo}>
```
with:
```tsx
<span mix={row.l_aktiv ? boolBadgeYes : boolBadgeNo}>
```

- [ ] **Step 2: Verify it type-checks**

Run: `pnpm run typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/ui/admin-nutzer-page.tsx
git commit -m "feat: add admin-nutzer page component with sortable grid, filter, pagination"
```

---

### Task 4: Wire router and add nav item

**Files:**
- Modify: `app/router.ts` — import and map the new controller
- Modify: `app/ui/admin-layout.tsx` — add nav item

- [ ] **Step 1: Wire controller in router.ts**

Add import after the existing admin imports (around line 29):
```typescript
import adminNutzerController from './actions/admin-nutzer-controller.tsx'
```

Add route map after the admin lists line (around line 109):
```typescript
// Admin nutzer route
router.map(adminRoutes.admin.nutzer, adminNutzerController)
```

- [ ] **Step 2: Add nav item in admin-layout.tsx**

Update the `AdminNavItem` type to include `'nutzer'`:
```typescript
export type AdminNavItem =
  | 'dashboard'
  | 'chatlog'
  | 'chatonly'
  | 'agentonly'
  | 'messages'
  | 'lists'
  | 'client'
  | 'nutzer'
```

Add the nav item in the "Data" section of `NAV_GROUPS`:
```typescript
{ id: 'nutzer', label: 'Nutzer', route: routes.admin.nutzer.index },
```

Add an icon case in the `navIcon` function:
```typescript
case 'nutzer':
  return usersSvg()
```

- [ ] **Step 3: Verify type-check**

Run: `pnpm run typecheck`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add app/router.ts app/ui/admin-layout.tsx
git commit -m "feat: wire admin-nutzer route and add nav item"
```

---

### Self-Review Checklist

1. **Spec coverage:** Both spec sections covered — route/controller (Task 1+2), page (Task 3), nav/wiring (Task 4). All 9 columns displayed. Sort, filter, pagination all implemented.
2. **Placeholder scan:** No TBD/TODO/filler. Every code block is complete.
3. **Type consistency:** `parseSort` uses same interface as existing code (`allowedColumns`, `defaultColumn`, `defaultDirection`). SQL column names match DB schema. `renderAdminPage` called with `'nutzer'` as nav id — matches `AdminNavItem`.
