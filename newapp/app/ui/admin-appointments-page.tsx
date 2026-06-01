import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { Button } from 'remix/ui/button'
import { Glyph } from 'remix/ui/glyph'

import { table } from './mixins/admin-table.ts'
import { sortArrow, buildSortUrl, buildPaginationUrl, buildCreateUrl, formatTimestamp } from './mixins/admin-urls.ts'

import { frames } from '../routes.ts'
import { AdminAppointmentsEditPage } from './admin-appointments-edit-page.tsx'
import { AdminAppointmentsCreatePage } from './admin-appointments-create-page.tsx'
import { RestfulForm } from './restful-form.tsx'
import { GridStateHiddenInputs } from './grid-state-hidden.tsx'
import { AdminAppointmentsContextMenu } from '../assets/admin-appointments-context-menu.tsx'
import { getCspNonce } from '../middleware/security-headers.ts'
import { ConnectionIndicator } from '../assets/connection-indicator.tsx'
import type {
  AppointmentRow,
  ResourceOption,
  UserOption,
} from '../actions/admin-appointments-controller.tsx'
import { parseDuring } from '../data/appointofferings.ts'

const ADMIN_BASE = '/admin/appointments'

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

function formatDate(day: string): string {
  return new Date(Number(day)).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
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

const headerBarStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.space.lg,
})

const errorBannerStyle = css({
  padding: theme.space.sm,
  marginBottom: theme.space.md,
  background: theme.colors.action.danger.background,
  color: theme.colors.action.danger.foreground,
  borderRadius: theme.radius.md,
  fontSize: theme.fontSize.sm,
})

// ── Component ──

