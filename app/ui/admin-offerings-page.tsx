import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../lib/theme.ts'
import button from '../lib/button.ts'
import { Glyph } from '../lib/glyph.ts'
import { getContext } from 'remix/middleware/async-context'
import { getCsrfToken } from 'remix/middleware/csrf'

import { frames, routes } from '../routes.ts'
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
import { DeletePastButton } from '../assets/admin-delete-past-button.tsx'
import type { OfferingRow, OfferingsResourceOption } from '../actions/verwaltung/offerings/controller.tsx'

interface AdminOfferingsPageProps {
  rows: OfferingRow[]
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
  period?: string
  status?: string
  editRow?: OfferingRow | null
  creating?: boolean
  resources: OfferingsResourceOption[]
  error?: string
  configResourceId?: number
  offeringConfig?: OfferingConfig
  addWeek?: boolean
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
  formError?: string
}

// ── Helpers ──

const ADMIN_BASE = routes.verwaltung.offerings.index.href()

function buildAddWeekUrl(offset: number, sort: string, order: string, filter?: string, period?: string, status?: string): string {
  let params = new URLSearchParams()
  params.set('addweek', 'true')
  if (offset > 0) params.set('offset', String(offset))
  params.set('sort', sort)
  params.set('order', order)
  if (filter) params.set('filter', filter)
  if (period) params.set('period', period)
  if (status) params.set('status', status)
  return routes.verwaltung.offerings.index.href() + '?' + params.toString()
}

function buildConfigUrl(resourceId: number, offset: number, sort: string, order: string, filter?: string, period?: string, status?: string): string {
  let params = new URLSearchParams()
  params.set('config', String(resourceId))
  if (offset > 0) params.set('offset', String(offset))
  params.set('sort', sort)
  params.set('order', order)
  if (filter) params.set('filter', filter)
  if (period) params.set('period', period)
  if (status) params.set('status', status)
  return routes.verwaltung.offerings.index.href() + '?' + params.toString()
}

