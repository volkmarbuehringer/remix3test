import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'
import { rotatedGlyphCss } from './mixins/icon.ts'
import button from '../ui/theme/button.ts'
import { Glyph } from '../ui/theme/glyph/glyph.tsx'

import { table } from './mixins/admin-table.ts'
import {
  sortArrow,
  buildSortUrl,
  buildPaginationUrl,
  buildCreateUrl,
  buildEditUrl,
  formatTimestamp,
} from './mixins/admin-urls.ts'

import { routes } from '../routes.ts'
import { getSelfFrameTarget } from '../utils/frame-target.ts'
import { AdminAppointmentsEditPage } from './admin-appointments-edit-page.tsx'
import { AdminAppointmentsCreatePage } from './admin-appointments-create-page.tsx'
import { RestfulForm } from './restful-form.tsx'
import { GridStateHiddenInputs } from './grid-state-hidden.tsx'
import { ConfirmDelete } from './confirm-delete.browser.tsx'
import { getTodayUtcMidnight } from '../utils/date-utils.ts'
import { AdminAppointmentsContextMenu } from '../actions/admin/public/admin-appointments-context-menu.tsx'
import { getCspNonce } from '../middleware/security-headers.ts'
import { ConnectionIndicator } from '../ui/connection-indicator.browser.tsx'
import type {
  AppointmentRow,
  AppointmentResourceOption,
  AppointmentUserOption,
} from '../data/appointments.ts'
import { parseDuring } from '../data/appointofferings.ts'

const ADMIN_BASE = routes.verwaltung.appointments.index.href()

function buildPeriodUrl(
  newPeriod: string | null,
  offset: number,
  sort: string,
  order: string,
  filter?: string,
  status?: string,
): string {
  let params = new URLSearchParams()
  if (offset > 0) params.set('offset', String(offset))
  params.set('sort', sort)
  params.set('order', order)
  if (filter) params.set('filter', filter)
  if (newPeriod) params.set('period', newPeriod)
  if (status) params.set('status', status)
  return ADMIN_BASE + '?' + params.toString()
}

interface AdminAppointmentsPageProps {
  rows: AppointmentRow[]
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
  period?: string
  status?: string
  editRow?: AppointmentRow | null
  creating?: boolean
  resources: AppointmentResourceOption[]
  users: AppointmentUserOption[]
  error?: string
  defaultStartMin?: number
  defaultEndMin?: number
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
  formError?: string
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

function sortRule(
  field: string,
  sortField: string,
  sortOrder: 'asc' | 'desc',
): 'ascending' | 'descending' | undefined {
  if (field !== sortField) return undefined
  return sortOrder === 'asc' ? 'ascending' : 'descending'
}

// ── Styles ──

const headerBarStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.space.lg,
})

const rowActionsStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
})

const iconActionStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '30px',
  height: '30px',
  padding: 0,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  background: theme.surface.lvl2,
  color: theme.colors.text.secondary,
  cursor: 'pointer',
  textDecoration: 'none',
  '&:hover': { background: theme.surface.lvl3, color: theme.colors.text.primary },
})

const iconActionDangerStyle = css({
  color: theme.colors.action.danger.background,
  borderColor: 'transparent',
  '&:hover': {
    background: theme.colors.action.danger.background,
    color: theme.colors.action.danger.foreground,
  },
})

const colActionsWidth = css({ width: '96px' })

const dateCellStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.space.xs,
  whiteSpace: 'nowrap',
})

