import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'
import { routes } from '../routes.ts'
import { Glyph } from '../ui/theme/glyph.ts'
import { table } from './mixins/admin-table.ts'
import { sortArrow } from './mixins/admin-urls.ts'
import type { Report1Row } from '../data/report1.ts'

export interface Report1UserOption {
  id: string
  name: string
}

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

const BASE = routes.verwaltung.report1.index.href()

function buildUrl(overrides: Record<string, string | undefined>): string {
  let params = new URLSearchParams()
  let p = { year: String(overrides.year ?? ''), month: String(overrides.month ?? ''), user_id: overrides.selectedUserId ?? '', offset: overrides.offset ?? '0', sort: overrides.sort ?? 'name', order: overrides.order ?? 'asc', filter: overrides.filter ?? '' }
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

function fmtDate(ts: string | null): string {
  if (!ts) return '\u2014'
  return new Date(Number(ts)).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtHours(min: string | null): string {
  if (!min) return '\u2014'
  return (Number(min) / 60).toFixed(1)
}

export function AdminReport1Page(handle: Handle<AdminReport1PageProps>) {
  return () => {
    let p = handle.props
    let curSort = p.sortColumn
    let curOrder = p.sortDirection
    let curOffset = p.offset
    let curFilter = p.filter ?? ''
    let curYear = p.year
    let curMonth = p.month
    let curUserId = p.selectedUserId

    return (
      <div mix={table.page}>
        <h1 mix={table.title}>Monatsauswertung</h1>

        <form method="GET" action={BASE} mix={table.filterBar}>
          <select name="year" mix={table.select}>
            {Array.from({ length: 5 }, (_, i) => {
              let y = curYear - 2 + i
              return <option key={y} value={y} selected={y === curYear}>{y}</option>
            })}
          </select>

          <select name="month" mix={table.select}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i + 1} selected={i + 1 === curMonth}>{String(i + 1).padStart(2, '0')}</option>
            ))}
          </select>

          <select name="user_id" mix={table.select}>
            <option value="" selected={curUserId === undefined}>Alle Benutzer</option>
            {p.users.map((u) => (
              <option key={u.id} value={u.id} selected={curUserId === Number(u.id)}>{u.name}</option>
            ))}
          </select>

          <input type="text" name="filter" placeholder="Filter (Name)" value={curFilter} mix={table.filterInput} />
          <input type="hidden" name="sort" value={curSort} />
          <input type="hidden" name="order" value={curOrder} />
          <input type="hidden" name="offset" value="0" />

          <button type="submit" mix={table.searchBtn}>
            <Glyph name="search" width={14} height={14} /> Auswertung erstellen
          </button>

          {(curFilter || curYear !== new Date().getUTCFullYear() || curMonth !== new Date().getUTCMonth() + 1 || curUserId !== undefined) && (
            <a href={BASE} mix={table.clearLink}>Zurücksetzen</a>
          )}
        </form>

        <div mix={table.wrap}>
          <table mix={table.table}>
            <thead>
              <tr>
                {[
                  ['name', 'Name'],
                  ['count', 'Anzahl'],
                  ['min_date', 'Erster'],
                  ['max_date', 'Letzter'],
                  ['total_hours', 'Std. ges.'],
                  ['avg_hours', 'Std. \u00f8'],
                ].map(([field, label]) => (
                  <th key={field} mix={table.thSortable}>
                    <a
                      href={buildUrl({ sort: field, order: field === curSort ? (curOrder === 'asc' ? 'desc' : 'asc') : 'asc', offset: '0', year: String(curYear), month: String(curMonth), selectedUserId: curUserId !== undefined ? String(curUserId) : undefined, filter: curFilter || undefined })}
                      mix={table.sortLink}
                    >
                      {label}
                      <span mix={field === curSort ? table.sortArrowActive : table.sortArrow}>{sortArrow(field, curSort, curOrder)}</span>
                    </a>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {p.rows.length === 0 ? (
                <tr>
                  <td colspan={6} mix={table.empty}>Keine Termine in diesem Zeitraum.</td>
                </tr>
              ) : (
                p.rows.map((row) => (
                  <tr key={row.user_id} mix={table.row}>
                    <td mix={table.td}>{row.user_name}</td>
                    <td mix={table.td}>{row.appointment_count}</td>
                    <td mix={table.td}>{fmtDate(row.min_date)}</td>
                    <td mix={table.td}>{fmtDate(row.max_date)}</td>
                    <td mix={table.td}>{fmtHours(row.total_min)}</td>
                    <td mix={table.td}>{fmtHours(row.avg_min)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {p.rows.length > 0 && (
          <div mix={table.pagination}>
            <span mix={table.paginationInfo}>
              ab Zeile {curOffset + 1}
            </span>
            <div mix={table.flexGapSm}>
              {curOffset > 0 ? (
                <a
                  href={buildUrl({ offset: String(p.prevOffset), sort: curSort, order: curOrder, year: String(curYear), month: String(curMonth), selectedUserId: curUserId !== undefined ? String(curUserId) : undefined, filter: curFilter || undefined })}
                  mix={table.pageLink}
                >
                  Zurück
                </a>
              ) : (
                <span mix={table.pageLinkDisabled}>Zurück</span>
              )}
              {p.hasMore ? (
                <a
                  href={buildUrl({ offset: String(p.nextOffset), sort: curSort, order: curOrder, year: String(curYear), month: String(curMonth), selectedUserId: curUserId !== undefined ? String(curUserId) : undefined, filter: curFilter || undefined })}
                  mix={table.pageLink}
                >
                  Vor
                </a>
              ) : (
                <span mix={table.pageLinkDisabled}>Vor</span>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }
}