export function AdminAppointmentsPage(handle: Handle<AdminAppointmentsPageProps>) {
  return () => {
    let {
      rows,
      offset,
      hasMore,
      prevOffset,
      nextOffset,
      sortColumn,
      sortDirection,
      filter,
      editRow = null,
      creating = false,
      resources,
      users,
      error,
      defaultStartMin,
      defaultEndMin,
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
          mix={table.filterBar}
        >
          <input
            type="text"
            name="filter"
            placeholder="Suche nach Titel, E-Mail oder Ressource..."
            defaultValue={filter ?? ''}
            mix={table.filterInput}
          />
          <button type="submit" mix={table.searchBtn}>
            Suchen
          </button>
          {filter && (
            <a href="/admin/appointments" rmx-target={frames.adminContent} mix={table.clearLink}>
              Zurücksetzen
            </a>
          )}
          <span style="flex:1" />
          <a
            href={buildCreateUrl(ADMIN_BASE, offset, sortColumn, sortDirection, filter)}
            rmx-target={frames.adminContent}
            style={{ textDecoration: 'none' }}
          >
            <Button tone="primary">+ Neu</Button>
          </a>
        </form>

        {/* Table */}
        <div mix={table.wrap} data-appointments-table="true">
          {rows.length === 0 ? (
            <div mix={table.empty}>
              {filter ? 'Keine Termine gefunden für diese Suche.' : 'Keine Termine vorhanden.'}
            </div>
          ) : (
            <table mix={table.table}>
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
                  <th mix={table.thSortable} title="ID">
                    <a
                      href={buildSortUrl(ADMIN_BASE, 'a.id', sortColumn, sortDirection, offset, filter)}
                      rmx-target={frames.adminContent}
                      mix={table.sortLink}
                    >
                      ID
                      <span mix={'a.id' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('a.id', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.thSortable} title="Titel">
                    <a
                      href={buildSortUrl(ADMIN_BASE, 'a.title', sortColumn, sortDirection, offset, filter)}
                      rmx-target={frames.adminContent}
                      mix={table.sortLink}
                    >
                      Titel
                      <span mix={'a.title' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('a.title', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.thSortable} title="E-Mail">
                    <a
                      href={buildSortUrl(ADMIN_BASE, 'u.email', sortColumn, sortDirection, offset, filter)}
                      rmx-target={frames.adminContent}
                      mix={table.sortLink}
                    >
                      E-Mail
                      <span mix={'u.email' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('u.email', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.thSortable} title="Ressource">
                    <a
                      href={buildSortUrl(ADMIN_BASE, 
                        'r.description',
                        sortColumn,
                        sortDirection,
                        offset,
                        filter,
                      )}
                      rmx-target={frames.adminContent}
                      mix={table.sortLink}
                    >
                      Ressource
                      <span
                        mix={'r.description' === sortColumn ? table.sortArrowActive : table.sortArrow}
                      >
                        {sortArrow('r.description', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.thSortable} title="Datum">
                    <a
                      href={buildSortUrl(ADMIN_BASE, 'a.date', sortColumn, sortDirection, offset, filter)}
                      rmx-target={frames.adminContent}
                      mix={table.sortLink}
                    >
                      Datum
                      <span mix={'a.date' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('a.date', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.thSortable} title="Zeit">
                    <a
                      href={buildSortUrl(ADMIN_BASE, 'a.during', sortColumn, sortDirection, offset, filter)}
                      rmx-target={frames.adminContent}
                      mix={table.sortLink}
                    >
                      Zeit
                      <span mix={'a.during' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('a.during', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.thSortable} title="Erstellt">
                    <a
                      href={buildSortUrl(ADMIN_BASE, 'a.created_at', sortColumn, sortDirection, offset, filter)}
                      rmx-target={frames.adminContent}
                      mix={table.sortLink}
                    >
                      Erstellt
                      <span
                        mix={'a.created_at' === sortColumn ? table.sortArrowActive : table.sortArrow}
                      >
                        {sortArrow('a.created_at', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.thSortable} title="Aktualisiert">
                    <a
                      href={buildSortUrl(ADMIN_BASE, 'a.updated_at', sortColumn, sortDirection, offset, filter)}
                      rmx-target={frames.adminContent}
                      mix={table.sortLink}
                    >
                      Aktualisiert
                      <span
                        mix={'a.updated_at' === sortColumn ? table.sortArrowActive : table.sortArrow}
                      >
                        {sortArrow('a.updated_at', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} mix={table.row} data-row-id={row.id}>
                    <td mix={table.td} title={row.id}>
                      {row.id}
                    </td>
                    <td mix={table.td} title={row.title}>
                      {row.title}
                    </td>
                    <td mix={table.td} title={row.user_email ?? ''}>
                      {row.user_email ?? '\u2014'}
                    </td>
                    <td mix={table.td} title={row.resource_description ?? ''}>
                      {row.resource_description ?? '\u2014'}
                    </td>
                    <td mix={table.td} title={formatDate(row.date)}>
                      {formatDate(row.date)}
                    </td>
                    <td mix={table.td} title={row.during}>
                      {formatDuring(row.during)}
                    </td>
                    <td mix={table.td} title={formatTimestamp(row.created_at)}>
                      {formatTimestamp(row.created_at)}
                    </td>
                    <td mix={table.td} title={formatTimestamp(row.updated_at)}>
                      {formatTimestamp(row.updated_at)}
                    </td>
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
          <div mix={table.pagination}>
            {rows.length > 0 && (
              <span mix={table.paginationInfo}>
                Zeige {pageStart}–{pageEnd}
              </span>
            )}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {offset > 0 ? (
                <a
                  href={buildPaginationUrl(ADMIN_BASE, prevOffset, sortColumn, sortDirection, filter)}
                  rmx-target={frames.adminContent}
                  mix={table.pageLink}
                >
                  <Glyph
                    name="chevronRight"
                    width={14}
                    height={14}
                    style={{ transform: 'rotate(180deg)' }}
                  />{' '}
                  Zurück
                </a>
              ) : (
                <span mix={table.pageLinkDisabled}>
                  <Glyph
                    name="chevronRight"
                    width={14}
                    height={14}
                    style={{ transform: 'rotate(180deg)' }}
                  />{' '}
                  Zurück
                </span>
              )}
              {hasMore ? (
                <a
                  href={buildPaginationUrl(ADMIN_BASE, nextOffset, sortColumn, sortDirection, filter)}
                  rmx-target={frames.adminContent}
                  mix={table.pageLink}
                >
                  Weiter <Glyph name="chevronRight" width={14} height={14} />
                </a>
              ) : (
                <span mix={table.pageLinkDisabled}>
                  Weiter <Glyph name="chevronRight" width={14} height={14} />
                </span>
              )}
            </div>
          </div>
        )}

        {/* Context menu data and clientEntry */}
        <script id="appointments-grid-state" type="application/json" nonce={getCspNonce()}>
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
        <div mix={table.page}>
          <div mix={headerBarStyle}>
            <h2 mix={table.title}>Termine</h2>
            <ConnectionIndicator
              {...({
                url: '/admin/appointments/events',
                reloadMode: 'frame',
                skipReloadParams: ['editing', 'creating'],
              } as any)}
            />
          </div>
          <div mix={table.twoColumn}>
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
      <div mix={table.page}>
        <div mix={headerBarStyle}>
          <h2 mix={table.title}>Termine</h2>
          <ConnectionIndicator
            {...({
              url: '/admin/appointments/events',
              reloadMode: 'frame',
              skipReloadParams: ['editing', 'creating'],
            } as any)}
          />
        </div>
        {gridSection}
      </div>
    )
  }
}
