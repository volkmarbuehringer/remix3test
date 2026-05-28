import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { Button } from 'remix/ui/button'
import { Glyph } from 'remix/ui/glyph'

import { frames } from '../routes.ts'
import { AdminAppointmentsEditPage } from './admin-appointments-edit-page.tsx'
import { AdminAppointmentsCreatePage } from './admin-appointments-create-page.tsx'
import { RestfulForm } from './restful-form.tsx'
import { GridStateHiddenInputs } from './grid-state-hidden.tsx'
import { AdminAppointmentsContextMenu } from '../assets/admin-appointments-context-menu.tsx'
import type { AppointmentRow, ResourceOption, UserOption } from '../actions/admin-appointments-controller.tsx'
import { parseDuring } from '../data/appointofferings.ts'

interface AdminAppointmentsPageProps {
  rows: AppointmentRow[]
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
  editRow?: AppointmentRow | null
  creating?: boolean
  resources: ResourceOption[]
  users: UserOption[]
  error?: string
  defaultStartMin?: number
  defaultEndMin?: number
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
  return '/admin/appointments?' + params.toString()
}

function buildPaginationUrl(
  newOffset: number, sort: string, order: 'asc' | 'desc', filter?: string,
): string {
  let params = new URLSearchParams()
  params.set('offset', String(newOffset))
  params.set('sort', sort)
  params.set('order', order)
  if (filter) params.set('filter', filter)
  return '/admin/appointments?' + params.toString()
}

