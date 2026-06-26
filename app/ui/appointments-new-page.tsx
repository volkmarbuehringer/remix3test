import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../lib/theme.ts'
import button from '../lib/button.ts'
import { Glyph } from '../lib/glyph.ts'

import { table } from './mixins/admin-table.ts'
import {
  sortArrow,
  buildSortUrl,
  buildPaginationUrl,
  buildCreateUrl,
  buildCancelUrl,
} from './mixins/admin-urls.ts'
import { formatDateDE } from '../utils/date-utils.ts'
import { RestfulForm } from './restful-form.tsx'
import { GridStateHiddenInputs } from './grid-state-hidden.tsx'
import { AppointmentsNewCreatePage } from './appointments-new-create-page.tsx'
import type {
  AppointmentsNewRow,
  ResourceOption,
  DayWithSlots,
} from '../actions/appointments-new/controller.tsx'
import { parseDuring } from '../data/appointofferings.ts'
import { AppointmentsScrollLock } from '../assets/appointments-scroll-lock.tsx'

const BASE = '/appointments/new'

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
  return BASE + '?' + params.toString()
}

interface AppointmentsNewPageProps {
  rows: AppointmentsNewRow[]
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter?: string
  period?: string
  status?: string
  deletingRow?: AppointmentsNewRow | null
  creating?: boolean
  resources: ResourceOption[]
  error?: string
  defaultStartMin?: number
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
  formError?: string
  step?: number
  wizardResourceId?: string
  weekStart?: number
  daysWithSlots?: DayWithSlots[]
}

function formatMinRange(startMin: number, endMin: number): string {
  let startH = String(Math.floor(startMin / 60)).padStart(2, '0')
  let startM = String(startMin % 60).padStart(2, '0')
  let endH = String(Math.floor(endMin / 60)).padStart(2, '0')
  let endM = String(endMin % 60).padStart(2, '0')
  return `${startH}:${startM}\u2013${endH}:${endM}`
}

function formatDuring(during: unknown): string {
  if (typeof during === 'object' && during !== null) {
    let r = during as { lower: number; upper: number }
    return formatMinRange(Number(r.lower), Number(r.upper))
  }
  if (typeof during === 'string') {
    let parsed = parseDuring(during)
    if (parsed) return formatMinRange(parsed.startMin, parsed.endMin)
  }
  return String(during)
}

const headerBarStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.space.lg,
})

const btnGroupStyle = css({
  display: 'inline-flex',
  alignItems: 'stretch',
})

const compactTd = css({
  padding: `${theme.space.xs} ${theme.space.sm}`,
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
  color: theme.colors.text.primary,
  verticalAlign: 'middle',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: theme.fontSize.xs,
})

const compactTh = css({
  textAlign: 'left',
  padding: `${theme.space.xs} ${theme.space.sm}`,
  background: theme.surface.lvl2,
  borderBottom: `1px solid ${theme.colors.border.default}`,
  whiteSpace: 'nowrap',
  fontSize: theme.fontSize.xs,
})

const lockedIconStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '2px',
  minWidth: '22px',
  minHeight: '22px',
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.secondary,
  opacity: 0.5,
})

const delBtnStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '2px',
  minWidth: '22px',
  minHeight: '22px',
  background: theme.colors.action.danger.background,
  color: theme.colors.action.danger.foreground,
  border: 'none',
  borderRadius: theme.radius.md,
  fontSize: theme.fontSize.xs,
  cursor: 'pointer',
  '&:hover': { opacity: 0.9 },
})

