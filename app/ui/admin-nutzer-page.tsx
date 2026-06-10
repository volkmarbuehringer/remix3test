import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../lib/theme.ts'
import { Button } from 'remix/ui/button'
import { Glyph } from '../lib/glyph.ts'

import { table } from './mixins/admin-table.ts'
import { sortArrow, buildSortUrl, buildPaginationUrl, buildCreateUrl, buildEditUrl, formatTimestamp } from './mixins/admin-urls.ts'

import { AdminNutzerEditPage } from './admin-nutzer-edit-page.tsx'
import { AdminNutzerCreatePage } from './admin-nutzer-create-page.tsx'
import { NutzerTableInteractive } from '../assets/nutzer-table-interactive.tsx'
import { getCspNonce } from '../middleware/security-headers.ts'

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
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
  error?: string
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

const ADMIN_BASE = '/nutzer'

function boolLabel(val: boolean): string { return val ? 'Ja' : 'Nein' }

// ── Styles ──

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

// editingRowStyle moved to table.editingRow

// ── Component ──

export function AdminNutzerPage(handle: Handle<AdminNutzerPageProps>) {
  return () => {
    let {
      rows, offset, hasMore, prevOffset, nextOffset,
      sortColumn, sortDirection, filter,
      editRow = null, creating = false, formValues, fieldErrors, error,
    } = handle.props
    let pageStart = rows.length > 0 ? offset + 1 : 0
    let pageEnd = offset + rows.length

    let gridSection = (
      <div mix={table.minWidth0}>
        {/* Filter bar + Add New */}
        <form method="GET" action={ADMIN_BASE} mix={table.filterBar}>
          <input
            type="text" name="filter" placeholder="Suche nach Name, Email oder Login..."
            defaultValue={filter ?? ''} mix={table.filterInput}
          />
          <button type="submit" mix={table.searchBtn}><Glyph name="search" width={14} height={14} /> Suchen</button>
          {filter && (
            <a href={ADMIN_BASE} mix={table.clearLink}>
              Zurücksetzen
            </a>
          )}
          <span mix={table.spacer} />
          <a
            href={buildCreateUrl(ADMIN_BASE, offset, sortColumn, sortDirection, filter)}
            mix={table.linkPlain}
          >
            <Button tone="primary"><Glyph name="add" width={14} height={14} /> Neu anlegen</Button>
          </a>
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
                <col mix={css({ width: '12%' })} />
                <col mix={css({ width: '20%' })} />
                <col mix={css({ width: '24%' })} />
                <col mix={css({ width: '11%' })} />
                <col mix={css({ width: '8%' })} />
                <col mix={css({ width: '6%' })} />
                <col mix={css({ width: '6%' })} />
                <col mix={css({ width: '13%' })} />
              </colgroup>
              <thead>
                <tr>
                  {SORTABLE_COLUMNS.map((col) => (
                    <th key={col.key} mix={table.thSortable} title={col.label}>
                      <a
                        href={buildSortUrl(ADMIN_BASE, col.key, sortColumn, sortDirection, offset, filter)}
                         mix={table.sortLink}
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
                  <tr key={row.n_id} mix={[table.row, editRow?.n_id === row.n_id ? table.editingRow : undefined]} data-row-id={row.n_id}>
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
            <div mix={table.flexGapSm}>
              {offset > 0 ? (
                <a
                  href={buildPaginationUrl(ADMIN_BASE, prevOffset, sortColumn, sortDirection, filter)}
                   mix={table.pageLink}
                ><Glyph name="chevronRight" width={14} height={14} style={{ transform: 'rotate(180deg)' }} /> Zurück</a>
              ) : (
                <span mix={table.pageLinkDisabled}><Glyph name="chevronRight" width={14} height={14} style={{ transform: 'rotate(180deg)' }} /> Zurück</span>
              )}
              {hasMore ? (
                <a
                  href={buildPaginationUrl(ADMIN_BASE, nextOffset, sortColumn, sortDirection, filter)}
                   mix={table.pageLink}
                >Weiter <Glyph name="chevronRight" width={14} height={14} /></a>
              ) : (
                <span mix={table.pageLinkDisabled}>Weiter <Glyph name="chevronRight" width={14} height={14} /></span>
              )}
            </div>
          </div>
        )}

        {/* JSON data for clientEntry context menu */}
        <script id="nutzer-table-data" type="application/json" nonce={getCspNonce()}>
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
          {error ? <div mix={table.errorBanner}>{error}</div> : null}
          <div mix={table.twoColumn}>
            {gridSection}
            <div mix={table.stickyPanel}>
              {editRow ? (
                <AdminNutzerEditPage
                  row={editRow}
                  offset={String(offset)} sort={sortColumn}
                  order={sortDirection} filter={filter} formValues={formValues} fieldErrors={fieldErrors}
                />
              ) : (
                <AdminNutzerCreatePage
                  offset={String(offset)} sort={sortColumn}
                  order={sortDirection} filter={filter} formValues={formValues} fieldErrors={fieldErrors}
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
