import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { Button } from 'remix/ui/button'
import { Glyph } from 'remix/ui/glyph'

import { frames } from '../routes.ts'
import { table } from './mixins/admin-table.ts'
import { sortArrow, buildSortUrl, buildPaginationUrl, buildCreateUrl, formatTimestamp } from './mixins/admin-urls.ts'
import { AdminOfferingsEditPage } from './admin-offerings-edit-page.tsx'
import { AdminOfferingsCreatePage } from './admin-offerings-create-page.tsx'
import { AdminOfferingsConfigPage } from './admin-offerings-config-page.tsx'
import { AdminOfferingsWeekPage } from './admin-offerings-week-page.tsx'
import type { OfferingConfig } from '../data/offering-configs.ts'
import { RestfulForm } from './restful-form.tsx'
import { getCspNonce } from '../middleware/security-headers.ts'
import { GridStateHiddenInputs } from './grid-state-hidden.tsx'
import { AdminOfferingsContextMenu } from '../assets/admin-offerings-context-menu.tsx'
import type { OfferingRow, ResourceOption } from '../actions/admin-offerings-controller.tsx'

interface AdminOfferingsPageProps {
  rows: OfferingRow[]
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
  editRow?: OfferingRow | null
  creating?: boolean
  resources: ResourceOption[]
  error?: string
  configResourceId?: number
  offeringConfig?: OfferingConfig
  addWeek?: boolean
}

// ── Helpers ──

const ADMIN_BASE = '/admin/offerings'

function buildAddWeekUrl(offset: number, sort: string, order: string, filter?: string): string {
  let params = new URLSearchParams()
  params.set('addweek', 'true')
  if (offset > 0) params.set('offset', String(offset))
  params.set('sort', sort)
  params.set('order', order)
  if (filter) params.set('filter', filter)
  return '/admin/offerings?' + params.toString()
}

function buildConfigUrl(resourceId: number, offset: number, sort: string, order: string, filter?: string): string {
  let params = new URLSearchParams()
  params.set('config', String(resourceId))
  if (offset > 0) params.set('offset', String(offset))
  params.set('sort', sort)
  params.set('order', order)
  if (filter) params.set('filter', filter)
  return '/admin/offerings?' + params.toString()
}
const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Mo', 2: 'Di', 3: 'Mi', 4: 'Do', 5: 'Fr', 6: 'Sa', 7: 'So',
}

function formatWeekday(day: string): string {
  let d = new Date(Number(day))
  return WEEKDAY_LABELS[d.getUTCDay() || 7] ?? ''
}

function formatWeekNumber(day: string): number {
  let d = new Date(Number(day))
  let target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  let dayOfWeek = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - dayOfWeek)
  let yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
}