export function AppointmentsNewPage(handle: Handle<AppointmentsNewPageProps>) {
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
      deletingRow = null,
      creating = false,
      resources,
      error,
      defaultStartMin,
      formValues,
      fieldErrors,
      formError,
      step,
      wizardResourceId,
      weekStart,
      daysWithSlots,
    } = handle.props
    let pageStart = rows.length > 0 ? offset + 1 : 0
    let pageEnd = offset + rows.length

    let hasFormPanel = !!(deletingRow || creating)
    let gridSection = (
      <div mix={table.minWidth0}>
        {!hasFormPanel && formError ? <div mix={table.errorBanner}>{formError}</div> : null}
        {!hasFormPanel && error ? <div mix={table.errorBanner}>{error}</div> : null}

        <div
          mix={css({
            display: 'flex',
            flexDirection: 'column',
            gap: theme.space.xs,
            marginBottom: theme.space.md,
          })}
        >
          <div
            mix={css({
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: theme.space.sm,
            })}
          >
            <span mix={btnGroupStyle}>
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
                      <span mix={css({
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
                      })}>
                        <button disabled mix={[button({ tone: active ? 'primary' : 'secondary' })]}>{label}</button>
                      </span>
                    )
                  }
                  return (
                    <a
                      href={href}
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
                      <button mix={[button({ tone: active ? 'primary' : 'secondary' })]}>{label}</button>
                    </a>
                  )
                },
              )}
            </span>
          </div>
          <div
            mix={css({
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: theme.space.sm,
            })}
          >
            <span mix={btnGroupStyle}>
              {(['pending', 'expired'] as const).map((value, i, arr) => {
                let isFirst = i === 0
                let isLast = i === arr.length - 1
                let label = value === 'pending' ? 'Ausstehend' : 'Abgelaufen'
                let active =
                  value === 'pending' ? !status || status === 'pending' : status === 'expired'
                let params = new URLSearchParams()
                if (offset > 0) params.set('offset', String(offset))
                params.set('sort', sortColumn)
                params.set('order', sortDirection)
                if (filter) params.set('filter', filter)
                if (period) params.set('period', period)
                if (!active) params.set('status', value)
                let href = BASE + '?' + params.toString()
                return (
                  <a
                    href={href}
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
                    <button mix={[button({ tone: active ? 'primary' : 'secondary' })]}>{label}</button>
                  </a>
                )
              })}
            </span>
            <span mix={table.spacer} />
            <a
              href={buildCreateUrl(BASE, offset, sortColumn, sortDirection, filter, period, status)}
              mix={table.linkPlain}
            >
              <button mix={[button({ tone: 'primary' })]}>
                <Glyph name="add" width={14} height={14} /> Neu
              </button>
            </a>
          </div>
        </div>

        <div mix={table.wrap} data-appointments-table="true">
          {rows.length === 0 ? (
            <div mix={table.empty}>
              {filter ? 'Keine Termine gefunden für diese Suche.' : 'Keine Termine vorhanden.'}
            </div>
          ) : (
            <table mix={table.table}>
              <colgroup>
                <col />
                <col />
                <col />
                <col />
                <col mix={css({ width: '45px' })} />
              </colgroup>
              <thead>
                <tr>
                  <th mix={[table.thSortable, compactTh]} title="Titel">
                    <a
                      href={buildSortUrl(
                        BASE,
                        'a.title',
                        sortColumn,
                        sortDirection,
                        offset,
                        filter,
                        period,
                        status,
                      )}
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
                  <th mix={[table.thSortable, compactTh]} title="Ressource">
                    <a
                      href={buildSortUrl(
                        BASE,
                        'r.description',
                        sortColumn,
                        sortDirection,
                        offset,
                        filter,
                        period,
                        status,
                      )}
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
                  <th mix={[table.thSortable, compactTh]} title="Datum">
                    <a
                      href={buildSortUrl(
                        BASE,
                        'a.date',
                        sortColumn,
                        sortDirection,
                        offset,
                        filter,
                        period,
                        status,
                      )}
                      mix={table.sortLink}
                    >
                      Datum
                      <span mix={'a.date' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('a.date', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={[table.thSortable, compactTh]} title="Zeit">
                    <a
                      href={buildSortUrl(
                        BASE,
                        'a.during',
                        sortColumn,
                        sortDirection,
                        offset,
                        filter,
                        period,
                        status,
                      )}
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
                  <th mix={[table.th, compactTh, css({ textAlign: 'right' })]}>Löschen</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    mix={table.row}
                    data-row-id={row.id}
                  >
                    <td mix={[table.td, compactTd]} title={row.title}>
                      {row.title}
                    </td>
                    <td
                      mix={[table.td, compactTd]}
                      title={row.resource_name ?? row.resource_description ?? ''}
                    >
                      {row.resource_name ?? row.resource_description ?? '\u2014'}
                    </td>
                    <td mix={[table.td, compactTd]} title={formatDateDE(Number(row.date))}>
                      {formatDateDE(Number(row.date))}
                    </td>
                    <td mix={[table.td, compactTd]} title={row.during}>
                      {formatDuring(row.during)}
                    </td>
                    <td mix={[table.td, compactTd, css({ textAlign: 'right' })]}>
                      {row.blocked ? (
                        <span mix={lockedIconStyle} title="Nicht löschbar — weniger als 24 Stunden bis zum Beginn">
                          {'\u2014'}
                        </span>
                      ) : (
                        <a
                          href={`${BASE}?deleting=${row.id}&offset=${offset}&sort=${sortColumn}&order=${sortDirection}${filter ? '&filter=' + encodeURIComponent(filter) : ''}${period ? '&period=' + encodeURIComponent(period) : ''}${status ? '&status=' + encodeURIComponent(status) : ''}`}
                          mix={delBtnStyle}
                          title="Löschen"
                        >
                          <Glyph name="close" width={14} height={14} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

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
                    BASE,
                    prevOffset,
                    sortColumn,
                    sortDirection,
                    filter,
                    period,
                    status,
                  )}
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
                  href={buildPaginationUrl(
                    BASE,
                    nextOffset,
                    sortColumn,
                    sortDirection,
                    filter,
                    period,
                    status,
                  )}
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
      </div>
    )

    if (deletingRow || creating) {
      return (
        <div mix={table.page}>
          <AppointmentsScrollLock />
          <div mix={headerBarStyle}>
            <h2 mix={table.title}>Meine Termine</h2>
          </div>
          <div mix={table.twoColumn}>
            {gridSection}
            <div mix={table.stickyPanel}>
               {deletingRow ? (
                <div mix={table.panel}>
                  <div mix={table.panelHeader}>
                    <span mix={table.panelTitle}>Termin löschen</span>
                  </div>
                  <div mix={table.panelBody}>
                    {deletingRow.blocked ? (
                      <p
                        mix={css({
                          margin: 0,
                          fontSize: theme.fontSize.sm,
                          color: theme.colors.text.secondary,
                        })}
                      >
                        Dieser Termin kann nicht gelöscht werden, da weniger als 24 Stunden bis zum
                        Beginn verbleiben.
                      </p>
                    ) : (
                    <>
                    <p
                      mix={css({
                        margin: 0,
                        marginBottom: theme.space.md,
                        fontSize: theme.fontSize.sm,
                        color: theme.colors.text.secondary,
                      })}
                    >
                      Möchten Sie diesen Termin wirklich löschen?
                    </p>
                    <div
                      mix={css({
                        padding: theme.space.sm,
                        marginBottom: theme.space.md,
                        background: theme.surface.lvl2,
                        borderRadius: theme.radius.md,
                        fontSize: theme.fontSize.sm,
                      })}
                    >
                      <div>{deletingRow.title || '(kein Titel)'}</div>
                      <div
                        mix={css({
                          color: theme.colors.text.secondary,
                          fontSize: theme.fontSize.xs,
                          marginTop: theme.space.xs,
                        })}
                      >
                        {formatDateDE(Number(deletingRow.date))} –{' '}
                        {formatDuring(deletingRow.during)}
                      </div>
                    </div>
                    <RestfulForm method="DELETE" action={`${BASE}/${deletingRow.id}`}>
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
                      <div mix={table.actions}>
                        <button type="submit" mix={[button({ tone: 'danger' }), table.spacer]}>
                          Ja, löschen
                        </button>
                        <a
                          href={buildCancelUrl(
                            BASE,
                            String(offset),
                            sortColumn,
                            sortDirection,
                            filter,
                            period,
                            status,
                          )}
                          mix={table.linkPlain}
                        >
                          <button type="button" mix={[button({ tone: 'secondary' }), css({ width: '100%' })]}>
                            Abbrechen
                          </button>
                        </a>
                      </div>
                    </RestfulForm>
                    </>
                    )}
                  </div>
                </div>
               ) : creating ? (
                <AppointmentsNewCreatePage
                  resources={resources}
                  offset={String(offset)}
                  sort={sortColumn}
                  order={sortDirection}
                  filter={filter}
                  period={period}
                  status={status}
                  formValues={formValues}
                  fieldErrors={fieldErrors}
                  formError={formError}
                  step={step}
                  wizardResourceId={wizardResourceId}
                  weekStart={weekStart}
                  daysWithSlots={daysWithSlots}
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
          <h2 mix={table.title}>Meine Termine</h2>
        </div>
        {gridSection}
      </div>
    )
  }
}
