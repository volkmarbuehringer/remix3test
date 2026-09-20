import type { Handle, RemixNode } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'
import { monthNameDE } from '../utils/date-utils.ts'
import { routes } from '../routes.ts'
import { getSelfFrameTarget } from '../utils/frame-target.ts'
import { Glyph } from '../ui/theme/glyph/glyph.tsx'
import { table } from './mixins/admin-table.ts'
import { sortArrow, sortRule } from './mixins/admin-urls.ts'
import type { Report1Row, Report1UserOption } from '../data/report1.ts'
import { Report1FilterAutoSubmit } from './report1-filter-autosubmit.browser.tsx'

const REPORT_COLUMNS: [field: string, label: string, hint?: string][] = [
  ['name', 'Name'],
  ['count', 'Anzahl'],
  ['min_date', 'Erster Termin'],
  ['max_date', 'Letzter Termin'],
  ['total_hours', 'Std. gesamt', 'Stunden gesamt im Zeitraum'],
  ['avg_hours', 'Ø Std./Termin', 'Durchschnittliche Stunden pro Termin'],
]

interface AdminReport1PageProps {
  rows: Report1Row[]
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
  year: number
  month: number
  selectedUserId: number | undefined
  users: Report1UserOption[]
}

/**
 * The filter/sort state every sub-render (filter bar, table, pagination) needs
 * to rebuild its URLs. Kept as one object so the helpers below stay short.
 */
interface Report1ViewState {
  year: number
  month: number
  selectedUserId: number | undefined
  filter: string
  sortColumn: string
  sortDirection: 'asc' | 'desc'
}

const BASE = routes.verwaltung.report1.index.href()

/** Heading row: title on the left, PDF export on the right. */
const titleBar = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space.sm,
  flexWrap: 'wrap',
  marginBottom: theme.space.sm,
})

/** Block link so the two-line name/email cell can ellipsize inside the cell. */
const userLink = css({
  display: 'block',
  minWidth: 0,
  maxWidth: '100%',
  textDecoration: 'none',
})

function buildUrl(overrides: Record<string, string | undefined>): string {
  let params = new URLSearchParams()
  let p = {
    year: String(overrides.year ?? ''),
    month: String(overrides.month ?? ''),
    user_id: overrides.selectedUserId ?? '',
    offset: overrides.offset ?? '0',
    sort: overrides.sort ?? 'name',
    order: overrides.order ?? 'asc',
    filter: overrides.filter ?? '',
  }
  if (p.year) params.set('year', p.year)
  if (p.month) params.set('month', p.month)
  if (p.user_id) params.set('user_id', p.user_id)
  if (p.offset && p.offset !== '0') params.set('offset', p.offset)
  params.set('sort', p.sort)
  params.set('order', p.order)
  if (p.filter) params.set('filter', p.filter)
  let qs = params.toString()
  return BASE + (qs ? '?' + qs : '')
}

/** Rebuilds the current view with a different offset — used by prev/next. */
function listUrl(state: Report1ViewState, offset: string): string {
  return buildUrl({
    offset,
    sort: state.sortColumn,
    order: state.sortDirection,
    year: String(state.year),
    month: String(state.month),
    selectedUserId: state.selectedUserId !== undefined ? String(state.selectedUserId) : undefined,
    filter: state.filter || undefined,
  })
}

/** PDF export URL for the current view (exports all rows, not just this page). */
function pdfUrl(state: Report1ViewState): string {
  let params = new URLSearchParams()
  params.set('year', String(state.year))
  params.set('month', String(state.month))
  if (state.selectedUserId !== undefined) params.set('user_id', String(state.selectedUserId))
  if (state.filter) params.set('filter', state.filter)
  params.set('sort', state.sortColumn)
  params.set('order', state.sortDirection)
  return `${routes.verwaltung.report1.pdf.href()}?${params.toString()}`
}

/**
 * Drill-down target for a report row: the appointments grid filtered to the
 * row's user. `status=all` matters because the grid defaults to future
 * ("pending") appointments, so a past report month would otherwise open empty.
 */
function buildUserAppointmentsUrl(email: string): string {
  let params = new URLSearchParams()
  params.set('filter', email)
  params.set('status', 'all')
  params.set('sort', 'a.date')
  params.set('order', 'desc')
  return `${routes.verwaltung.appointments.index.href()}?${params.toString()}`
}

