import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { Button } from 'remix/ui/button'

import { frames } from '../routes.ts'
import { AdminNutzerEditPage } from './admin-nutzer-edit-page.tsx'
import { AdminNutzerCreatePage } from './admin-nutzer-create-page.tsx'
import { NutzerTableInteractive } from '../assets/nutzer-table-interactive.tsx'

export interface NutzerRow {
  n_id: string
  n_vorname: string | null
  n_name: string | null
  n_email: string | null
  n_verpflichtung: boolean
  l_id: string
  l_login: string
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
  editRow?: NutzerRow | null
  creating?: boolean
}

const SORTABLE_COLUMNS: Array<{ key: string; label: string }> = [
  { key: 'n_vorname', label: 'Vorname' },
  { key: 'n_name', label: 'Name' },
  { key: 'n_email', label: 'Email' },
  { key: 'l_login', label: 'Login' },
  { key: 'n_verpflichtung', label: 'Verpfl' },
  { key: 'l_aktiv', label: 'Aktiv' },
  { key: 'l_gesperrt', label: 'Gesp' },
  { key: 'l_letzte_login', label: 'Letzter Login' },
]

// ── Helpers ──

function sortArrow(field: string, sortField: string, sortOrder: 'asc' | 'desc'): string {
  if (field !== sortField) return '\u2195'
  return sortOrder === 'asc' ? '\u2191' : '\u2193'
}

function buildSortUrl(
  field: string, currentSort: string, currentOrder: 'asc' | 'desc',
  offset: number, filter?: string,
): string {
  let newOrder = field === currentSort ? (currentOrder === 'asc' ? 'desc' : 'asc') : 'asc'
  let params = new URLSearchParams()
  params.set('offset', '0')
  params.set('sort', field)
  params.set('order', newOrder)
  if (filter) params.set('filter', filter)
  return '/admin/nutzer?' + params.toString()
}

function buildPaginationUrl(
  newOffset: number, sort: string, order: 'asc' | 'desc', filter?: string,
): string {
  let params = new URLSearchParams()
  params.set('offset', String(newOffset))
  params.set('sort', sort)
  params.set('order', order)
  if (filter) params.set('filter', filter)
  return '/admin/nutzer?' + params.toString()
}

function buildCreateUrl(offset: number, sort: string, order: string, filter?: string): string {
  let params = new URLSearchParams()
  params.set('creating', 'true')
  if (offset > 0) params.set('offset', String(offset))
  params.set('sort', sort)
  params.set('order', order)
  if (filter) params.set('filter', filter)
  return '/admin/nutzer?' + params.toString()
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return '\u2014'
  return new Date(ts).toLocaleString('de-DE')
}

function boolLabel(val: boolean): string { return val ? 'Ja' : 'Nein' }

// ── Styles ──

const pageStyle = css({ maxWidth: '1000px' })
const titleStyle = css({
  margin: 0, fontSize: theme.fontSize.xxl, fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})
