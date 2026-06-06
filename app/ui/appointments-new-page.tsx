import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { Button } from 'remix/ui/button'
import { Glyph } from 'remix/ui/glyph'

import { table } from './mixins/admin-table.ts'
import { sortArrow, buildSortUrl, buildPaginationUrl, buildCreateUrl } from './mixins/admin-urls.ts'
import { RestfulForm } from './restful-form.tsx'
import { GridStateHiddenInputs } from './grid-state-hidden.tsx'
import { AppointmentsNewEditPage } from './appointments-new-edit-page.tsx'
import { AppointmentsNewCreatePage } from './appointments-new-create-page.tsx'
import type { AppointmentsNewRow, ResourceOption } from '../actions/appointments-new/controller.tsx'
import { parseDuring } from '../data/appointofferings.ts'

const BASE = '/appointments/new'

function buildPeriodUrl(newPeriod: string | null, offset: number, sort: string, order: string, filter?: string): string {
  let params = new URLSearchParams()
  if (offset > 0) params.set('offset', String(offset))
  params.set('sort', sort)
  params.set('order', order)
  if (filter) params.set('filter', filter)
  if (newPeriod) params.set('period', newPeriod)
  return BASE + '?' + params.toString()
}

function buildEditUrl(id: string | number, offset: number, sort: string, order: string, filter?: string, period?: string): string {
  let params = new URLSearchParams()
  params.set('editing', String(id))
  params.set('offset', String(offset))
  params.set('sort', sort)
  params.set('order', order)
  if (filter) params.set('filter', filter)
  if (period) params.set('period', period)
  return `${BASE}?${params.toString()}`
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
  editRow?: AppointmentsNewRow | null
  creating?: boolean
  resources: ResourceOption[]
  error?: string
  defaultStartMin?: number
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
  formError?: string
  step?: number
  wizardResourceId?: string
  wizardDay?: number
  daysWithOfferings?: { day: number; ranges: { startMin: number; endMin: number }[] }[]
  fullHourSlots?: number[]
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

const editBtnStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '2px',
  minWidth: '22px',
  minHeight: '22px',
  background: theme.surface.lvl2,
  color: theme.colors.text.secondary,
  border: `1px solid ${theme.colors.border.default}`,
  borderRight: 'none',
  borderRadius: `${theme.radius.md} 0 0 ${theme.radius.md}`,
  fontSize: theme.fontSize.xs,
  textDecoration: 'none',
  cursor: 'pointer',
  '&:hover': { background: theme.surface.lvl3, color: theme.colors.text.primary },
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
  borderRadius: `0 ${theme.radius.md} ${theme.radius.md} 0`,
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
      editRow = null,
      creating = false,
      resources,
      error,
      defaultStartMin,
      formValues,
      fieldErrors,
      formError,
      step,
      wizardResourceId,
      wizardDay,
      daysWithOfferings,
      fullHourSlots,
    } = handle.props
    let pageStart = rows.length > 0 ? offset + 1 : 0
    let pageEnd = offset + rows.length

    let hasFormPanel = !!(editRow || creating)
    let gridSection = (
      <div mix={table.minWidth0}>
        {!hasFormPanel && formError ? <div mix={table.errorBanner}>{formError}</div> : null}
        {!hasFormPanel && error ? <div mix={table.errorBanner}>{error}</div> : null}

        <div mix={[table.filterBar, css({ flexWrap: 'wrap' })]}>
          <span mix={css({
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: theme.space.xs,
          })}>
            {(['', 'this-week', 'next-week', 'this-month', 'next-month'] as const).map((value, i, arr) => {
              let isFirst = i === 0
              let isLast = i === arr.length - 1
              let label = value === '' ? 'Alle' : { 'this-week': 'Diese Woche', 'next-week': 'Nächste Woche', 'this-month': 'Diesen Monat', 'next-month': 'Nächsten Monat' }[value]
              let active = value === '' ? !period : period === value
              let href = active
                ? buildPeriodUrl(null, offset, sortColumn, sortDirection, filter)
                : buildPeriodUrl(value, offset, sortColumn, sortDirection, filter)
              return (
                <a
                  href={href}
                  mix={css({
                    '& button': {
                      paddingLeft: theme.space.sm,
                      paddingRight: theme.space.sm,
                      borderTopLeftRadius: isFirst ? undefined : '0',
                      borderBottomLeftRadius: isFirst ? undefined : '0',
                      borderTopRightRadius: isLast ? undefined : '0',
                      borderBottomRightRadius: isLast ? undefined : '0',
                      borderRight: isLast ? '0' : `1px solid ${theme.colors.border}`,
                    },
                  })}
                >
                  <Button tone={active ? 'primary' : 'secondary'}>{label}</Button>
                </a>
              )
            })}
          </span>
          <span mix={table.spacer} />
          <a
            href={buildCreateUrl(BASE, offset, sortColumn, sortDirection, filter, period)}
            mix={table.linkPlain}
          >
            <Button tone="primary"><Glyph name="add" width={14} height={14} /> Neu</Button>
          </a>
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
                <col mix={css({ width: '65px' })} />
              </colgroup>
              <thead>
                <tr>
                  <th mix={[table.thSortable, compactTh]} title="Titel">
                    <a
                      href={buildSortUrl(BASE, 'a.title', sortColumn, sortDirection, offset, filter, period)}
                      mix={table.sortLink}
                    >
                      Titel
                      <span mix={'a.title' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('a.title', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={[table.thSortable, compactTh]} title="Ressource">
                    <a
                      href={buildSortUrl(BASE, 'r.description', sortColumn, sortDirection, offset, filter, period)}
                      mix={table.sortLink}
                    >
                      Ressource
                      <span mix={'r.description' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('r.description', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={[table.thSortable, compactTh]} title="Datum">
                    <a
                      href={buildSortUrl(BASE, 'a.date', sortColumn, sortDirection, offset, filter, period)}
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
                      href={buildSortUrl(BASE, 'a.during', sortColumn, sortDirection, offset, filter, period)}
                      mix={table.sortLink}
                    >
                      Zeit
                      <span mix={'a.during' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('a.during', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={[table.th, compactTh, css({ textAlign: 'right' })]}>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} mix={[table.row, editRow?.id === row.id ? table.editingRow : undefined]} data-row-id={row.id}>
                    <td mix={[table.td, compactTd]} title={row.title}>{row.title}</td>
                    <td mix={[table.td, compactTd]} title={row.resource_description ?? ''}>
                      {row.resource_description ?? '\u2014'}
                    </td>
                    <td mix={[table.td, compactTd]} title={formatDate(row.date)}>{formatDate(row.date)}</td>
                    <td mix={[table.td, compactTd]} title={row.during}>{formatDuring(row.during)}</td>
                    <td mix={[table.td, compactTd, css({ textAlign: 'right' })]}>
                      <div mix={btnGroupStyle}>
                        <a
                          href={buildEditUrl(row.id, offset, sortColumn, sortDirection, filter, period)}
                          mix={editBtnStyle}
                          title="Bearbeiten"
                        >
                          <Glyph name="edit" width={14} height={14} />
                        </a>
                        <RestfulForm
                          method="DELETE"
                          action={`/appointments/new/${row.id}`}
                          data-delete-form={row.id}
                        >
                          <GridStateHiddenInputs
                            state={{
                              offset: String(offset),
                              sort: sortColumn,
                              order: sortDirection,
                              filter: filter ?? '',
                              period: period ?? '',
                            }}
                          />
                          <button
                            type="submit"
                            mix={delBtnStyle}
                            title="Löschen"
                          >
                            <Glyph name="close" width={14} height={14} />
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
                  href={buildPaginationUrl(BASE, prevOffset, sortColumn, sortDirection, filter, period)}
                  mix={table.pageLink}
                >
                  <Glyph name="chevronRight" width={14} height={14} style={{ transform: 'rotate(180deg)' }} />{' '}
                  Zurück
                </a>
              ) : (
                <span mix={table.pageLinkDisabled}>
                  <Glyph name="chevronRight" width={14} height={14} style={{ transform: 'rotate(180deg)' }} />{' '}
                  Zurück
                </span>
              )}
              {hasMore ? (
                <a
                  href={buildPaginationUrl(BASE, nextOffset, sortColumn, sortDirection, filter, period)}
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

    if (editRow || creating) {
      return (
        <div mix={table.page}>
          <div mix={headerBarStyle}>
            <h2 mix={table.title}>Meine Termine</h2>
          </div>
          <div mix={table.twoColumn}>
            {gridSection}
            <div mix={table.stickyPanel}>
              {editRow ? (
                <AppointmentsNewEditPage
                  row={editRow}
                  resources={resources}
                  offset={String(offset)}
                  sort={sortColumn}
                  order={sortDirection}
                  filter={filter}
                  period={period}
                  formValues={formValues}
                  fieldErrors={fieldErrors}
                  formError={formError}
                  fullHourSlots={fullHourSlots}
                />
              ) : creating ? (
                <AppointmentsNewCreatePage
                  resources={resources}
                  offset={String(offset)}
                  sort={sortColumn}
                  order={sortDirection}
                  filter={filter}
                  period={period}
                  defaultStartMin={defaultStartMin}
                  formValues={formValues}
                  fieldErrors={fieldErrors}
                  formError={formError}
                  step={step}
                  wizardResourceId={wizardResourceId}
                  wizardDay={wizardDay}
                  daysWithOfferings={daysWithOfferings}
                  fullHourSlots={fullHourSlots}
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
