import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { Button } from 'remix/ui/button'
import { Glyph } from 'remix/ui/glyph'

import { frames } from '../routes.ts'
import { AdminOfferingsEditPage } from './admin-offerings-edit-page.tsx'
import { AdminOfferingsCreatePage } from './admin-offerings-create-page.tsx'
import { AdminOfferingsConfigPage } from './admin-offerings-config-page.tsx'
import { AdminOfferingsWeekPage } from './admin-offerings-week-page.tsx'
import type { OfferingConfig } from '../data/offering-configs.ts'
import { RestfulForm } from './restful-form.tsx'
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
  return '/admin/offerings?' + params.toString()
}

function buildPaginationUrl(
  newOffset: number, sort: string, order: 'asc' | 'desc', filter?: string,
): string {
  let params = new URLSearchParams()
  params.set('offset', String(newOffset))
  params.set('sort', sort)
  params.set('order', order)
  if (filter) params.set('filter', filter)
  return '/admin/offerings?' + params.toString()
}

function buildCreateUrl(offset: number, sort: string, order: string, filter?: string): string {
  let params = new URLSearchParams()
  params.set('creating', 'true')
  if (offset > 0) params.set('offset', String(offset))
  params.set('sort', sort)
  params.set('order', order)
  if (filter) params.set('filter', filter)
  return '/admin/offerings?' + params.toString()
}

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