// errorBannerStyle and editingRowStyle moved to mixin (table.errorBanner, table.editingRow)

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
      period,
      status,
      editRow = null,
      creating = false,
      resources,
      users,
      error,
      defaultStartMin,
      defaultEndMin,
      formValues,
      fieldErrors,
      formError,
    } = handle.props
    let pageStart = rows.length > 0 ? offset + 1 : 0
    let pageEnd = offset + rows.length

    let todayMidnight = getTodayUtcMidnight()

    let hasFormPanel = !!(editRow || creating)
    let gridSection = (
      <div mix={table.minWidth0}>
        <ConfirmDelete />
        {!hasFormPanel && formError ? <div mix={table.errorBanner}>{formError}</div> : null}
        {!hasFormPanel && error ? <div mix={table.errorBanner}>{error}</div> : null}
        {/* Toolbar + Filter combined */}
        <form
          method="GET"
          action={routes.verwaltung.appointments.index.href()}
          data-rmx-target={getSelfFrameTarget()}
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
            <Glyph name="search" width={14} height={14} /> Suchen
          </button>
          {filter && (
            <a
              href={routes.verwaltung.appointments.index.href()}
              data-rmx-target={getSelfFrameTarget()}
              mix={table.clearLink}
            >
              Zurücksetzen
            </a>
          )}
          <span mix={table.spacer} />
          <span
            mix={css({
              display: 'inline-flex',
              alignItems: 'center',
            })}
          >
            {(['', 'this-week', 'next-week', 'this-month', 'next-month'] as const).map(
              (value, i, arr) => {
                let isFirst = i === 0
                let isLast = i === arr.length - 1
                let label =
                  value === ''
                    ? 'Alle'
                    : {
                        'this-week': 'Diese Woche',
                        'next-week': 'Nächste Woche',
                        'this-month': 'Diesen Monat',
                        'next-month': 'Nächsten Monat',
                      }[value]
                let active = value === '' ? !period : period === value
                let href = active
                  ? buildPeriodUrl(null, offset, sortColumn, sortDirection, filter, status)
                  : buildPeriodUrl(value, offset, sortColumn, sortDirection, filter, status)
                if (status === 'expired') {
                  return (
                    <span
                      mix={css({
                        '& button': {
                          paddingLeft: theme.space.xs,
                          paddingRight: theme.space.xs,
                          borderTopLeftRadius: isFirst ? undefined : '0',
                          borderBottomLeftRadius: isFirst ? undefined : '0',
                          borderTopRightRadius: isLast ? undefined : '0',
                          borderBottomRightRadius: isLast ? undefined : '0',
                          borderRight: isLast ? '0' : `1px solid ${theme.colors.border}`,
                          opacity: 0.4,
                          cursor: 'not-allowed',
                          pointerEvents: 'none',
                        },
                      })}
                    >
                      <button disabled mix={[button({ tone: active ? 'primary' : 'secondary' })]}>
                        {label}
                      </button>
                    </span>
                  )
                }
                return (
                  <a
                    href={href}
                    data-rmx-target={getSelfFrameTarget()}
                    mix={css({
                      '& button': {
                        paddingLeft: theme.space.xs,
                        paddingRight: theme.space.xs,
                        borderTopLeftRadius: isFirst ? undefined : '0',
                        borderBottomLeftRadius: isFirst ? undefined : '0',
                        borderTopRightRadius: isLast ? undefined : '0',
                        borderBottomRightRadius: isLast ? undefined : '0',
                        borderRight: isLast ? '0' : `1px solid ${theme.colors.border}`,
                      },
                    })}
                  >
                    <button mix={[button({ tone: active ? 'primary' : 'secondary' })]}>
                      {label}
                    </button>
                  </a>
                )
              },
            )}
          </span>
          <span
            mix={css({
              display: 'inline-flex',
              alignItems: 'center',
            })}
          >
            {(['all', 'pending', 'expired'] as const).map((value, i, arr) => {
              let isFirst = i === 0
              let isLast = i === arr.length - 1
              let label =
                value === 'all' ? 'Alle' : value === 'pending' ? 'Ausstehend' : 'Abgelaufen'
              let active =
                value === 'pending'
                  ? !status || status === 'pending'
                  : value === 'expired'
                    ? status === 'expired'
                    : status === 'all'
              let params = new URLSearchParams()
              if (offset > 0) params.set('offset', String(offset))
              params.set('sort', sortColumn)
              params.set('order', sortDirection)
              if (filter) params.set('filter', filter)
              if (period) params.set('period', period)
              // Only omit `status` when this is the neutral default (pending) view;
              // re-clicking the active "Alle"/"Abgelaufen" tab must keep its own filter.
              if (!(value === 'pending' && (!status || status === 'pending'))) {
                params.set('status', value)
              }
              let href = ADMIN_BASE + '?' + params.toString()
              return (
                <a
                  href={href}
                  data-rmx-target={getSelfFrameTarget()}
                  mix={css({
                    '& button': {
                      paddingLeft: theme.space.xs,
                      paddingRight: theme.space.xs,
                      borderTopLeftRadius: isFirst ? undefined : '0',
                      borderBottomLeftRadius: isFirst ? undefined : '0',
                      borderTopRightRadius: isLast ? undefined : '0',
                      borderBottomRightRadius: isLast ? undefined : '0',
                      borderRight: isLast ? '0' : `1px solid ${theme.colors.border}`,
                    },
                  })}
                >
                  <button mix={[button({ tone: active ? 'primary' : 'secondary' })]}>
                    {label}
                  </button>
                </a>
              )
            })}
          </span>
          <a
            href={buildCreateUrl(
              ADMIN_BASE,
              offset,
              sortColumn,
              sortDirection,
              filter,
              period,
              status,
            )}
            data-rmx-target={getSelfFrameTarget()}
            mix={table.linkPlain}
          >
            <button mix={[button({ tone: 'primary' })]}>
              <Glyph name="add" width={14} height={14} /> Neu
            </button>
          </a>
        </form>

        {/* Table */}
        <div mix={table.wrap} data-appointments-table="true">
          {rows.length === 0 ? (
            <div mix={table.empty}>
              {filter ? 'Keine Termine gefunden für diese Suche.' : 'Keine Termine vorhanden.'}
              {!hasFormPanel && (
                <div mix={css({ marginTop: theme.space.md })}>
                  <a
                    href={buildCreateUrl(
                      ADMIN_BASE,
                      offset,
                      sortColumn,
                      sortDirection,
                      filter,
                      period,
                      status,
                    )}
                    data-rmx-target={getSelfFrameTarget()}
                    mix={table.linkPlain}
                  >
                    <button mix={[button({ tone: 'primary' })]}>
                      <Glyph name="add" width={14} height={14} /> Neu anlegen
                    </button>
                  </a>
                </div>
              )}
            </div>
          ) : (
            <table mix={table.table}>
              <colgroup>
                <col />
                <col />
                <col />
                <col />
                <col />
                <col />
                <col mix={colActionsWidth} />
              </colgroup>
              <thead>
                <tr>
                  <th
                    mix={table.thSortable}
                    aria-sort={sortRule('a.title', sortColumn, sortDirection)}
                    title="Titel"
                  >
                    <a
                      href={buildSortUrl(
                        ADMIN_BASE,
                        'a.title',
                        sortColumn,
                        sortDirection,
                        offset,
                        filter,
                        period,
                        status,
                      )}
                      data-rmx-target={getSelfFrameTarget()}
                      mix={table.sortLink}
                    >
                      Titel
                      <span
                        mix={'a.title' === sortColumn ? table.sortArrowActive : table.sortArrow}
                      >
                        {sortArrow('a.title', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th
                    mix={table.thSortable}
                    aria-sort={sortRule('u.email', sortColumn, sortDirection)}
                    title="E-Mail"
                  >
                    <a
                      href={buildSortUrl(
                        ADMIN_BASE,
                        'u.email',
                        sortColumn,
                        sortDirection,
                        offset,
                        filter,
                        period,
                        status,
                      )}
                      data-rmx-target={getSelfFrameTarget()}
                      mix={table.sortLink}
                    >
                      E-Mail
                      <span
                        mix={'u.email' === sortColumn ? table.sortArrowActive : table.sortArrow}
                      >
                        {sortArrow('u.email', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th
                    mix={table.thSortable}
                    aria-sort={sortRule('r.description', sortColumn, sortDirection)}
                    title="Ressource"
                  >
                    <a
                      href={buildSortUrl(
                        ADMIN_BASE,
                        'r.description',
                        sortColumn,
                        sortDirection,
                        offset,
                        filter,
                        period,
                        status,
                      )}
                      data-rmx-target={getSelfFrameTarget()}
                      mix={table.sortLink}
                    >
                      Ressource
                      <span
                        mix={
                          'r.description' === sortColumn ? table.sortArrowActive : table.sortArrow
                        }
                      >
                        {sortArrow('r.description', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th
                    mix={table.thSortable}
                    aria-sort={sortRule('a.date', sortColumn, sortDirection)}
                    title="Datum"
                  >
                    <a
                      href={buildSortUrl(
                        ADMIN_BASE,
                        'a.date',
                        sortColumn,
                        sortDirection,
                        offset,
                        filter,
                        period,
                        status,
                      )}
                      data-rmx-target={getSelfFrameTarget()}
                      mix={table.sortLink}
                    >
                      Datum
                      <span mix={'a.date' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('a.date', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th
                    mix={table.thSortable}
                    aria-sort={sortRule('a.during', sortColumn, sortDirection)}
                    title="Zeit"
                  >
                    <a
                      href={buildSortUrl(
                        ADMIN_BASE,
                        'a.during',
                        sortColumn,
                        sortDirection,
                        offset,
                        filter,
                        period,
                        status,
                      )}
                      data-rmx-target={getSelfFrameTarget()}
                      mix={table.sortLink}
                    >
                      Zeit
                      <span
                        mix={'a.during' === sortColumn ? table.sortArrowActive : table.sortArrow}
                      >
                        {sortArrow('a.during', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th
                    mix={table.thSortable}
                    aria-sort={sortRule('a.updated_at', sortColumn, sortDirection)}
                    title="Aktualisiert"
                  >
                    <a
                      href={buildSortUrl(
                        ADMIN_BASE,
                        'a.updated_at',
                        sortColumn,
                        sortDirection,
                        offset,
                        filter,
                        period,
                        status,
                      )}
                      data-rmx-target={getSelfFrameTarget()}
                      mix={table.sortLink}
                    >
                      Aktualisiert
                      <span
                        mix={
                          'a.updated_at' === sortColumn ? table.sortArrowActive : table.sortArrow
                        }
                      >
                        {sortArrow('a.updated_at', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={[table.th, colActionsWidth]}>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    mix={[table.row, editRow?.id === row.id ? table.editingRow : undefined]}
                    data-row-id={row.id}
                  >
                    <td mix={table.td} title={row.title}>
                      {row.title}
                    </td>
                    <td mix={table.td} title={row.user_email ?? ''}>
                      {row.user_email ?? '\u2014'}
                    </td>
                    <td mix={table.td} title={row.resource_description ?? row.resource_name ?? ''}>
                      {row.resource_name ?? row.resource_description ?? '\u2014'}
                    </td>
                    <td mix={table.td} title={formatDate(row.date)}>
                      <span mix={dateCellStyle}>
                        <span
                          mix={[
                            table.statusBadge,
                            Number(row.date) < todayMidnight
                              ? table.statusBadgeDisabled
                              : table.statusBadgeActive,
                          ]}
                        >
                          {Number(row.date) < todayMidnight ? 'Abgelaufen' : 'Ausstehend'}
                        </span>
                        {formatDate(row.date)}
                      </span>
                    </td>
                    <td mix={table.td} title={row.during}>
                      {formatDuring(row.during)}
                    </td>
                    <td mix={table.td} title={formatTimestamp(row.updated_at)}>
                      {formatTimestamp(row.updated_at)}
                    </td>
                    <td mix={table.actionCell}>
                      <div mix={rowActionsStyle}>
                        <a
                          href={buildEditUrl(
                            ADMIN_BASE,
                            row.id,
                            offset,
                            sortColumn,
                            sortDirection,
                            filter,
                            period,
                            status,
                          )}
                          data-rmx-target={getSelfFrameTarget()}
                          mix={iconActionStyle}
                          aria-label="Bearbeiten"
                          title="Bearbeiten"
                        >
                          <Glyph name="edit" width={14} height={14} />
                        </a>

                        <RestfulForm
                          method="DELETE"
                          action={routes.verwaltung.appointments.destroy.href({ id: row.id })}
                          data-delete-form={row.id}
                          data-confirm={`Termin "${row.title}" wirklich löschen?`}
                          data-rmx-target={getSelfFrameTarget()}
                          mix={css({ margin: 0, padding: 0 })}
                        >
                          <GridStateHiddenInputs
                            state={{
                              offset: String(offset),
                              sort: sortColumn,
                              order: sortDirection,
                              filter: filter ?? '',
                              period: period ?? '',
                              status: status ?? '',
                            }}
                          />
                          <button
                            type="submit"
                            mix={[iconActionStyle, iconActionDangerStyle]}
                            aria-label="Löschen"
                            title="Löschen"
                          >
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
          <div mix={table.pagination}>
            {rows.length > 0 && (
              <span mix={table.paginationInfo}>
                Zeige {pageStart}–{pageEnd}
              </span>
            )}
            <div mix={table.flexGapSm}>
              {offset > 0 ? (
                <a
                  href={buildPaginationUrl(
                    ADMIN_BASE,
                    prevOffset,
                    sortColumn,
                    sortDirection,
                    filter,
                    period,
                    status,
                  )}
                  data-rmx-target={getSelfFrameTarget()}
                  mix={table.pageLink}
                >
                  <Glyph name="chevronRight" width={14} height={14} mix={rotatedGlyphCss} /> Zurück
                </a>
              ) : (
                <span mix={table.pageLinkDisabled}>
                  <Glyph name="chevronRight" width={14} height={14} mix={rotatedGlyphCss} /> Zurück
                </span>
              )}
              {hasMore ? (
                <a
                  href={buildPaginationUrl(
                    ADMIN_BASE,
                    nextOffset,
                    sortColumn,
                    sortDirection,
                    filter,
                    period,
                    status,
                  )}
                  data-rmx-target={getSelfFrameTarget()}
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
            period: period ?? '',
            status: status ?? '',
            baseHref: routes.verwaltung.appointments.index.href(),
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
              url={routes.verwaltung.appointments.events.href()}
              reloadMode="frame"
              skipReloadParams={['editing', 'creating']}
            />
          </div>
          <div mix={table.twoColumn}>
            {gridSection}
            <div mix={table.stickyPanel}>
              {editRow ? (
                <AdminAppointmentsEditPage
                  row={editRow}
                  resources={resources}
                  users={users}
                  offset={String(offset)}
                  sort={sortColumn}
                  order={sortDirection}
                  filter={filter}
                  period={period}
                  status={status}
                  formValues={formValues}
                  fieldErrors={fieldErrors}
                  formError={formError}
                />
              ) : creating ? (
                <AdminAppointmentsCreatePage
                  resources={resources}
                  users={users}
                  offset={String(offset)}
                  sort={sortColumn}
                  order={sortDirection}
                  filter={filter}
                  period={period}
                  status={status}
                  defaultStartMin={defaultStartMin}
                  defaultEndMin={defaultEndMin}
                  formValues={formValues}
                  fieldErrors={fieldErrors}
                  formError={formError}
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
            url={routes.verwaltung.appointments.events.href()}
            reloadMode="frame"
            skipReloadParams={['editing', 'creating']}
          />
        </div>
        {gridSection}
      </div>
    )
  }
}