function fmtDate(ts: number | null): string {
  if (!ts) return '—'
  return new Date(Number(ts)).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function fmtHours(min: number | null): string {
  if (!min) return '—'
  return (Number(min) / 60).toLocaleString('de-DE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

function Report1FilterBar(state: Report1ViewState, users: Report1UserOption[]): RemixNode {
  return (
    <form
      method="GET"
      action={BASE}
      data-rmx-target={getSelfFrameTarget()}
      data-report1-filters="true"
      mix={table.filterBar}
    >
      <Report1FilterAutoSubmit />

      <select name="year" aria-label="Jahr" mix={table.filterSelect}>
        {Array.from({ length: 5 }, (_, i) => {
          let y = state.year - 2 + i
          return (
            <option key={y} value={y} selected={y === state.year}>
              {y}
            </option>
          )
        })}
      </select>

      <select name="month" aria-label="Monat" mix={table.filterSelect}>
        {Array.from({ length: 12 }, (_, i) => (
          <option key={i} value={i + 1} selected={i + 1 === state.month}>
            {monthNameDE(i + 1)}
          </option>
        ))}
      </select>

      <select name="user_id" aria-label="Benutzer" mix={table.filterSelect}>
        <option value="" selected={state.selectedUserId === undefined}>
          Alle Benutzer
        </option>
        {users.map((u) => (
          <option key={u.id} value={u.id} selected={state.selectedUserId === Number(u.id)}>
            {u.name}
          </option>
        ))}
      </select>

      <input
        type="text"
        name="filter"
        placeholder="Filter (Name)"
        aria-label="Nach Name filtern"
        value={state.filter}
        mix={table.filterInput}
      />
      <input type="hidden" name="sort" value={state.sortColumn} />
      <input type="hidden" name="order" value={state.sortDirection} />
      <input type="hidden" name="offset" value="0" />

      <button type="submit" mix={table.searchBtn}>
        <Glyph name="search" width={14} height={14} /> Filtern
      </button>

      {(state.filter ||
        state.year !== new Date().getUTCFullYear() ||
        state.month !== new Date().getUTCMonth() + 1 ||
        state.selectedUserId !== undefined) && (
        <a href={BASE} mix={table.clearLink}>
          Zurücksetzen
        </a>
      )}
    </form>
  )
}

function Report1Table(state: Report1ViewState, rows: Report1Row[]): RemixNode {
  return (
    <div mix={[table.wrap, table.mobileCards]}>
      <table mix={table.table}>
        <thead>
          <tr>
            {REPORT_COLUMNS.map(([field, label, hint]) => (
              <th
                key={field}
                scope="col"
                aria-sort={sortRule(field, state.sortColumn, state.sortDirection)}
                mix={table.thSortable}
              >
                <a
                  href={buildUrl({
                    sort: field,
                    order:
                      field === state.sortColumn
                        ? state.sortDirection === 'asc'
                          ? 'desc'
                          : 'asc'
                        : 'asc',
                    offset: '0',
                    year: String(state.year),
                    month: String(state.month),
                    selectedUserId:
                      state.selectedUserId !== undefined ? String(state.selectedUserId) : undefined,
                    filter: state.filter || undefined,
                  })}
                  mix={table.sortLink}
                >
                  {hint ? (
                    <abbr title={hint} mix={table.sortAbbr}>
                      {label}
                    </abbr>
                  ) : (
                    label
                  )}
                  <span mix={field === state.sortColumn ? table.sortArrowActive : table.sortArrow}>
                    {sortArrow(field, state.sortColumn, state.sortDirection)}
                  </span>
                </a>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colspan={6} mix={table.empty}>
                Keine Termine in diesem Zeitraum.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.user_id} mix={table.row}>
                <td mix={table.td} data-label="Name">
                  <a
                    href={buildUserAppointmentsUrl(row.user_email)}
                    mix={userLink}
                    title={`Termine von ${row.user_name} anzeigen`}
                  >
                    <span mix={table.cellStack}>
                      <span mix={table.cellTitle}>{row.user_name}</span>
                      <span mix={table.cellMeta}>{row.user_email}</span>
                    </span>
                  </a>
                </td>
                <td mix={table.td} data-label="Anzahl">
                  {row.appointment_count}
                </td>
                <td mix={table.td} data-label="Erster Termin">
                  {fmtDate(row.min_date)}
                </td>
                <td mix={table.td} data-label="Letzter Termin">
                  {fmtDate(row.max_date)}
                </td>
                <td mix={table.td} data-label="Std. gesamt">
                  {fmtHours(row.total_min)}
                </td>
                <td mix={table.td} data-label="Ø Std./Termin">
                  {fmtHours(row.avg_min)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function Report1Pagination(
  state: Report1ViewState,
  offset: number,
  prevOffset: number,
  nextOffset: number,
  hasMore: boolean,
  visibleRows: number,
): RemixNode {
  let pageSize = nextOffset - offset
  let page = pageSize > 0 ? Math.floor(offset / pageSize) + 1 : 1

  return (
    <div mix={table.pagination}>
      <span mix={table.paginationInfo}>
        Seite {page} · {visibleRows} Benutzer
      </span>
      <div mix={table.flexGapSm}>
        {offset > 0 ? (
          <a href={listUrl(state, String(prevOffset))} mix={table.pageLink}>
            Zurück
          </a>
        ) : (
          <span mix={table.pageLinkDisabled} aria-disabled="true">
            Zurück
          </span>
        )}
        {hasMore ? (
          <a href={listUrl(state, String(nextOffset))} mix={table.pageLink}>
            Vor
          </a>
        ) : (
          <span mix={table.pageLinkDisabled} aria-disabled="true">
            Vor
          </span>
        )}
      </div>
    </div>
  )
}

export function AdminReport1Page(handle: Handle<AdminReport1PageProps>) {
  return () => {
    let p = handle.props
    let state: Report1ViewState = {
      year: p.year,
      month: p.month,
      selectedUserId: p.selectedUserId,
      filter: p.filter ?? '',
      sortColumn: p.sortColumn,
      sortDirection: p.sortDirection,
    }

    return (
      <div mix={table.page}>
        <div mix={titleBar}>
          <h2 mix={table.title}>
            Monatsauswertung — {monthNameDE(state.month)} {state.year}
          </h2>
          {/* data-rmx-document: the PDF must download via a native document
              navigation or the frame runtime fetches it and swallows the file. */}
          <a href={pdfUrl(state)} data-rmx-document mix={[table.searchBtn, table.linkPlain]}>
            PDF exportieren
          </a>
        </div>

        {Report1FilterBar(state, p.users)}
        {Report1Table(state, p.rows)}
        {p.rows.length > 0
          ? Report1Pagination(state, p.offset, p.prevOffset, p.nextOffset, p.hasMore, p.rows.length)
          : null}
      </div>
    )
  }
}