function buildEditUrl(id: string, offset: number, sort: string, order: string, filter?: string): string {
  let params = new URLSearchParams()
  params.set('editing', id)
  params.set('offset', String(offset))
  params.set('sort', sort)
  params.set('order', order)
  if (filter) params.set('filter', filter)
  return '/admin/offerings?' + params.toString()
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return '\u2014'
  return new Date(Number(ts)).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
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

const pageStyle = css({ maxWidth: '1000px' })
const titleStyle = css({
  margin: 0, fontSize: theme.fontSize.xxl, fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

const errorBannerStyle = css({
  padding: theme.space.sm,
  marginBottom: theme.space.md,
  background: theme.colors.action.danger.background,
  color: theme.colors.action.danger.foreground,
  borderRadius: theme.radius.md,
  fontSize: theme.fontSize.sm,
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
const thStyle = css({
  textAlign: 'left', padding: `${theme.space.sm} ${theme.space.md}`,
  background: theme.surface.lvl2, borderBottom: `1px solid ${theme.colors.border.default}`,
  whiteSpace: 'nowrap', fontWeight: theme.fontWeight.semibold,
  fontSize: theme.fontSize.xs, textTransform: 'uppercase', letterSpacing: '0.06em',
  color: theme.colors.text.secondary,
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
const actionCellStyle = css({
  padding: `${theme.space.sm} ${theme.space.md}`,
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
  whiteSpace: 'nowrap', textAlign: 'right',
})
const btnGroupStyle = css({
  display: 'inline-flex', alignItems: 'stretch',
})
const editBtnStyle = css({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  padding: theme.space.xs, minWidth: '28px', minHeight: '28px',
  background: theme.surface.lvl2, color: theme.colors.text.secondary,
  border: `1px solid ${theme.colors.border.default}`,
  borderRight: 'none',
  borderRadius: `${theme.radius.md} 0 0 ${theme.radius.md}`,
  fontSize: theme.fontSize.xs, textDecoration: 'none', cursor: 'pointer',
  '&:hover': { background: theme.surface.lvl3, color: theme.colors.text.primary },
})
const delBtnStyle = css({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  padding: theme.space.xs, minWidth: '28px', minHeight: '28px',
  background: theme.colors.action.danger.background, color: theme.colors.action.danger.foreground,
  border: 'none',
  borderRadius: `0 ${theme.radius.md} ${theme.radius.md} 0`,
  fontSize: theme.fontSize.xs, cursor: 'pointer',
  '&:hover': { opacity: 0.9 },
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
      <div style="min-width:0">
        {error ? <div mix={errorBannerStyle}>{error}</div> : null}
        {/* Toolbar + Filter combined */}
        <form
          method="GET"
          action="/admin/offerings"
          rmx-target={frames.adminContent}
          mix={filterBarStyle}
        >
          <input
            type="text"
            name="filter"
            placeholder="Suche nach Ressource..."
            defaultValue={filter ?? ''}
            mix={filterInputStyle}
          />
          <button type="submit" mix={searchBtnStyle}>Suchen</button>
          {filter && (
            <a
              href="/admin/offerings"
              rmx-target={frames.adminContent}
              mix={clearLinkStyle}
            >
              Zurücksetzen
            </a>
          )}
          <span style="flex:1" />
          <a
            href={buildCreateUrl(offset, sortColumn, sortDirection, filter)}
            rmx-target={frames.adminContent}
            style={{ textDecoration: 'none' }}
          >
            <Button tone="primary">+ Add New</Button>
          </a>
          <a
            href={buildAddWeekUrl(offset, sortColumn, sortDirection, filter)}
            rmx-target={frames.adminContent}
            style={{ textDecoration: 'none' }}
          >
            <Button tone="primary">+ Add Week</Button>
          </a>
        </form>

        {/* Table */}
        <div mix={tableWrapStyle} data-offerings-table="true">
          {rows.length === 0 ? (
            <div mix={emptyStateStyle}>
              {filter
                ? 'Keine Angebote gefunden für diese Suche.'
                : 'Keine Angebote vorhanden.'}
            </div>
          ) : (
            <table mix={tableStyle}>
              <colgroup>
                <col style={{ width: '40px' }} />
                <col style={{ width: '35px' }} />
                <col style={{ width: '30px' }} />
                <col />
                <col />
                <col />
                <col />
                <col />
                <col style={{ width: '100px' }} />
              </colgroup>
              <thead>
                <tr>
                  <th mix={thSortableStyle} title="ID">
                    <a href={buildSortUrl('ao.id', sortColumn, sortDirection, offset, filter)}
                       rmx-target={frames.adminContent} mix={sortLinkStyle}>
                      ID
                      <span mix={'ao.id' === sortColumn ? sortArrowActiveStyle : sortArrowStyle}>
                        {sortArrow('ao.id', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={thStyle}>KW</th>
                  <th mix={thStyle}>WD</th>
                  <th mix={thSortableStyle} title="Tag">
                    <a href={buildSortUrl('ao.day', sortColumn, sortDirection, offset, filter)}
                       rmx-target={frames.adminContent} mix={sortLinkStyle}>
                      Tag
                      <span mix={'ao.day' === sortColumn ? sortArrowActiveStyle : sortArrowStyle}>
                        {sortArrow('ao.day', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={thSortableStyle} title="Ressource">
                    <a href={buildSortUrl('r.description', sortColumn, sortDirection, offset, filter)}
                       rmx-target={frames.adminContent} mix={sortLinkStyle}>
                      Ressource
                      <span mix={'r.description' === sortColumn ? sortArrowActiveStyle : sortArrowStyle}>
                        {sortArrow('r.description', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={thSortableStyle} title="Zeitraum">
                    <a href={buildSortUrl('ao.during', sortColumn, sortDirection, offset, filter)}
                       rmx-target={frames.adminContent} mix={sortLinkStyle}>
                      Zeitraum
                      <span mix={'ao.during' === sortColumn ? sortArrowActiveStyle : sortArrowStyle}>
                        {sortArrow('ao.during', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={thSortableStyle} title="Erstellt">
                    <a href={buildSortUrl('ao.created_at', sortColumn, sortDirection, offset, filter)}
                       rmx-target={frames.adminContent} mix={sortLinkStyle}>
                      Erstellt
                      <span mix={'ao.created_at' === sortColumn ? sortArrowActiveStyle : sortArrowStyle}>
                        {sortArrow('ao.created_at', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={thSortableStyle} title="Aktualisiert">
                    <a href={buildSortUrl('ao.updated_at', sortColumn, sortDirection, offset, filter)}
                       rmx-target={frames.adminContent} mix={sortLinkStyle}>
                      Aktualisiert
                      <span mix={'ao.updated_at' === sortColumn ? sortArrowActiveStyle : sortArrowStyle}>
                        {sortArrow('ao.updated_at', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={thStyle} style={{ width: '100px' }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} mix={rowStyle} data-row-id={row.id}>
                    <td mix={tdStyle} title={row.id}>{row.id}</td>
                    <td mix={tdStyle}>{formatWeekNumber(row.day)}</td>
                    <td mix={tdStyle}>{formatWeekday(row.day)}</td>
                    <td mix={tdStyle} title={formatDate(row.day)}>{formatDate(row.day)}</td>
                    <td mix={tdStyle} title={row.resource_description ?? ''}>
                      {row.resource_description ?? '\u2014'}
                    </td>
                    <td mix={tdStyle} title={row.during}>{formatDuring(row.during)}</td>
                    <td mix={tdStyle} title={formatTimestamp(row.created_at)}>{formatTimestamp(row.created_at)}</td>
                    <td mix={tdStyle} title={formatTimestamp(row.updated_at)}>{formatTimestamp(row.updated_at)}</td>
                    <td mix={actionCellStyle}>
                      <div mix={btnGroupStyle}>
                        <a
                          href={buildEditUrl(row.id, offset, sortColumn, sortDirection, filter)}
                          rmx-target={frames.adminContent}
                          mix={editBtnStyle}
                        >
                          <Glyph name="edit" width={14} height={14} />
                        </a>
                        <RestfulForm
                          method="DELETE"
                          action={`/admin/offerings/${row.id}`}
                          style="display:inline"
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
                          <button type="submit" mix={delBtnStyle}>
                            <Glyph name="trash" width={14} height={14} />
                          </button>
                        </RestfulForm>
                      </div>
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
              <span mix={paginationInfoStyle}>Zeige {pageStart}–{pageEnd}</span>
            )}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {offset > 0 ? (
                <a
                  href={buildPaginationUrl(prevOffset, sortColumn, sortDirection, filter)}
                  rmx-target={frames.adminContent}
                  mix={pageLinkStyle}
                ><Glyph name="chevronRight" width={14} height={14} style={{ transform: 'rotate(180deg)' }} /> Zurück</a>
              ) : (
                <span mix={pageLinkDisabledStyle}><Glyph name="chevronRight" width={14} height={14} style={{ transform: 'rotate(180deg)' }} /> Zurück</span>
              )}
              {hasMore ? (
                <a
                  href={buildPaginationUrl(nextOffset, sortColumn, sortDirection, filter)}
                  rmx-target={frames.adminContent}
                  mix={pageLinkStyle}
                >Weiter <Glyph name="chevronRight" width={14} height={14} /></a>
              ) : (
                <span mix={pageLinkDisabledStyle}>Weiter <Glyph name="chevronRight" width={14} height={14} /></span>
              )}
            </div>
          </div>
        )}

        {/* Context menu data and clientEntry */}
        <script id="offerings-grid-state" type="application/json">
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
        <div mix={pageStyle}>
          <h2 mix={titleStyle}>Offerings</h2>
          <div mix={twoColumnStyle}>
            {gridSection}
            <div style="position:sticky;top:1.5rem">
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
      <div mix={pageStyle}>
        <h2 mix={titleStyle}>Offerings</h2>
        {gridSection}
      </div>
    )
  }
}
