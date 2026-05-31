import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { Button } from 'remix/ui/button'

import { table } from './mixins/admin-table.ts'
import { sortArrow, buildSortUrl, buildPaginationUrl, buildCreateUrl, buildEditUrl, formatTimestamp } from './mixins/admin-urls.ts'

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

const ADMIN_BASE = '/admin/nutzer'

function boolLabel(val: boolean): string { return val ? 'Ja' : 'Nein' }

// ── Styles ──

const toolbarStyle = css({
  display: 'flex', justifyContent: 'flex-end', gap: theme.space.sm, marginBottom: theme.space.sm,
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
            href={buildCreateUrl(ADMIN_BASE, offset, sortColumn, sortDirection, filter)}
            rmx-target={frames.adminContent}
            style={{ textDecoration: 'none' }}
          >
            <Button tone="primary">+ Add New</Button>
          </a>
        </div>

        {/* Filter bar */}
        <form method="GET" action="/admin/nutzer" rmx-target={frames.adminContent} mix={table.filterBar}>
          <input
            type="text" name="filter" placeholder="Suche nach Name, Email oder Login..."
            defaultValue={filter ?? ''} mix={table.filterInput}
          />
          <button type="submit" mix={table.searchBtn}>Suchen</button>
          {filter && (
            <a href="/admin/nutzer" rmx-target={frames.adminContent} mix={table.clearLink}>
              Zurücksetzen
            </a>
          )}
        </form>

        {/* Table */}
        <div mix={table.wrap}>
          {rows.length === 0 ? (
            <div mix={table.empty}>
              {filter
                ? 'Keine Nutzer gefunden für diese Suche.'
                : 'Keine Nutzer vorhanden.'}
            </div>
          ) : (
            <table id="nutzer-table" mix={table.table}>
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
                    <th key={col.key} mix={table.thSortable} title={col.label}>
                      <a
                        href={buildSortUrl(ADMIN_BASE, col.key, sortColumn, sortDirection, offset, filter)}
                        rmx-target={frames.adminContent} mix={table.sortLink}
                      >
                        {col.label}
                        <span mix={col.key === sortColumn ? table.sortArrowActive : table.sortArrow}>
                          {sortArrow(col.key, sortColumn, sortDirection)}
                        </span>
                      </a>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.n_id} mix={table.row} data-row-id={row.n_id}>
                    <td mix={table.td} title={row.n_vorname ?? ''}>{row.n_vorname ?? '\u2014'}</td>
                    <td mix={table.td} title={row.n_name ?? ''}>{row.n_name ?? '\u2014'}</td>
                    <td mix={table.td} title={row.n_email ?? ''}>{row.n_email ?? '\u2014'}</td>
                    <td mix={table.td} title={row.l_login}>{row.l_login}</td>
                    <td mix={table.td}>
                      <span mix={row.n_verpflichtung ? boolBadgeYes : boolBadgeNo}>
                        {boolLabel(row.n_verpflichtung)}
                      </span>
                    </td>
                    <td mix={table.td}>
                      <span mix={row.l_aktiv ? boolBadgeYes : boolBadgeNo}>
                        {boolLabel(row.l_aktiv)}
                      </span>
                    </td>
                    <td mix={table.td}>
                      <span mix={row.l_gesperrt ? boolBadgeYes : boolBadgeNo}>
                        {boolLabel(row.l_gesperrt)}
                      </span>
                    </td>
                    <td mix={table.td} title={row.l_letzte_login ? formatTimestamp(row.l_letzte_login) : ''}>{formatTimestamp(row.l_letzte_login)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {(offset > 0 || hasMore) && (
          <div mix={table.pagination}>
            {rows.length > 0 && (
              <span mix={table.paginationInfo}>Zeige {pageStart}–{pageEnd}</span>
            )}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {offset > 0 ? (
                <a
                  href={buildPaginationUrl(ADMIN_BASE, prevOffset, sortColumn, sortDirection, filter)}
                  rmx-target={frames.adminContent} mix={table.pageLink}
                >← Zurück</a>
              ) : (
                <span mix={table.pageLinkDisabled}>← Zurück</span>
              )}
              {hasMore ? (
                <a
                  href={buildPaginationUrl(ADMIN_BASE, nextOffset, sortColumn, sortDirection, filter)}
                  rmx-target={frames.adminContent} mix={table.pageLink}
                >Weiter →</a>
              ) : (
                <span mix={table.pageLinkDisabled}>Weiter →</span>
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
        <div mix={table.page}>
          <h2 mix={table.title}>Nutzer</h2>
          <div mix={table.twoColumn}>
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
      <div mix={table.page}>
        <h2 mix={table.title}>Nutzer</h2>
        {gridSection}
      </div>
    )
  }
}
