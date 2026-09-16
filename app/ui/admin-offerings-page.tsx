import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'
import { rotatedGlyphCss } from './mixins/icon.ts'
import { segmentedButton } from './mixins/segmented.ts'
import button, { buttonLink } from '../ui/theme/button.ts'
import { Glyph } from '../ui/theme/glyph/glyph.tsx'
import { getContext } from 'remix/middleware/async-context'
import { getCsrfToken } from 'remix/middleware/csrf'

import { routes } from '../routes.ts'
import { getSelfFrameTarget } from '../utils/frame-target.ts'
import { table } from './mixins/admin-table.ts'
import {
  sortArrow,
  buildSortUrl,
  buildPaginationUrl,
  buildCreateUrl,
  formatTimestamp,
} from './mixins/admin-urls.ts'
import { AdminOfferingsEditPage } from './admin-offerings-edit-page.tsx'
import { AdminOfferingsCreatePage } from './admin-offerings-create-page.tsx'
import { AdminOfferingsConfigPage } from './admin-offerings-config-page.tsx'
import { AdminOfferingsWeekPage } from './admin-offerings-week-page.tsx'
import type { OfferingConfig } from '../data/offering-configs.ts'
import { RestfulForm } from './restful-form.tsx'
import { getCspNonce } from '../middleware/security-headers.ts'
import { GridStateHiddenInputs } from './grid-state-hidden.tsx'
import { ConfirmDelete } from './confirm-delete.browser.tsx'
import { AdminOfferingsContextMenu } from '../actions/admin/public/admin-offerings-context-menu.tsx'
import { DeletePastButton } from '../actions/admin/public/admin-delete-past-button.tsx'
import type { OfferingRow, OfferingsResourceOption } from '../data/offerings-queries.ts'

interface AdminOfferingsPageProps {
  rows: OfferingRow[]
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
  period?: string | undefined
  status?: string | undefined
  editRow?: OfferingRow | null
  creating?: boolean
  resources: OfferingsResourceOption[]
  error?: string | undefined
  configResourceId?: number | undefined
  offeringConfig?: OfferingConfig | undefined
  addWeek?: boolean
  pastCount?: number
  formValues?: Record<string, string> | undefined
  fieldErrors?: Record<string, string> | undefined
  formError?: string | undefined
}

// ── Helpers ──

const ADMIN_BASE = routes.verwaltung.offerings.index.href()

// One-line affordance for the right-click shortcut (power users can still
// reach it without the visible action group). Hidden where there is no hover.
const contextHintStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
  whiteSpace: 'nowrap',
  '@media (hover: none)': { display: 'none' },
  '@media (max-width: 768px)': { display: 'none' },
})

// Page number pill in the pagination footer.
const pageBadgeStyle = css({
  padding: `${theme.space.xs} ${theme.space.sm}`,
  borderRadius: theme.radius.full,
  background: theme.surface.lvl2,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  whiteSpace: 'nowrap',
})

function buildEditUrl(
  rowId: number | string,
  offset: number,
  sort: string,
  order: string,
  filter?: string,
  period?: string,
  status?: string,
): string {
  let params = new URLSearchParams()
  params.set('editing', String(rowId))
  if (offset > 0) params.set('offset', String(offset))
  params.set('sort', sort)
  params.set('order', order)
  if (filter) params.set('filter', filter)
  if (period) params.set('period', period)
  if (status) params.set('status', status)
  return routes.verwaltung.offerings.index.href() + '?' + params.toString()
}