function formatDate(day: string): string {
  return new Date(Number(day)).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function formatDuring(during: string): string {
  let match = during.match(/^\[(\d+),(\d+)\)$/)
  if (!match) return during
  let startMin = parseInt(match[1], 10)
  let endMin = parseInt(match[2], 10)
  let startH = String(Math.floor(startMin / 60)).padStart(2, '0')
  let startM = String(startMin % 60).padStart(2, '0')
  let endH = String(Math.floor(endMin / 60)).padStart(2, '0')
  let endM = String(endMin % 60).padStart(2, '0')
  return `${startH}:${startM}\u2013${endH}:${endM}`
}

// ── Styles ──

const errorBannerStyle = css({
  padding: theme.space.sm,
  marginBottom: theme.space.md,
  background: theme.colors.action.danger.background,
  color: theme.colors.action.danger.foreground,
  borderRadius: theme.radius.md,
  fontSize: theme.fontSize.sm,
})

const editingRowStyle = css({
  outline: `2px solid ${theme.colors.action.primary.background}`,
  outlineOffset: '-2px',
  backgroundColor: theme.surface.lvl0,
})

// ── Component ──

export function AdminOfferingsPage(handle: Handle<AdminOfferingsPageProps>) {
  return () => {
    let {
      rows, offset, hasMore, prevOffset, nextOffset,
      sortColumn, sortDirection, filter,
      editRow = null, creating = false, resources, error,
      configResourceId, offeringConfig, addWeek = false,
    } = handle.props
    let pageStart = rows.length > 0 ? offset + 1 : 0
    let pageEnd = offset + rows.length

    let gridSection = (
      <div mix={css({ minWidth: 0 })}>
        {error ? <div mix={errorBannerStyle}>{error}</div> : null}
        {/* Toolbar + Filter combined */}
        <form
          method="GET"
          action="/admin/offerings"
          rmx-target={frames.adminContent}
          mix={table.filterBar}
        >
          <input
            type="text"
            name="filter"
            placeholder="Suche nach Ressource..."
            defaultValue={filter ?? ''}
            mix={table.filterInput}
          />
          <button type="submit" mix={table.searchBtn}>Suchen</button>
          {filter && (
            <a
              href="/admin/offerings"
              rmx-target={frames.adminContent}
              mix={table.clearLink}
            >
              Zurücksetzen
            </a>
          )}
          <span mix={css({ flex: 1 })} />
          <a
            href={buildCreateUrl(ADMIN_BASE, offset, sortColumn, sortDirection, filter)}
            rmx-target={frames.adminContent}
            mix={css({ textDecoration: 'none' })}
          >
            <Button tone="primary">+ Neu anlegen</Button>
          </a>
          <a
            href={buildAddWeekUrl(offset, sortColumn, sortDirection, filter)}
            rmx-target={frames.adminContent}
            mix={css({ textDecoration: 'none' })}
          >
            <Button tone="primary">+ Woche hinzufügen</Button>
          </a>
        </form>

        {/* Table */}
        <div mix={table.wrap} data-offerings-table="true">
          {rows.length === 0 ? (
            <div mix={table.empty}>
              {filter
                ? 'Keine Angebote gefunden für diese Suche.'
                : 'Keine Angebote vorhanden.'}
            </div>
          ) : (
            <table mix={table.table}>
              <colgroup>
                <col mix={css({ width: '40px' })} />
                <col mix={css({ width: '35px' })} />
                <col mix={css({ width: '30px' })} />
                <col />
                <col />
                <col />
                <col />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th mix={table.thSortable} title="ID">
                    <a href={buildSortUrl(ADMIN_BASE, 'ao.id', sortColumn, sortDirection, offset, filter)}
                       rmx-target={frames.adminContent} mix={table.sortLink}>
                      ID
                      <span mix={'ao.id' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('ao.id', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.th}>KW</th>
                  <th mix={table.th}>WD</th>
                  <th mix={table.thSortable} title="Tag">
                    <a href={buildSortUrl(ADMIN_BASE, 'ao.day', sortColumn, sortDirection, offset, filter)}
                       rmx-target={frames.adminContent} mix={table.sortLink}>
                      Tag
                      <span mix={'ao.day' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('ao.day', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.thSortable} title="Ressource">
                    <a href={buildSortUrl(ADMIN_BASE, 'r.description', sortColumn, sortDirection, offset, filter)}
                       rmx-target={frames.adminContent} mix={table.sortLink}>
                      Ressource
                      <span mix={'r.description' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('r.description', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.thSortable} title="Zeitraum">
                    <a href={buildSortUrl(ADMIN_BASE, 'ao.during', sortColumn, sortDirection, offset, filter)}
                       rmx-target={frames.adminContent} mix={table.sortLink}>
                      Zeitraum
                      <span mix={'ao.during' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('ao.during', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.thSortable} title="Erstellt">
                    <a href={buildSortUrl(ADMIN_BASE, 'ao.created_at', sortColumn, sortDirection, offset, filter)}
                       rmx-target={frames.adminContent} mix={table.sortLink}>
                      Erstellt
                      <span mix={'ao.created_at' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('ao.created_at', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.thSortable} title="Aktualisiert">
                    <a href={buildSortUrl(ADMIN_BASE, 'ao.updated_at', sortColumn, sortDirection, offset, filter)}
                       rmx-target={frames.adminContent} mix={table.sortLink}>
                      Aktualisiert
                      <span mix={'ao.updated_at' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('ao.updated_at', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} mix={[table.row, editRow?.id === row.id ? editingRowStyle : undefined]} data-row-id={row.id}>
                    <td mix={table.td} title={row.id}>{row.id}</td>
                    <td mix={table.td}>{formatWeekNumber(row.day)}</td>
                    <td mix={table.td}>{formatWeekday(row.day)}</td>
                    <td mix={table.td} title={formatDate(row.day)}>{formatDate(row.day)}</td>
                    <td mix={table.td} title={row.resource_description ?? ''}>
                      {row.resource_description ?? '\u2014'}
                    </td>
                    <td mix={table.td} title={row.during}>{formatDuring(row.during)}</td>
                    <td mix={table.td} title={formatTimestamp(row.created_at)}>{formatTimestamp(row.created_at)}</td>
                    <td mix={table.td} title={formatTimestamp(row.updated_at)}>{formatTimestamp(row.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {/* Hidden DELETE forms for context menu — kept in DOM for .requestSubmit() */}
          {rows.length > 0 ? (
            <div mix={css({ display: 'none' })} aria-hidden="true">
              {rows.map((row) => (
                <RestfulForm
                  key={row.id}
                  method="DELETE"
                  action={`/admin/offerings/${row.id}`}
                  data-delete-form={row.id}
                >
                  <GridStateHiddenInputs
                    state={{
                      offset: String(offset),
                      sort: sortColumn,
                      order: sortDirection,
                      filter: filter ?? '',
                    }}
                  />
                </RestfulForm>
              ))}
            </div>
          ) : null}
        </div>

        {/* Pagination */}
        {(offset > 0 || hasMore) && (
          <div mix={table.pagination}>
            {rows.length > 0 && (
              <span mix={table.paginationInfo}>Zeige {pageStart}–{pageEnd}</span>
            )}
            <div mix={css({ display: 'flex', gap: '0.5rem' })}>
              {offset > 0 ? (
                <a
                  href={buildPaginationUrl(ADMIN_BASE, prevOffset, sortColumn, sortDirection, filter)}
                  rmx-target={frames.adminContent}
                  mix={table.pageLink}
                ><Glyph name="chevronRight" width={14} height={14} style={{ transform: 'rotate(180deg)' }} /> Zurück</a>
              ) : (
                <span mix={table.pageLinkDisabled}><Glyph name="chevronRight" width={14} height={14} style={{ transform: 'rotate(180deg)' }} /> Zurück</span>
              )}
              {hasMore ? (
                <a
                  href={buildPaginationUrl(ADMIN_BASE, nextOffset, sortColumn, sortDirection, filter)}
                  rmx-target={frames.adminContent}
                  mix={table.pageLink}
                >Weiter <Glyph name="chevronRight" width={14} height={14} /></a>
              ) : (
                <span mix={table.pageLinkDisabled}>Weiter <Glyph name="chevronRight" width={14} height={14} /></span>
              )}
            </div>
          </div>
        )}

        {/* Context menu data and clientEntry */}
        <script id="offerings-grid-state" type="application/json" nonce={getCspNonce()}>
          {JSON.stringify({
            offset: String(offset),
            sort: sortColumn,
            order: sortDirection,
            filter: filter ?? '',
          })}
        </script>
        <AdminOfferingsContextMenu />
      </div>
    )

    // Two-column layout when editing, creating, configuring, or adding a week
    if (editRow || creating || configResourceId || addWeek) {
      return (
        <div mix={table.page}>
          <h2 mix={table.title}>Angebote</h2>
          <div mix={table.twoColumn}>
            {gridSection}
            <div mix={css({ position: 'sticky', top: '1.5rem' })}>
              {editRow ? (
                <AdminOfferingsEditPage
                  row={editRow}
                  resources={resources}
                  offset={String(offset)}
                  sort={sortColumn}
                  order={sortDirection}
                  filter={filter}
                />
              ) : creating ? (
                <AdminOfferingsCreatePage
                  resources={resources}
                  offset={String(offset)}
                  sort={sortColumn}
                  order={sortDirection}
                  filter={filter}
                />
              ) : configResourceId ? (
                <AdminOfferingsConfigPage
                  resources={resources}
                  config={offeringConfig}
                  resourceId={configResourceId}
                />
              ) : addWeek ? (
                <AdminOfferingsWeekPage
                  resources={resources}
                />
              ) : null}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div mix={table.page}>
        <h2 mix={table.title}>Angebote</h2>
        {gridSection}
      </div>
    )
  }
}