const toolbarStyle = css({
  display: 'flex', justifyContent: 'flex-end', gap: theme.space.sm, marginBottom: theme.space.sm,
})
const filterBarStyle = css({
  display: 'flex', alignItems: 'center', gap: theme.space.sm, marginBottom: theme.space.md,
})
const filterInputStyle = css({
  flex: '1', maxWidth: '300px', padding: `${theme.space.xs} ${theme.space.sm}`,
  fontSize: theme.fontSize.sm, border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md, background: theme.surface.lvl0, color: theme.colors.text.primary,
  outline: 'none',
  '&:focus': {
    borderColor: theme.colors.action.primary.background,
    boxShadow: `0 0 0 2px ${theme.colors.focus.ring}`,
  },
  '&::placeholder': { color: theme.colors.text.muted },
})
const searchBtnStyle = css({
  padding: `${theme.space.xs} ${theme.space.md}`,
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  border: 'none', borderRadius: theme.radius.md, fontSize: theme.fontSize.sm, cursor: 'pointer',
  '&:hover': { opacity: 0.9 },
})
const clearLinkStyle = css({
  fontSize: theme.fontSize.xs, color: theme.colors.text.muted, textDecoration: 'none',
  '&:hover': { color: theme.colors.text.primary, textDecoration: 'underline' },
})
const tableWrapStyle = css({
  marginBottom: theme.space.xl, background: theme.surface.lvl1,
  borderRadius: theme.radius.lg, border: `1px solid ${theme.colors.border.default}`, overflowX: 'auto',
})
const tableStyle = css({
  width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: theme.fontSize.sm,
})
const thSortableStyle = css({
  textAlign: 'left', padding: `${theme.space.sm} ${theme.space.md}`,
  background: theme.surface.lvl2, borderBottom: `1px solid ${theme.colors.border.default}`,
  whiteSpace: 'nowrap',
})
const sortLinkStyle = css({
  color: theme.colors.text.secondary, textDecoration: 'none', display: 'inline-flex',
  alignItems: 'center', gap: '4px', fontWeight: theme.fontWeight.semibold,
  fontSize: theme.fontSize.xs, textTransform: 'uppercase', letterSpacing: '0.06em',
  '&:hover': { color: theme.colors.text.primary },
})
const sortArrowStyle = css({
  display: 'inline-block', fontSize: '0.7rem', lineHeight: '1', color: theme.colors.text.muted,
})
const sortArrowActiveStyle = css({
  display: 'inline-block', fontSize: '0.8rem', lineHeight: '1',
  color: theme.colors.action.primary.background, fontWeight: theme.fontWeight.bold,
})
const tdStyle = css({
  padding: `${theme.space.sm} ${theme.space.md}`,
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
  color: theme.colors.text.primary, verticalAlign: 'middle',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
})
const boolBadgeYes = css({
  display: 'inline-block', padding: `2px ${theme.space.sm}`,
  borderRadius: theme.radius.full, fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold, background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
})
const boolBadgeNo = css({
  display: 'inline-block', padding: `2px ${theme.space.sm}`,
  borderRadius: theme.radius.full, fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold, background: theme.surface.lvl3,
  color: theme.colors.text.muted,
})
const emptyStateStyle = css({
  textAlign: 'center', padding: theme.space.xxl, color: theme.colors.text.muted,
})
const paginationStyle = css({
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: theme.space.md, background: theme.surface.lvl0,
  borderRadius: theme.radius.md, border: `1px solid ${theme.colors.border.default}`,
})
const paginationInfoStyle = css({
  fontSize: theme.fontSize.sm, color: theme.colors.text.muted,
})
const pageLinkStyle = css({
  padding: `${theme.space.sm} ${theme.space.md}`, background: theme.surface.lvl2,
  color: theme.colors.text.secondary, borderRadius: theme.radius.md,
  fontSize: theme.fontSize.sm, textDecoration: 'none',
  '&:hover': { background: theme.surface.lvl3, color: theme.colors.text.primary },
})
const pageLinkDisabledStyle = css({
  padding: `${theme.space.sm} ${theme.space.md}`, borderRadius: theme.radius.md,
  fontSize: theme.fontSize.sm, opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none',
})
const rowStyle = css({
  '&:nth-child(even)': { background: theme.surface.lvl0 },
  '&:hover': { background: theme.surface.lvl3 },
})
const twoColumnStyle = css({
  display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px', alignItems: 'start',
})

// ── Component ──