function buildAddWeekUrl(
  offset: number,
  sort: string,
  order: string,
  filter?: string,
  period?: string,
  status?: string,
): string {
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

function buildConfigUrl(
  resourceId: number | string,
  offset: number,
  sort: string,
  order: string,
  filter?: string,
  period?: string,
  status?: string,
): string {
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
  return routes.verwaltung.offerings.index.href() + '?' + params.toString()
}
const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Mo',
  2: 'Di',
  3: 'Mi',
  4: 'Do',
  5: 'Fr',
  6: 'Sa',
  7: 'So',
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

function formatDate(value: string): string {
  return new Date(Number(value)).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatTime(value: string): string {
  return new Date(Number(value)).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuring(during: string): string {
  let match = during.match(/^\[(\d+),(\d+)\)$/)
  if (!match) return during
  let startMin = parseInt(match[1]!, 10)
  let endMin = parseInt(match[2]!, 10)
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
      error,
      configResourceId,
      offeringConfig,
      addWeek = false,
      pastCount = 0,
      formValues,
      fieldErrors,
      formError,
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

    // Derive the page size from the server-computed next offset so the footer can
    // show "Seite N" without another prop.
    let pageSize = Math.max(1, nextOffset - offset)
    let currentPage = Math.floor(offset / pageSize) + 1

    // Name the active filters so the empty state explains why nothing matched.
    let emptyMessage: string
    if (filter) {
      emptyMessage = 'Keine Angebote für diese Suche gefunden.'
    } else if (status === 'expired') {
      emptyMessage = 'Keine abgelaufenen Angebote gefunden.'
    } else if (status === 'all') {
      emptyMessage = 'Keine Angebote gefunden.'
    } else if (period) {
      emptyMessage = 'Keine ausstehenden Angebote in diesem Zeitraum gefunden.'
    } else {
      emptyMessage = 'Keine ausstehenden Angebote vorhanden.'
    }

    let gridSection = (
      <div mix={table.minWidth0}>
        {!hasFormPanel && formError ? <div mix={table.errorBanner}>{formError}</div> : null}
        {!hasFormPanel && error ? <div mix={table.errorBanner}>{error}</div> : null}
        {/* Toolbar + Filter combined */}
        <form
          method="GET"
          action={routes.verwaltung.offerings.index.href()}
          data-rmx-target={getSelfFrameTarget()}
          mix={table.filterBar}
        >
          {/* Preserve the active sort, period and status when searching; the
              offset is intentionally absent so a new search starts on page 1. */}
          <input type="hidden" name="sort" value={sortColumn} />
          <input type="hidden" name="order" value={sortDirection} />
          {period && status !== 'expired' ? (
            <input type="hidden" name="period" value={period} />
          ) : null}
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <input
            type="text"
            name="filter"
            placeholder="Suche nach Ressource..."
            aria-label="Nach Ressource suchen"
            defaultValue={filter ?? ''}
            mix={table.filterInput}
          />
          <button type="submit" mix={table.searchBtn}>
            <Glyph name="search" width={14} height={14} /> Suchen
          </button>
          {filter && (
            <a href={routes.verwaltung.offerings.index.href()} mix={table.clearLink}>
              Zurücksetzen
            </a>
          )}
          <span mix={table.spacer} />
          <span mix={table.filterCluster}>
            <span mix={table.filterClusterLabel}>Zeitraum</span>
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
                  // Future periods are meaningless alongside the expired view;
                  // mirror /verwaltung/appointments and disable the switcher
                  // rather than linking to a guaranteed-empty grid.
                  return (
                    <span>
                      <button
                        type="button"
                        disabled
                        mix={[
                          button({ tone: active ? 'primary' : 'secondary' }),
                          segmentedButton({
                            isFirst,
                            isLast,
                            paddingX: theme.space.sm,
                            disabled: true,
                          }),
                        ]}
                      >
                        {label}
                      </button>
                    </span>
                  )
                }
                return (
                  <a
                    href={href}
                    data-rmx-target={getSelfFrameTarget()}
                    aria-current={active ? 'true' : undefined}
                    mix={[
                      buttonLink({ tone: active ? 'primary' : 'secondary' }),
                      segmentedButton({ isFirst, isLast, paddingX: theme.space.sm }),
                    ]}
                  >
                    {label}
                  </a>
                )
              },
            )}
          </span>
          <span mix={table.filterCluster}>
            <span mix={table.filterClusterLabel}>Status</span>
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
              // A future period cannot coexist with the expired view — drop it
              // instead of navigating to a guaranteed-empty grid.
              if (period && value !== 'expired') params.set('period', period)
              // Only omit `status` when this is the neutral default (pending) view;
              // re-clicking the active "Alle"/"Abgelaufen" tab must keep its own filter.
              if (!(value === 'pending' && (!status || status === 'pending'))) {
                params.set('status', value)
              }
              let href = routes.verwaltung.offerings.index.href() + '?' + params.toString()
              return (
                <a
                  href={href}
                  data-rmx-target={getSelfFrameTarget()}
                  aria-current={active ? 'true' : undefined}
                  mix={[
                    buttonLink({ tone: active ? 'primary' : 'secondary' }),
                    segmentedButton({ isFirst, isLast }),
                  ]}
                >
                  {label}
                </a>
              )
            })}
          </span>
        </form>

        <div mix={table.filterBar}>
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
            mix={buttonLink({ tone: 'primary' })}
          >
            <Glyph name="add" width={14} height={14} /> Neu anlegen
          </a>
          <a
            href={buildAddWeekUrl(offset, sortColumn, sortDirection, filter, period, status)}
            data-rmx-target={getSelfFrameTarget()}
            mix={buttonLink({ tone: 'secondary' })}
          >
            <Glyph name="add" width={14} height={14} /> Woche hinzufügen
          </a>
          <span mix={table.spacer} />
          <span mix={contextHintStyle}>
            <Glyph name="info" width={13} height={13} /> Rechtsklick: Aktionsmenü
          </span>
          <DeletePastButton
            csrfToken={csrfToken}
            offset={String(offset)}
            sort={sortColumn}
            order={sortDirection}
            filter={filter ?? ''}
            period={period ?? ''}
            status={status ?? ''}
            pastCount={pastCount}
            deletePastHref={routes.verwaltung.offerings.deletePast.href()}
          />
        </div>

        {/* Table */}
        <div mix={[table.wrap, table.mobileCards]} data-offerings-table="true">
          {rows.length === 0 ? (
            <div mix={table.empty}>
              {emptyMessage}
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
                    mix={buttonLink({ tone: 'primary' })}
                  >
                    <Glyph name="add" width={14} height={14} /> Neu anlegen
                  </a>
                </div>
              )}
            </div>
          ) : (
            <table mix={table.table}>
              <colgroup>
                <col mix={css({ width: '132px' })} />
                <col />
                <col mix={css({ width: '124px' })} />
                <col mix={css({ width: '112px' })} />
                <col mix={css({ width: '112px' })} />
              </colgroup>
              <thead>
                <tr>
                  <th mix={table.thSortable} title="Tag">
                    <a
                      href={buildSortUrl(
                        ADMIN_BASE,
                        'ao.day',
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
                      Tag
                      <span mix={'ao.day' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('ao.day', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.thSortable} title="Ressource">
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
                  <th mix={table.thSortable} title="Zeitraum">
                    <a
                      href={buildSortUrl(
                        ADMIN_BASE,
                        'ao.during',
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
                      Zeitraum
                      <span
                        mix={'ao.during' === sortColumn ? table.sortArrowActive : table.sortArrow}
                      >
                        {sortArrow('ao.during', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.thSortable} title="Aktualisiert">
                    <a
                      href={buildSortUrl(
                        ADMIN_BASE,
                        'ao.updated_at',
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
                          'ao.updated_at' === sortColumn ? table.sortArrowActive : table.sortArrow
                        }
                      >
                        {sortArrow('ao.updated_at', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th
                    mix={table.th}
                    aria-label="Aktionen"
                    title="Rechtsklick auf eine Zeile öffnet das Aktionsmenü"
                  ></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    mix={[table.row, editRow?.id === row.id ? table.editingRow : undefined]}
                    data-row-id={row.id}
                    data-resource-id={row.resource_id}
                  >
                    <td mix={table.td} title={formatDate(row.day)} data-label="Tag">
                      <div mix={table.cellStack}>
                        <span mix={table.cellTitle}>
                          {`KW ${formatWeekNumber(row.day)} · ${formatWeekday(row.day)}`}
                        </span>
                        <span mix={table.cellMeta}>{formatDate(row.day)}</span>
                      </div>
                    </td>
                    <td
                      mix={table.td}
                      title={row.resource_description ?? row.resource_name ?? ''}
                      data-label="Ressource"
                    >
                      <div mix={table.cellStack}>
                        <span mix={table.cellTitle}>{row.resource_name ?? '—'}</span>
                        {row.resource_description ? (
                          <span mix={table.cellMeta}>{row.resource_description}</span>
                        ) : null}
                      </div>
                    </td>
                    <td mix={table.td} title={row.during} data-label="Zeitraum">
                      {formatDuring(row.during)}
                    </td>
                    <td
                      mix={table.td}
                      title={formatTimestamp(row.updated_at)}
                      data-label="Aktualisiert"
                    >
                      <div mix={table.cellStack}>
                        <span mix={table.cellTitle}>{formatDate(row.updated_at)}</span>
                        <span mix={table.cellMeta}>{formatTime(row.updated_at)}</span>
                      </div>
                    </td>
                    <td mix={table.actionCell} data-label="Aktionen">
                      <div mix={table.actionGroup}>
                        <a
                          href={buildConfigUrl(
                            row.resource_id,
                            offset,
                            sortColumn,
                            sortDirection,
                            filter,
                            period,
                            status,
                          )}
                          data-rmx-target={getSelfFrameTarget()}
                          mix={table.actionSeg}
                          aria-label="Konfiguration"
                          title="Konfiguration"
                        >
                          <Glyph name="cog" width={14} height={14} />
                        </a>
                        <a
                          href={buildEditUrl(
                            row.id,
                            offset,
                            sortColumn,
                            sortDirection,
                            filter,
                            period,
                            status,
                          )}
                          data-rmx-target={getSelfFrameTarget()}
                          mix={table.actionSeg}
                          aria-label="Bearbeiten"
                          title="Bearbeiten"
                        >
                          <Glyph name="edit" width={14} height={14} />
                        </a>
                        <RestfulForm
                          method="DELETE"
                          action={routes.verwaltung.offerings.destroy.href({ id: row.id })}
                          data-delete-form={row.id}
                          data-confirm="Wirklich löschen?"
                          data-rmx-target={getSelfFrameTarget()}
                          mix={css({ margin: 0, padding: 0, display: 'inline-flex' })}
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
                            mix={[table.actionSeg, table.actionSegDanger]}
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
            <span mix={css({ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' })}>
              {rows.length > 0 && (
                <span mix={table.paginationInfo}>
                  Zeige {pageStart}–{pageEnd}
                </span>
              )}
              <span mix={pageBadgeStyle} aria-label={`Seite ${currentPage}`}>
                Seite {currentPage}
              </span>
            </span>
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
        <ConfirmDelete />
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
                  offset={String(offset)}
                  sort={sortColumn}
                  order={sortDirection}
                  filter={filter ?? ''}
                  period={period ?? ''}
                  status={status ?? ''}
                />
              ) : addWeek ? (
                <AdminOfferingsWeekPage
                  resources={resources}
                  offset={String(offset)}
                  sort={sortColumn}
                  order={sortDirection}
                  filter={filter ?? ''}
                  period={period ?? ''}
                  status={status ?? ''}
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