function buildPeriodUrl(newPeriod: string | null, offset: number, sort: string, order: string, filter?: string, status?: string): string {
  let params = new URLSearchParams()
  if (offset > 0) params.set('offset', String(offset))
  params.set('sort', sort)
  params.set('order', order)
  if (filter) params.set('filter', filter)
  if (newPeriod) params.set('period', newPeriod)
  if (status) params.set('status', status)
  return routes.verwaltung.offerings.index.href() + '?' + params.toString()
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

// errorBannerStyle and editingRowStyle moved to mixin (table.errorBanner, table.editingRow)

// ── Component ──

export function AdminOfferingsPage(handle: Handle<AdminOfferingsPageProps>) {
  return () => {
    let {
      rows, offset, hasMore, prevOffset, nextOffset,
      sortColumn, sortDirection, filter, period, status,
      editRow = null, creating = false, resources, error,
      configResourceId, offeringConfig, addWeek = false,
      formValues, fieldErrors, formError,
    } = handle.props
    let pageStart = rows.length > 0 ? offset + 1 : 0
    let pageEnd = offset + rows.length

    let csrfToken = ''
    try {
      csrfToken = getCsrfToken(getContext())
    } catch (e) {
      console.error('Failed to get CSRF token:', e)
    }

    let hasFormPanel = !!(editRow || creating)
    let gridSection = (
      <div mix={table.minWidth0}>
        {!hasFormPanel && formError ? <div mix={table.errorBanner}>{formError}</div> : null}
        {!hasFormPanel && error ? <div mix={table.errorBanner}>{error}</div> : null}
        {/* Toolbar + Filter combined */}
        <form
          method="GET"
          action={routes.verwaltung.offerings.index.href()}
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
          <button type="submit" mix={table.searchBtn}><Glyph name="search" width={14} height={14} /> Suchen</button>
          {filter && (
            <a
              href={routes.verwaltung.offerings.index.href()}
              rmx-target={frames.adminContent}
              mix={table.clearLink}
            >
              Zurücksetzen
            </a>
          )}
          <span mix={table.spacer} />
          <span mix={css({
            display: 'inline-flex',
            alignItems: 'center',
          })}>
            {(['', 'this-week', 'next-week', 'this-month', 'next-month'] as const).map((value, i, arr) => {
              let isFirst = i === 0
              let isLast = i === arr.length - 1
              let label = value === '' ? 'Alle' : { 'this-week': 'Diese Woche', 'next-week': 'Nächste Woche', 'this-month': 'Diesen Monat', 'next-month': 'Nächsten Monat' }[value]
              let active = value === '' ? !period : period === value
              let href = active
                ? buildPeriodUrl(null, offset, sortColumn, sortDirection, filter, status)
                : buildPeriodUrl(value, offset, sortColumn, sortDirection, filter, status)
              return (
                <a
                  href={href}
                  rmx-target={frames.adminContent}
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
                  <button mix={[button({ tone: active ? 'primary' : 'secondary' })]}>{label}</button>
                </a>
              )
            })}
          </span>
          <span mix={css({
            display: 'inline-flex',
            alignItems: 'center',
          })}>
            {(['pending', 'expired'] as const).map((value, i, arr) => {
              let isFirst = i === 0
              let isLast = i === arr.length - 1
              let label = value === 'pending' ? 'Ausstehend' : 'Abgelaufen'
              let active = value === 'pending' ? (!status || status === 'pending') : status === 'expired'
              let params = new URLSearchParams()
              if (offset > 0) params.set('offset', String(offset))
              params.set('sort', sortColumn)
              params.set('order', sortDirection)
              if (filter) params.set('filter', filter)
              if (period) params.set('period', period)
              if (!active) params.set('status', value)
              let href = routes.verwaltung.offerings.index.href() + '?' + params.toString()
              return (
                <a
                  href={href}
                  rmx-target={frames.adminContent}
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
        </form>

        <div mix={table.filterBar}>
          <a
            href={buildCreateUrl(ADMIN_BASE, offset, sortColumn, sortDirection, filter, period, status)}
            rmx-target={frames.adminContent}
            mix={table.linkPlain}
          >
            <button mix={[button({ tone: 'primary' })]}><Glyph name="add" width={14} height={14} /> Neu anlegen</button>
          </a>
          <a
            href={buildAddWeekUrl(offset, sortColumn, sortDirection, filter, period, status)}
            rmx-target={frames.adminContent}
            mix={table.linkPlain}
          >
            <button mix={[button({ tone: 'primary' })]}><Glyph name="add" width={14} height={14} /> Woche hinzufügen</button>
          </a>
          <span mix={table.spacer} />
          <DeletePastButton
            csrfToken={csrfToken}
            offset={String(offset)}
            sort={sortColumn}
            order={sortDirection}
            filter={filter ?? ''}
            period={period ?? ''}
            status={status ?? ''}
            deletePastHref={routes.verwaltung.offerings.deletePast.href()}
          />
        </div>

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
                  <th mix={table.th}>KW</th>
                  <th mix={table.th}>WD</th>
                  <th mix={table.thSortable} title="Tag">
                    <a href={buildSortUrl(ADMIN_BASE, 'ao.day', sortColumn, sortDirection, offset, filter, period, status)}
                       rmx-target={frames.adminContent} mix={table.sortLink}>
                      Tag
                      <span mix={'ao.day' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('ao.day', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.thSortable} title="Ressource">
                    <a href={buildSortUrl(ADMIN_BASE, 'r.description', sortColumn, sortDirection, offset, filter, period, status)}
                       rmx-target={frames.adminContent} mix={table.sortLink}>
                      Ressource
                      <span mix={'r.description' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('r.description', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.th}>Beschreibung</th>
                  <th mix={table.thSortable} title="Zeitraum">
                    <a href={buildSortUrl(ADMIN_BASE, 'ao.during', sortColumn, sortDirection, offset, filter, period, status)}
                       rmx-target={frames.adminContent} mix={table.sortLink}>
                      Zeitraum
                      <span mix={'ao.during' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('ao.during', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.thSortable} title="Aktualisiert">
                    <a href={buildSortUrl(ADMIN_BASE, 'ao.updated_at', sortColumn, sortDirection, offset, filter, period, status)}
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
                    <tr key={row.id} mix={[table.row, editRow?.id === row.id ? table.editingRow : undefined]} data-row-id={row.id}>
                      <td mix={table.td}>{formatWeekNumber(row.day)}</td>
                    <td mix={table.td}>{formatWeekday(row.day)}</td>
                    <td mix={table.td} title={formatDate(row.day)}>{formatDate(row.day)}</td>
                    <td mix={table.td} title={row.resource_name ?? ''}>
                      {row.resource_name ?? '\u2014'}
                    </td>
                    <td mix={table.td} title={row.resource_description ?? ''}>
                      {row.resource_description ?? '\u2014'}
                    </td>
                    <td mix={table.td} title={row.during}>{formatDuring(row.during)}</td>
                    <td mix={table.td} title={formatTimestamp(row.updated_at)}>{formatTimestamp(row.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {/* Hidden DELETE forms for context menu — kept in DOM for .requestSubmit() */}
          {rows.length > 0 ? (
            <div mix={table.displayNone} aria-hidden="true">
              {rows.map((row) => (
                <RestfulForm
                  key={row.id}
                  method="DELETE"
                  action={routes.verwaltung.offerings.destroy.href({ id: row.id })}
                  data-delete-form={row.id}
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
            <div mix={table.flexGapSm}>
              {offset > 0 ? (
                <a
                  href={buildPaginationUrl(ADMIN_BASE, prevOffset, sortColumn, sortDirection, filter, period, status)}
                  rmx-target={frames.adminContent}
                  mix={table.pageLink}
                ><Glyph name="chevronRight" width={14} height={14} style={{ transform: 'rotate(180deg)' }} /> Zurück</a>
              ) : (
                <span mix={table.pageLinkDisabled}><Glyph name="chevronRight" width={14} height={14} style={{ transform: 'rotate(180deg)' }} /> Zurück</span>
              )}
              {hasMore ? (
                <a
                  href={buildPaginationUrl(ADMIN_BASE, nextOffset, sortColumn, sortDirection, filter, period, status)}
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
            period: period ?? '',
            status: status ?? '',
            baseHref: routes.verwaltung.offerings.index.href(),
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
            <div mix={table.stickyPanel}>
              {editRow ? (
                <AdminOfferingsEditPage
                  row={editRow}
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
                />
              ) : creating ? (
                <AdminOfferingsCreatePage
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