export function AdminNutzerPage(handle: Handle<AdminNutzerPageProps>) {
  return () => {
    let {
      rows, offset, hasMore, prevOffset, nextOffset,
      sortColumn, sortDirection, filter,
      editRow = null, creating = false,
    } = handle.props
    let pageStart = rows.length > 0 ? offset + 1 : 0
    let pageEnd = offset + rows.length

    let gridSection = (
      <div style="min-width:0">
        {/* Toolbar: Add New button */}
        <div mix={toolbarStyle}>
          <a
            href={buildCreateUrl(offset, sortColumn, sortDirection, filter)}
            rmx-target={frames.adminContent}
            style={{ textDecoration: 'none' }}
          >
            <Button tone="primary">+ Add New</Button>
          </a>
        </div>

        {/* Filter bar */}
        <form method="GET" action="/admin/nutzer" rmx-target={frames.adminContent} mix={filterBarStyle}>
          <input
            type="text" name="filter" placeholder="Suche nach Name, Email oder Login..."
            defaultValue={filter ?? ''} mix={filterInputStyle}
          />
          <button type="submit" mix={searchBtnStyle}>Suchen</button>
          {filter && (
            <a href="/admin/nutzer" rmx-target={frames.adminContent} mix={clearLinkStyle}>
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
            <table id="nutzer-table" mix={tableStyle}>
              <colgroup>
                <col style={{ width: '12%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '24%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '13%' }} />
              </colgroup>
              <thead>
                <tr>
                  {SORTABLE_COLUMNS.map((col) => (
                    <th key={col.key} mix={thSortableStyle} title={col.label}>
                      <a
                        href={buildSortUrl(col.key, sortColumn, sortDirection, offset, filter)}
                        rmx-target={frames.adminContent} mix={sortLinkStyle}
                      >
                        {col.label}
                        <span mix={col.key === sortColumn ? sortArrowActiveStyle : sortArrowStyle}>
                          {sortArrow(col.key, sortColumn, sortDirection)}
                        </span>
                      </a>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.n_id} mix={rowStyle} data-row-id={row.n_id}>
                    <td mix={tdStyle} title={row.n_vorname ?? ''}>{row.n_vorname ?? '\u2014'}</td>
                    <td mix={tdStyle} title={row.n_name ?? ''}>{row.n_name ?? '\u2014'}</td>
                    <td mix={tdStyle} title={row.n_email ?? ''}>{row.n_email ?? '\u2014'}</td>
                    <td mix={tdStyle} title={row.l_login}>{row.l_login}</td>
                    <td mix={tdStyle}>
                      <span mix={row.n_verpflichtung ? boolBadgeYes : boolBadgeNo}>
                        {boolLabel(row.n_verpflichtung)}
                      </span>
                    </td>
                    <td mix={tdStyle}>
                      <span mix={row.l_aktiv ? boolBadgeYes : boolBadgeNo}>
                        {boolLabel(row.l_aktiv)}
                      </span>
                    </td>
                    <td mix={tdStyle}>
                      <span mix={row.l_gesperrt ? boolBadgeYes : boolBadgeNo}>
                        {boolLabel(row.l_gesperrt)}
                      </span>
                    </td>
                    <td mix={tdStyle} title={row.l_letzte_login ? formatTimestamp(row.l_letzte_login) : ''}>{formatTimestamp(row.l_letzte_login)}</td>
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
              <span mix={paginationInfoStyle}>Zeige {pageStart}–{pageEnd}</span>
            )}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {offset > 0 ? (
                <a
                  href={buildPaginationUrl(prevOffset, sortColumn, sortDirection, filter)}
                  rmx-target={frames.adminContent} mix={pageLinkStyle}
                >← Zurück</a>
              ) : (
                <span mix={pageLinkDisabledStyle}>← Zurück</span>
              )}
              {hasMore ? (
                <a
                  href={buildPaginationUrl(nextOffset, sortColumn, sortDirection, filter)}
                  rmx-target={frames.adminContent} mix={pageLinkStyle}
                >Weiter →</a>
              ) : (
                <span mix={pageLinkDisabledStyle}>Weiter →</span>
              )}
            </div>
          </div>
        )}

        {/* JSON data for clientEntry context menu */}
        <script id="nutzer-table-data" type="application/json">
          {JSON.stringify({
            rows: rows.map(r => ({
              n_id: r.n_id,
              n_name: r.n_name,
              n_l_login: r.l_login,
              n_l_aktiv: r.l_aktiv,
              n_l_gesperrt: r.l_gesperrt,
              n_email: r.n_email,
            })),
            offset,
            hasMore,
            prevOffset: Math.max(0, offset - 15),
            nextOffset: offset + 15,
            sortColumn,
            sortDirection,
            filter,
          })}
        </script>

        {/* ClientEntry for context menu behavior (renders menu overlay) */}
        <NutzerTableInteractive />
      </div>
    )

    // Two-column layout when editing or creating
    if (editRow || creating) {
      return (
        <div mix={pageStyle}>
          <h2 mix={titleStyle}>Nutzer</h2>
          <div mix={twoColumnStyle}>
            {gridSection}
            <div style="position:sticky;top:1.5rem">
              {editRow ? (
                <AdminNutzerEditPage
                  row={editRow}
                  offset={String(offset)} sort={sortColumn}
                  order={sortDirection} filter={filter}
                />
              ) : (
                <AdminNutzerCreatePage
                  offset={String(offset)} sort={sortColumn}
                  order={sortDirection} filter={filter}
                />
              )}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div mix={pageStyle}>
        <h2 mix={titleStyle}>Nutzer</h2>
        {gridSection}
      </div>
    )
  }
}