function buildCreateUrl(offset: number, sort: string, order: string, filter?: string): string {
  let params = new URLSearchParams()
  params.set('creating', 'true')
  if (offset > 0) params.set('offset', String(offset))
  params.set('sort', sort)
  params.set('order', order)
  if (filter) params.set('filter', filter)
  return '/admin/appointments?' + params.toString()
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return '\u2014'
  return new Date(Number(ts)).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDate(day: string): string {
  return new Date(Number(day)).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function formatMinRange(startMin: number, endMin: number): string {
  let startH = String(Math.floor(startMin / 60)).padStart(2, '0')
  let startM = String(startMin % 60).padStart(2, '0')
  let endH = String(Math.floor(endMin / 60)).padStart(2, '0')
  let endM = String(endMin % 60).padStart(2, '0')
  return `${startH}:${startM}\u2013${endH}:${endM}`
}

function formatDuring(during: unknown): string {
  // Handle pg int4range object format: { lower: 480, upper: 1020 }
  if (typeof during === 'object' && during !== null) {
    let r = during as { lower: number; upper: number }
    return formatMinRange(Number(r.lower), Number(r.upper))
  }
  // Handle string format using shared parser from appointofferings
  if (typeof during === 'string') {
    let parsed = parseDuring(during)
    if (parsed) return formatMinRange(parsed.startMin, parsed.endMin)
  }
  return String(during)
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

export function AdminAppointmentsPage(handle: Handle<AdminAppointmentsPageProps>) {
  return () => {
    let {
      rows, offset, hasMore, prevOffset, nextOffset,
      sortColumn, sortDirection, filter,
      editRow = null, creating = false, resources, users, error,
      defaultStartMin, defaultEndMin,
    } = handle.props
    let pageStart = rows.length > 0 ? offset + 1 : 0
    let pageEnd = offset + rows.length

    let gridSection = (
      <div style="min-width:0">
        {error ? <div mix={errorBannerStyle}>{error}</div> : null}
        {/* Toolbar + Filter combined */}
        <form
          method="GET"
          action="/admin/appointments"
          rmx-target={frames.adminContent}
          mix={filterBarStyle}
        >
          <input
            type="text"
            name="filter"
            placeholder="Suche nach Titel, E-Mail oder Ressource..."
            defaultValue={filter ?? ''}
            mix={filterInputStyle}
          />
          <button type="submit" mix={searchBtnStyle}>Suchen</button>
          {filter && (
            <a
              href="/admin/appointments"
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
            <Button tone="primary">+ Neu</Button>
          </a>
        </form>

        {/* Table */}
        <div mix={tableWrapStyle} data-appointments-table="true">
          {rows.length === 0 ? (
            <div mix={emptyStateStyle}>
              {filter
                ? 'Keine Termine gefunden für diese Suche.'
                : 'Keine Termine vorhanden.'}
            </div>
          ) : (
            <table mix={tableStyle}>
              <colgroup>
                <col style={{ width: '40px' }} />
                <col />
                <col />
                <col />
                <col />
                <col />
                <col />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th mix={thSortableStyle} title="ID">
                    <a href={buildSortUrl('a.id', sortColumn, sortDirection, offset, filter)}
                       rmx-target={frames.adminContent} mix={sortLinkStyle}>
                      ID
                      <span mix={'a.id' === sortColumn ? sortArrowActiveStyle : sortArrowStyle}>
                        {sortArrow('a.id', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={thSortableStyle} title="Titel">
                    <a href={buildSortUrl('a.title', sortColumn, sortDirection, offset, filter)}
                       rmx-target={frames.adminContent} mix={sortLinkStyle}>
                      Titel
                      <span mix={'a.title' === sortColumn ? sortArrowActiveStyle : sortArrowStyle}>
                        {sortArrow('a.title', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={thSortableStyle} title="E-Mail">
                    <a href={buildSortUrl('u.email', sortColumn, sortDirection, offset, filter)}
                       rmx-target={frames.adminContent} mix={sortLinkStyle}>
                      E-Mail
                      <span mix={'u.email' === sortColumn ? sortArrowActiveStyle : sortArrowStyle}>
                        {sortArrow('u.email', sortColumn, sortDirection)}
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
                  <th mix={thSortableStyle} title="Datum">
                    <a href={buildSortUrl('a.date', sortColumn, sortDirection, offset, filter)}
                       rmx-target={frames.adminContent} mix={sortLinkStyle}>
                      Datum
                      <span mix={'a.date' === sortColumn ? sortArrowActiveStyle : sortArrowStyle}>
                        {sortArrow('a.date', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={thSortableStyle} title="Zeit">
                    <a href={buildSortUrl('a.during', sortColumn, sortDirection, offset, filter)}
                       rmx-target={frames.adminContent} mix={sortLinkStyle}>
                      Zeit
                      <span mix={'a.during' === sortColumn ? sortArrowActiveStyle : sortArrowStyle}>
                        {sortArrow('a.during', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={thSortableStyle} title="Erstellt">
                    <a href={buildSortUrl('a.created_at', sortColumn, sortDirection, offset, filter)}
                       rmx-target={frames.adminContent} mix={sortLinkStyle}>
                      Erstellt
                      <span mix={'a.created_at' === sortColumn ? sortArrowActiveStyle : sortArrowStyle}>
                        {sortArrow('a.created_at', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={thSortableStyle} title="Aktualisiert">
                    <a href={buildSortUrl('a.updated_at', sortColumn, sortDirection, offset, filter)}
                       rmx-target={frames.adminContent} mix={sortLinkStyle}>
                      Aktualisiert
                      <span mix={'a.updated_at' === sortColumn ? sortArrowActiveStyle : sortArrowStyle}>
                        {sortArrow('a.updated_at', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} mix={rowStyle} data-row-id={row.id}>
                    <td mix={tdStyle} title={row.id}>{row.id}</td>
                    <td mix={tdStyle} title={row.title}>{row.title}</td>
                    <td mix={tdStyle} title={row.user_email ?? ''}>
                      {row.user_email ?? '\u2014'}
                    </td>
                    <td mix={tdStyle} title={row.resource_description ?? ''}>
                      {row.resource_description ?? '\u2014'}
                    </td>
                    <td mix={tdStyle} title={formatDate(row.date)}>{formatDate(row.date)}</td>
                    <td mix={tdStyle} title={row.during}>{formatDuring(row.during)}</td>
                    <td mix={tdStyle} title={formatTimestamp(row.created_at)}>{formatTimestamp(row.created_at)}</td>
                    <td mix={tdStyle} title={formatTimestamp(row.updated_at)}>{formatTimestamp(row.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {/* Hidden DELETE forms for context menu — kept in DOM for .requestSubmit() */}
          {rows.length > 0 ? (
            <div style="display:none" aria-hidden="true">
              {rows.map((row) => (
                <RestfulForm
                  key={row.id}
                  method="DELETE"
                  action={`/admin/appointments/${row.id}`}
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
        <script id="appointments-grid-state" type="application/json">
          {JSON.stringify({
            offset: String(offset),
            sort: sortColumn,
            order: sortDirection,
            filter: filter ?? '',
          })}
        </script>
        <AdminAppointmentsContextMenu />
      </div>
    )

    // Two-column layout when editing or creating
    if (editRow || creating) {
      return (
        <div mix={pageStyle}>
          <h2 mix={titleStyle}>Appointments</h2>
          <div mix={twoColumnStyle}>
            {gridSection}
            <div style="position:sticky;top:1.5rem">
              {editRow ? (
                <AdminAppointmentsEditPage
                  row={editRow}
                  resources={resources}
                  users={users}
                  offset={String(offset)}
                  sort={sortColumn}
                  order={sortDirection}
                  filter={filter}
                />
              ) : creating ? (
                <AdminAppointmentsCreatePage
                  resources={resources}
                  users={users}
                  offset={String(offset)}
                  sort={sortColumn}
                  order={sortDirection}
                  filter={filter}
                  defaultStartMin={defaultStartMin}
                  defaultEndMin={defaultEndMin}
                />
              ) : null}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div mix={pageStyle}>
        <h2 mix={titleStyle}>Appointments</h2>
        {gridSection}
      </div>
    )
  }
}
