import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { panelEntrance } from './mixins/panel-entrance.ts'
import { theme } from '../ui/theme/theme.ts'
import { rotatedGlyphCss } from './mixins/icon.ts'
import { buttonLink } from '../ui/theme/button.ts'
import { Glyph } from '../ui/theme/glyph/glyph.tsx'
import { PageSection } from './page-primitives.tsx'
import { input } from './mixins/input.ts'
import { table } from './mixins/admin-table.ts'
import {
  verwaltungGridDensity,
  verwaltungGridFill,
  verwaltungGridWrap,
} from './mixins/verwaltung-grid.ts'
import {
  sortArrow,
  sortRule,
  buildSortUrl,
  buildPaginationUrl,
  buildCreateUrl,
  buildEditUrl,
  buildCancelUrl,
  formatTimestamp,
} from './mixins/admin-urls.ts'

import { routes } from '../routes.ts'
import { getSelfFrameTarget } from '../utils/frame-target.ts'
import { RestfulForm } from './restful-form.tsx'
import { GridStateHiddenInputs } from './grid-state-hidden.tsx'
import type {
  OfferingConfigRow,
  OfferingConfigResourceOption,
} from '../data/offering-configs-queries.ts'
import { PendingSubmitButton } from './pending-submit.browser.tsx'
import { FormErrorFocus } from './form-error-focus.browser.tsx'
import { GridStateScript } from './grid-state-script.tsx'
import { FilterAutoSubmit } from './filter-autosubmit.browser.tsx'
import { EditorAutofocus } from './editor-autofocus.browser.tsx'
import { DirtyFormGuard } from './dirty-form-guard.browser.tsx'
import { WeekRulePresets } from './week-rule-presets.browser.tsx'
import { AdminOfferingConfigsContextMenu } from '../actions/admin/public/admin-offering-configs-context-menu.tsx'
import { AdminRowActionsOverlay } from './admin-row-actions-overlay.browser.tsx'
import { PageSizeControl } from './page-size-control.tsx'
import type { PageSizeKey } from '../utils/get-page-size.ts'

interface AdminOfferingConfigsPageProps {
  rows: OfferingConfigRow[]
  total: number
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  pageKey: PageSizeKey
  pageSizeOverride: number | null
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
  editRow?: OfferingConfigRow | null | undefined
  creating?: boolean | undefined
  resources: OfferingConfigResourceOption[]
  formValues?: Record<string, string> | undefined
  fieldErrors?: Record<string, string> | undefined
  formError?: string | undefined
}

/**
 * Weekday order is fixed: Monday first. The stored `rules` object comes back
 * from JSONB, which orders keys by length then bytes (fr, mo, su, tu, …), so
 * anything that iterates `Object.entries(rules)` renders the week shuffled.
 * Every display path goes through this list instead.
 */
const DAYS = [
  { key: 'monday', label: 'Montag', short: 'Mo' },
  { key: 'tuesday', label: 'Dienstag', short: 'Di' },
  { key: 'wednesday', label: 'Mittwoch', short: 'Mi' },
  { key: 'thursday', label: 'Donnerstag', short: 'Do' },
  { key: 'friday', label: 'Freitag', short: 'Fr' },
  { key: 'saturday', label: 'Samstag', short: 'Sa' },
  { key: 'sunday', label: 'Sonntag', short: 'So' },
] as const

const DAY_INDEX = new Map<string, number>(DAYS.map((day, index) => [day.key, index]))

const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => i * 60)
const TIME_END_OPTIONS = Array.from({ length: 24 }, (_, i) => (i + 1) * 60)

function fmt(minutes: number): string {
  let h = String(Math.floor(minutes / 60)).padStart(2, '0')
  let m = String(minutes % 60).padStart(2, '0')
  return `${h}:${m}`
}

function formatInterval([start, end]: [number, number]): string {
  return `${fmt(start)}–${fmt(end)}`
}

/** Rounds the weekly sum to one decimal; `45` stays `45`, `7.5` becomes `7,5`. */
const HOURS_FORMAT = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 })

interface WeekSummary {
  /** Weekdays grouped by identical hours, e.g. "Mo–Fr 08:00–17:00 · Sa 09:00–13:00". */
  text: string
  /** The same groups, rendered so a line break can only happen between them. */
  groups: string[]
  /** Full per-day list, used for the cell tooltip and screen readers. */
  detail: string
  dayCount: number
  /** Bookable hours per week. */
  hours: number
}

/**
 * Compresses the stored rules into one scannable line.
 *
 * The grid used to join every day in JSONB order at 11px, so a normal
 * Monday–Friday configuration read "Fr 08:00-17:00, Mo 09:00-17:00, Di …" and
 * was cut off after two days. Grouping consecutive days that share hours keeps
 * the whole week visible in the column ("Mo–Fr 08:00–17:00") and keeps the
 * weekday order stable.
 */
function summarizeWeek(rules: Record<string, [number, number]> | null | undefined): WeekSummary {
  let entries = DAYS.flatMap((day) => {
    let interval = rules?.[day.key]
    return interval ? [{ key: day.key, short: day.short, interval }] : []
  })
  if (entries.length === 0) {
    return { text: '—', groups: [], detail: 'Keine Zeitfenster', dayCount: 0, hours: 0 }
  }

  let groups: { firstKey: string; lastKey: string; interval: [number, number] }[] = []
  for (let entry of entries) {
    let current = groups[groups.length - 1]
    let contiguous =
      current !== undefined &&
      DAY_INDEX.get(entry.key) === (DAY_INDEX.get(current.lastKey) ?? -2) + 1
    if (
      current &&
      contiguous &&
      current.interval[0] === entry.interval[0] &&
      current.interval[1] === entry.interval[1]
    ) {
      current.lastKey = entry.key
      continue
    }
    groups.push({ firstKey: entry.key, lastKey: entry.key, interval: entry.interval })
  }

  let shortOf = (key: string) => DAYS.find((day) => day.key === key)?.short ?? key
  let groupTexts = groups.map((group) => {
    let hours = formatInterval(group.interval)
    if (group.firstKey === group.lastKey) return `${shortOf(group.firstKey)} ${hours}`
    if (group.firstKey === 'monday' && group.lastKey === 'sunday') return `Täglich ${hours}`
    return `${shortOf(group.firstKey)}–${shortOf(group.lastKey)} ${hours}`
  })

  let minutes = entries.reduce((sum, entry) => sum + (entry.interval[1] - entry.interval[0]), 0)

  return {
    text: groupTexts.join(' · '),
    groups: groupTexts,
    detail: entries.map((entry) => `${entry.short} ${formatInterval(entry.interval)}`).join(', '),
    dayCount: entries.length,
    hours: minutes / 60,
  }
}

function weekMeta(summary: WeekSummary): string {
  if (summary.dayCount === 0) return 'Nicht buchbar'
  let days = summary.dayCount === 1 ? '1 Tag' : `${summary.dayCount} Tage`
  return `${days} · ${HOURS_FORMAT.format(summary.hours)} Std./Woche`
}

/**
 * Label for a resource option. The column is NOT NULL but legacy rows can hold
 * an empty name, which rendered as a blank option in the select; fall back to
 * the description (clamped, so one verbose room cannot blow up the control).
 */
function resourceOptionLabel(resource: OfferingConfigResourceOption): string {
  let name = resource.name?.trim()
  if (name) return name
  let description = resource.description?.replace(/\s+/g, ' ').trim()
  if (!description) return `Ressource #${resource.id}`
  return description.length > 48 ? `${description.slice(0, 47).trimEnd()}…` : description
}

function rowResourceName(row: OfferingConfigRow): string {
  let name = row.resource_name?.trim()
  if (name) return name
  let description = row.resource_description?.trim()
  return description ? description : `Ressource #${row.resource_id}`
}

const ADMIN_BASE = routes.verwaltung.offeringConfigs.index.href()

// ── Styles ──

const colActionsWidth = css({ width: '96px' })

/** Resource name is the row's primary target: it opens the edit panel. */
const nameLinkStyle = css({
  display: 'block',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: theme.colors.text.primary,
  fontWeight: theme.fontWeight.medium,
  textDecoration: 'none',
  '&:hover': { color: theme.colors.action.primary.background, textDecoration: 'underline' },
})

/**
 * Plain cell value. On phones the parent `td` becomes a `justify-content:
 * space-between` row; without a shrinkable, max-width-capped child the
 * nowrap text overflows the card and is clipped at its right edge.
 */
const cellValueStyle = css({
  minWidth: 0,
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  '@media (max-width: 768px)': { textAlign: 'right' },
})

/** Two-line week cell: the stack shrinks and right-aligns inside a phone card. */
const weekCellStackStyle = css({
  minWidth: 0,
  '@media (max-width: 768px)': {
    flex: '1 1 auto',
    alignItems: 'flex-end',
    textAlign: 'right',
  },
})

/**
 * The grouped week, wrapped over at most two lines. A configuration whose days
 * differ ("Mo 09–17 · Di 08–17 · Mi 09–20 …") cannot fit a 210px column on one
 * line, and an ellipsis after two groups hides the rest of the week; two
 * wrapped lines show most of it while keeping every grid row the same height.
 */
const weekSummaryStyle = css({
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
  overflow: 'hidden',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  fontSize: theme.fontSize.xs,
  lineHeight: theme.lineHeight.tight,
  color: theme.colors.text.primary,
})

const weekGroupStyle = css({ whiteSpace: 'nowrap' })

const weekMetaStyle = css({
  marginTop: '2px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
})

const emptyStateStyle = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.space.md,
  minHeight: '220px',
  padding: theme.space.xxl,
  textAlign: 'center',
  color: theme.colors.text.muted,
})

const emptyActionsStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: theme.space.sm,
})

const pageBadgeStyle = css({
  padding: `${theme.space.xs} ${theme.space.sm}`,
  borderRadius: theme.radius.full,
  background: theme.surface.lvl2,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  whiteSpace: 'nowrap',
})

const paginationInfoGroupStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.space.sm,
})

const srOnlyStyle = css({
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: 0,
})

const fieldHintStyle = css({
  marginTop: theme.space.xs,
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
})

const fieldErrorStyle = css({
  color: theme.colors.action.danger.background,
  fontSize: theme.fontSize.xs,
  marginTop: theme.space.xs,
})

const panelIdStyle = css({
  fontFamily: theme.fontFamily.mono,
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
})

/** Truncates the edited resource in the panel header instead of widening it. */
const panelResourceStyle = css({
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
})

/**
 * Below 1100px the panel stacks under the grid. PageScrollReset returns the page
 * scroller to the top after the frame navigation that opened it, so without this
 * the editor the user just tapped sits below the whole grid and page footer.
 * Trades strict visual/DOM order on phones for a visible editor (same trade-off
 * as /admin/users and /admin/lists).
 */
const panelFirstOnMobileStyle = css({
  '@media (max-width: 1100px)': { order: -1 },
})

const panelBannerStyle = css({
  // Focusable programmatically: a form-level error has no field to focus, so
  // FormErrorFocus lands here instead (see form-error-focus.browser.tsx).
  outline: 'none',
})

const weekSectionTitleStyle = css({
  display: 'block',
  marginBottom: '2px',
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.secondary,
})

/**
 * Quick-pick row for the week. Hidden until the client entry marks it ready, so
 * a no-JS visitor never gets buttons that do nothing.
 */
const presetsBarStyle = css({
  display: 'none',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: theme.space.xs,
  marginBottom: theme.space.sm,
  '&[data-week-presets-ready="true"]': { display: 'flex' },
})

const presetButtonStyle = css({
  minHeight: '26px',
  padding: `${theme.space.xs} ${theme.space.sm}`,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  background: theme.surface.lvl1,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.xs,
  cursor: 'pointer',
  '&:hover': { background: theme.surface.lvl2, color: theme.colors.text.primary },
  '&:focus-visible': {
    outline: `2px solid ${theme.colors.focus.ring}`,
    outlineOffset: '2px',
  },
  '&[disabled]': { opacity: 0.45, cursor: 'not-allowed' },
})

const dayRowWrapStyle = css({
  padding: `${theme.space.xs} 0`,
  // An unchecked day keeps its times visible (they are the values that get
  // submitted), but de-emphasised: the row reads as inactive at a glance
  // instead of looking identical to an active one.
  '&:not(:has(input[type="checkbox"]:checked)) select': { opacity: 0.55 },
  '&:not(:has(input[type="checkbox"]:checked)) label': { color: theme.colors.text.muted },
  '&:not(:has(input[type="checkbox"]:checked)) select:hover': { opacity: 1 },
  '&:not(:has(input[type="checkbox"]:checked)) select:focus': { opacity: 1 },
})

const dayRowStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
})

const dayLabelStyle = css({
  width: '100px',
  fontSize: theme.fontSize.sm,
  cursor: 'pointer',
})

const daySeparatorStyle = css({
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.muted,
})

const dayErrorStyle = css({
  marginTop: '2px',
  marginLeft: '26px',
  color: theme.colors.action.danger.background,
  fontSize: theme.fontSize.xs,
})

const selectStyle = css({
  padding: `${theme.space.xs} ${theme.space.sm}`,
  fontSize: theme.fontSize.sm,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  background: theme.surface.lvl0,
  color: theme.colors.text.primary,
  outline: 'none',
  '&:focus': {
    borderColor: theme.colors.action.primary.background,
    boxShadow: `0 0 0 2px ${theme.colors.focus.ring}`,
  },
})

const timeSelectStyle = css({
  width: '90px',
  padding: `${theme.space.xs} ${theme.space.sm}`,
  fontSize: theme.fontSize.sm,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  background: theme.surface.lvl0,
  color: theme.colors.text.primary,
  outline: 'none',
  '&:focus': {
    borderColor: theme.colors.action.primary.background,
    boxShadow: `0 0 0 2px ${theme.colors.focus.ring}`,
  },
})

const dayCheckboxStyle = css({
  width: '18px',
  height: '18px',
  cursor: 'pointer',
})

// ── Page ──

export function AdminOfferingConfigsPage(handle: Handle<AdminOfferingConfigsPageProps>) {
  return () => {
    let {
      rows,
      total,
      offset,
      hasMore,
      prevOffset,
      nextOffset,
      pageKey,
      pageSizeOverride,
      sortColumn,
      sortDirection,
      filter,
      editRow = null,
      creating = false,
      resources,
      formValues,
      fieldErrors,
      formError,
    } = handle.props
    let pageSize = Math.max(1, nextOffset - offset)
    let pageStart = rows.length > 0 ? offset + 1 : 0
    let pageEnd = offset + rows.length
    let currentPage = Math.floor(offset / pageSize) + 1
    let hasFormPanel = !!(editRow || creating)
    // A delete or a filter change can leave the URL on a page that no longer
    // exists; that is not the same as "no configurations exist".
    let stalePage = rows.length === 0 && offset > 0
    let emptyMessage = stalePage
      ? 'Keine Konfigurationen auf dieser Seite.'
      : filter
        ? `Keine Konfigurationen gefunden für „${filter}“.`
        : 'Noch keine Konfigurationen vorhanden. Legen Sie die erste an.'

    let gridSection = (
      <div mix={[table.minWidth0, hasFormPanel ? table.twoColumnGrid : verwaltungGridFill]}>
        {!hasFormPanel && formError ? (
          <div mix={table.errorBanner} role="alert">
            {formError}
          </div>
        ) : null}
        <form
          method="GET"
          action={routes.verwaltung.offeringConfigs.index.href()}
          role="search"
          aria-label="Angebotskonfigurationen durchsuchen"
          data-rmx-target={getSelfFrameTarget()}
          data-rmx-history="replace"
          data-rmx-reset-focus="manual"
          data-offering-configs-filter
          mix={table.filterBar}
        >
          {/* Keep the active sort while searching; a new search starts on page 1
              (no offset field), so it can never land on an empty page. */}
          <input type="hidden" name="sort" value={sortColumn} />
          <input type="hidden" name="order" value={sortDirection} />
          <input
            type="text"
            name="filter"
            placeholder="Ressource oder Beschreibung…"
            defaultValue={filter ?? ''}
            aria-label="Nach Ressource oder Beschreibung suchen"
            mix={table.filterInput}
          />
          <button type="submit" mix={table.searchBtn}>
            <Glyph name="search" width={14} height={14} /> Suchen
          </button>
          {filter && (
            <a
              href={routes.verwaltung.offeringConfigs.index.href()}
              data-rmx-target={getSelfFrameTarget()}
              mix={table.clearLink}
            >
              Zurücksetzen
            </a>
          )}
          <span mix={table.spacer} />
          <a
            href={buildCreateUrl(ADMIN_BASE, offset, sortColumn, sortDirection, filter)}
            data-rmx-target={getSelfFrameTarget()}
            mix={[table.linkPlain, buttonLink({ tone: 'primary' })]}
          >
            <Glyph name="add" width={14} height={14} /> Neu anlegen
          </a>
        </form>
        {/* Debounced live search: typing re-runs the GET form instead of waiting
            for Suchen (which stays the no-JS path). Off while a panel is open,
            because every reload replaces the panel and would discard unsaved
            edits behind the dirty-form prompt. */}
        {!hasFormPanel ? (
          <FilterAutoSubmit formSelector="form[data-offering-configs-filter]" />
        ) : null}

        <div
          mix={[table.wrap, table.mobileCards, verwaltungGridWrap, verwaltungGridDensity]}
          data-grid-scroll="true"
          data-offering-configs-table="true"
        >
          {rows.length === 0 ? (
            <div mix={emptyStateStyle}>
              <span>{emptyMessage}</span>
              <div mix={emptyActionsStyle}>
                {stalePage ? (
                  <a
                    href={buildPaginationUrl(ADMIN_BASE, 0, sortColumn, sortDirection, filter)}
                    data-rmx-target={getSelfFrameTarget()}
                    mix={[table.linkPlain, buttonLink({ tone: 'secondary' })]}
                  >
                    Zur ersten Seite
                  </a>
                ) : null}
                {filter ? (
                  <a
                    href={routes.verwaltung.offeringConfigs.index.href()}
                    data-rmx-target={getSelfFrameTarget()}
                    mix={[table.linkPlain, buttonLink({ tone: 'secondary' })]}
                  >
                    Filter zurücksetzen
                  </a>
                ) : null}
                {!hasFormPanel ? (
                  <a
                    href={buildCreateUrl(ADMIN_BASE, offset, sortColumn, sortDirection, filter)}
                    data-rmx-target={getSelfFrameTarget()}
                    mix={[table.linkPlain, buttonLink({ tone: 'primary' })]}
                  >
                    <Glyph name="add" width={14} height={14} /> Neu anlegen
                  </a>
                ) : null}
              </div>
            </div>
          ) : (
            <table mix={table.table}>
              <caption mix={srOnlyStyle}>Angebotskonfigurationen</caption>
              <colgroup>
                <col mix={css({ width: '180px' })} />
                <col />
                <col mix={css({ width: '210px' })} />
                <col mix={css({ width: '170px' })} />
                <col mix={[colActionsWidth, table.floatingActionsCol]} />
              </colgroup>
              <thead>
                <tr>
                  <th
                    scope="col"
                    mix={table.thSortable}
                    aria-sort={sortRule('resource_description', sortColumn, sortDirection)}
                  >
                    <a
                      href={buildSortUrl(
                        ADMIN_BASE,
                        'resource_description',
                        sortColumn,
                        sortDirection,
                        offset,
                        filter,
                      )}
                      data-rmx-target={getSelfFrameTarget()}
                      mix={table.sortLink}
                      title="Nach Ressource sortieren"
                    >
                      Ressource
                      <span
                        mix={
                          'resource_description' === sortColumn
                            ? table.sortArrowActive
                            : table.sortArrow
                        }
                      >
                        {sortArrow('resource_description', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th scope="col" mix={table.th}>
                    Beschreibung
                  </th>
                  <th scope="col" mix={table.th}>
                    Zeiten
                  </th>
                  <th
                    scope="col"
                    mix={table.thSortable}
                    aria-sort={sortRule('updated_at', sortColumn, sortDirection)}
                  >
                    <a
                      href={buildSortUrl(
                        ADMIN_BASE,
                        'updated_at',
                        sortColumn,
                        sortDirection,
                        offset,
                        filter,
                      )}
                      data-rmx-target={getSelfFrameTarget()}
                      mix={table.sortLink}
                      title="Nach Änderungsdatum sortieren"
                    >
                      Aktualisiert
                      <span
                        mix={'updated_at' === sortColumn ? table.sortArrowActive : table.sortArrow}
                      >
                        {sortArrow('updated_at', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th
                    scope="col"
                    mix={[table.th, colActionsWidth, table.floatingActionsHeader]}
                    aria-label="Aktionen"
                  >
                    <span mix={table.floatingActionsHeaderText}>Aktionen</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  let summary = summarizeWeek(row.rules)
                  let label = rowResourceName(row)
                  let editHref = buildEditUrl(
                    ADMIN_BASE,
                    row.id,
                    offset,
                    sortColumn,
                    sortDirection,
                    filter,
                  )
                  return (
                    <tr
                      key={row.id}
                      mix={[
                        table.row,
                        table.floatingRowReveal,
                        table.floatingTrailingFade,
                        editRow?.id === row.id ? table.editingRow : undefined,
                      ]}
                      data-row-id={row.id}
                    >
                      <td mix={table.td} data-label="Ressource" title={label}>
                        <a
                          href={editHref}
                          data-rmx-target={getSelfFrameTarget()}
                          mix={nameLinkStyle}
                          title={`${label} bearbeiten`}
                        >
                          {label}
                        </a>
                      </td>
                      <td
                        mix={table.td}
                        data-label="Beschreibung"
                        title={row.resource_description ?? ''}
                      >
                        <span mix={cellValueStyle}>{row.resource_description ?? '—'}</span>
                      </td>
                      <td mix={table.td} data-label="Zeiten" title={summary.detail}>
                        <span mix={[table.cellStack, weekCellStackStyle]}>
                          <span mix={weekSummaryStyle}>
                            {summary.groups.map((group, index) => (
                              // The separator sits outside the nowrap span so a long week wraps
                              // between groups instead of splitting "Di 08:00–17:00" in half.
                              <span key={group}>
                                {index > 0 ? ' · ' : null}
                                <span mix={weekGroupStyle}>{group}</span>
                              </span>
                            ))}
                          </span>
                          <span mix={weekMetaStyle}>{weekMeta(summary)}</span>
                        </span>
                      </td>
                      <td
                        mix={table.td}
                        data-label="Aktualisiert"
                        data-floating-trailing
                        title={formatTimestamp(row.updated_at)}
                      >
                        <span mix={cellValueStyle}>{formatTimestamp(row.updated_at)}</span>
                      </td>
                      <td
                        mix={[table.actionCell, table.floatingActionCell, table.mobileActionsCell]}
                        data-label="Aktionen"
                      >
                        <button
                          type="button"
                          data-row-actions-trigger
                          aria-expanded="false"
                          aria-controls={`offering-config-row-actions-${row.id}`}
                          aria-label={`Weitere Aktionen für ${label}`}
                          title="Weitere Aktionen"
                          mix={table.floatingActionsTrigger}
                        >
                          <span aria-hidden="true">⋮</span>
                        </button>
                        <div
                          id={`offering-config-row-actions-${row.id}`}
                          mix={[table.actionGroup, table.floatingActions]}
                          role="group"
                          aria-label={`Aktionen für ${label}`}
                          data-row-actions
                        >
                          <a
                            href={editHref}
                            data-rmx-target={getSelfFrameTarget()}
                            mix={[table.actionSeg, table.actionSegLabeled]}
                            aria-label={`${label} bearbeiten`}
                            title="Bearbeiten"
                          >
                            <Glyph name="edit" width={14} height={14} mix={table.actionGlyph} />
                            <span data-action-label mix={table.actionLabel}>
                              Bearbeiten
                            </span>
                          </a>
                          <RestfulForm
                            method="DELETE"
                            action={routes.verwaltung.offeringConfigs.destroy.href({ id: row.id })}
                            data-delete-form={row.id}
                            data-confirm={`Konfiguration für „${label}“ wirklich löschen?`}
                            data-rmx-target={getSelfFrameTarget()}
                            mix={css({ margin: 0, padding: 0, display: 'inline-flex' })}
                          >
                            <GridStateHiddenInputs
                              state={{
                                offset: String(offset),
                                sort: sortColumn,
                                order: sortDirection,
                                filter: filter ?? '',
                              }}
                            />
                            <button
                              type="submit"
                              mix={[table.actionSeg, table.actionSegDanger, table.actionSegLabeled]}
                              aria-label={`${label} löschen`}
                              title="Löschen"
                            >
                              <Glyph name="trash" width={14} height={14} mix={table.actionGlyph} />
                              <span data-action-label mix={table.actionLabel}>
                                Löschen
                              </span>
                            </button>
                          </RestfulForm>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {/* Context menu data and clientEntry */}
          <GridStateScript
            id="offering-configs-grid-state"
            baseHref={routes.verwaltung.offeringConfigs.index.href()}
            offset={offset}
            sort={sortColumn}
            order={sortDirection}
            filter={filter}
          />
          <AdminOfferingConfigsContextMenu />
          <AdminRowActionsOverlay />
        </div>

        {(rows.length > 0 || offset > 0) && (
          <div mix={table.pagination}>
            <span mix={paginationInfoGroupStyle}>
              {rows.length > 0 ? (
                <span mix={table.paginationInfo} data-pagination-info>
                  Zeige {pageStart}
                  {'–'}
                  {pageEnd} von {total}
                </span>
              ) : null}
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
                  )}
                  data-rmx-target={getSelfFrameTarget()}
                  data-rmx-prefetch="viewport"
                  mix={table.pageLink}
                  aria-label="Vorherige Seite"
                >
                  <Glyph name="chevronRight" width={14} height={14} mix={rotatedGlyphCss} />{' '}
                  {'Zurück'}
                </a>
              ) : (
                <span mix={table.pageLinkDisabled}>
                  <Glyph name="chevronRight" width={14} height={14} mix={rotatedGlyphCss} />{' '}
                  {'Zurück'}
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
                  )}
                  data-rmx-target={getSelfFrameTarget()}
                  data-rmx-prefetch="viewport"
                  mix={table.pageLink}
                  aria-label="Nächste Seite"
                >
                  Weiter <Glyph name="chevronRight" width={14} height={14} />
                </a>
              ) : (
                <span mix={table.pageLinkDisabled}>
                  Weiter <Glyph name="chevronRight" width={14} height={14} />
                </span>
              )}
              <PageSizeControl
                action={routes.verwaltung.pageSize.href()}
                pageKey={pageKey}
                pageSize={pageSize}
                pageSizeOverride={pageSizeOverride}
                controlId="offering-configs-page-size"
              />
            </div>
          </div>
        )}
      </div>
    )

    if (editRow || creating) {
      return (
        <PageSection
          title="Angebotskonfigurationen"
          description="Buchbare Zeitfenster je Ressource und Wochentag."
        >
          <div mix={table.pageWide}>
            <div mix={table.twoColumn}>
              {gridSection}
              <div mix={[table.stickyPanel, panelFirstOnMobileStyle]}>
                {editRow ? (
                  <OfferingConfigEditPanel
                    row={editRow}
                    resources={resources}
                    offset={String(offset)}
                    sort={sortColumn}
                    order={sortDirection}
                    filter={filter}
                    formValues={formValues}
                    fieldErrors={fieldErrors}
                    formError={formError}
                  />
                ) : (
                  <OfferingConfigCreatePanel
                    resources={resources}
                    offset={String(offset)}
                    sort={sortColumn}
                    order={sortDirection}
                    filter={filter}
                    formValues={formValues}
                    fieldErrors={fieldErrors}
                    formError={formError}
                  />
                )}
              </div>
            </div>
          </div>
        </PageSection>
      )
    }

    return (
      <PageSection title="Angebotskonfigurationen" titleHidden compact>
        <div mix={[table.page, verwaltungGridFill]}>{gridSection}</div>
      </PageSection>
    )
  }
}

// ── Week editor ──

interface DayValue {
  checked: boolean
  start: number
  end: number
}

type DayValues = Record<string, DayValue>

interface WeekDayRowProps {
  dayKey: string
  dayLabel: string
  idPrefix: string
  value: DayValue
  error?: string | undefined
}

/** One weekday: an enable checkbox plus its start/end selects. */
function WeekDayRow(handle: Handle<WeekDayRowProps>) {
  return () => {
    let { dayKey, dayLabel, idPrefix, value, error } = handle.props
    let toggleId = `${idPrefix}-${dayKey}`
    let errorId = `${toggleId}-error`
    // Both selects are labelled: the visible label only names the checkbox, so
    // without these a screen reader announced "Kombinationsfeld 08:00" twice
    // per day with no way to tell start from end.
    return (
      <div mix={dayRowWrapStyle} data-week-day={dayKey}>
        <div mix={dayRowStyle}>
          <input
            type="checkbox"
            id={toggleId}
            name={`${dayKey}_enabled`}
            value="1"
            checked={value.checked}
            mix={dayCheckboxStyle}
          />
          <label for={toggleId} mix={dayLabelStyle}>
            {dayLabel}
          </label>
          <select
            name={`${dayKey}_start`}
            aria-label={`${dayLabel} Beginn`}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? errorId : undefined}
            mix={timeSelectStyle}
            data-week-start
          >
            {TIME_OPTIONS.map((min) => (
              <option key={min} value={min} selected={min === value.start}>
                {fmt(min)}
              </option>
            ))}
          </select>
          <span mix={daySeparatorStyle}>{'–'}</span>
          <select
            name={`${dayKey}_end`}
            aria-label={`${dayLabel} Ende`}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? errorId : undefined}
            mix={timeSelectStyle}
            data-week-end
          >
            {TIME_END_OPTIONS.map((min) => (
              <option key={min} value={min} selected={min === value.end}>
                {fmt(min)}
              </option>
            ))}
          </select>
        </div>
        {error ? (
          <div id={errorId} role="alert" mix={dayErrorStyle}>
            {error}
          </div>
        ) : null}
      </div>
    )
  }
}

interface WeekRuleFieldsProps {
  idPrefix: string
  mode: 'create' | 'edit'
  resources: OfferingConfigResourceOption[]
  selectedResourceId: number | undefined
  /** Resource the row already belongs to: selectable even though configured. */
  currentResourceId?: number | undefined
  dayValues: DayValues
  formError?: string | undefined
  fieldErrors?: Record<string, string> | undefined
}

/**
 * The resource select plus the weekly rule editor, shared by both panels so
 * their labels, hints, ARIA wiring and error messages cannot drift.
 */
function WeekRuleFields(handle: Handle<WeekRuleFieldsProps>) {
  return () => {
    let {
      idPrefix,
      mode,
      resources,
      selectedResourceId,
      currentResourceId,
      dayValues,
      formError,
      fieldErrors,
    } = handle.props
    let resourceError = fieldErrors?.resource_id
    let anyChecked = DAYS.some((day) => dayValues[day.key]?.checked)
    let selectId = `${idPrefix}-resource`
    let hintId = `${selectId}-hint`
    return (
      <>
        {formError ? (
          <div
            mix={[table.errorBanner, panelBannerStyle]}
            role="alert"
            tabIndex={-1}
            data-form-error
          >
            {formError}
          </div>
        ) : null}

        <div mix={table.fieldGroup}>
          <label mix={table.label} htmlFor={selectId}>
            Ressource
          </label>
          <select
            id={selectId}
            name="resource_id"
            required={mode === 'create'}
            data-editor-autofocus-field
            aria-invalid={resourceError ? 'true' : undefined}
            aria-describedby={resourceError ? `${selectId}-error` : hintId}
            mix={[input.base, input.focus, selectStyle, ...(resourceError ? [input.error] : [])]}
          >
            {mode === 'create' ? (
              <option value="" disabled selected={selectedResourceId === undefined}>
                Ressource auswählen
              </option>
            ) : null}
            {resources.map((resource) => {
              // A resource can hold one configuration; picking another
              // configured resource could only produce an error, so it is
              // disabled instead of offered. The row being edited stays
              // selectable (and a submitted-but-rejected choice stays selected
              // so the user's pick is not silently replaced).
              let configured =
                resource.has_config &&
                resource.id !== selectedResourceId &&
                resource.id !== currentResourceId
              return (
                <option
                  key={resource.id}
                  value={resource.id}
                  disabled={configured}
                  selected={resource.id === selectedResourceId}
                >
                  {resourceOptionLabel(resource)}
                  {configured ? ' — bereits konfiguriert' : ''}
                </option>
              )
            })}
          </select>
          {resourceError ? (
            <div id={`${selectId}-error`} role="alert" mix={fieldErrorStyle}>
              {resourceError}
            </div>
          ) : null}
          <div id={hintId} mix={fieldHintStyle}>
            Jede Ressource kann genau eine Konfiguration haben.
          </div>
        </div>

        <div mix={table.fieldGroup}>
          <span mix={weekSectionTitleStyle}>Buchbare Zeiten</span>
          <div mix={fieldHintStyle}>
            Tage aktivieren, an denen die Ressource buchbar ist — mindestens einer.
          </div>

          <WeekRulePresets />
          <div
            mix={presetsBarStyle}
            data-week-presets
            role="group"
            aria-label="Schnellauswahl für Wochentage"
          >
            <button type="button" data-week-preset="weekdays" mix={presetButtonStyle}>
              Mo–Fr
            </button>
            <button type="button" data-week-preset="all" mix={presetButtonStyle}>
              Alle Tage
            </button>
            <button type="button" data-week-preset="none" mix={presetButtonStyle}>
              Keine
            </button>
            <span mix={table.spacer} />
            <button
              type="button"
              data-week-preset="copy"
              disabled={!anyChecked}
              title="Zeiten des ersten aktiven Tages auf alle aktiven Tage übertragen"
              mix={presetButtonStyle}
            >
              Zeiten übertragen
            </button>
            {/* Announced after a preset runs: changing a checkbox or a select
                through script is not spoken by screen readers on its own. */}
            <span data-week-preset-status role="status" aria-live="polite" mix={srOnlyStyle} />
          </div>

          {DAYS.map((day) => (
            <WeekDayRow
              key={day.key}
              dayKey={day.key}
              dayLabel={day.label}
              idPrefix={idPrefix}
              value={dayValues[day.key]!}
              error={fieldErrors?.[day.key]}
            />
          ))}
        </div>
      </>
    )
  }
}

function editDayValues(
  row: OfferingConfigRow,
  formValues: Record<string, string> | undefined,
): DayValues {
  let rules = row.rules ?? {}
  let values: DayValues = {}
  for (let day of DAYS) {
    let rule = rules[day.key]
    let startRaw = formValues?.[`${day.key}_start`]
    let endRaw = formValues?.[`${day.key}_end`]
    values[day.key] = {
      checked: formValues ? formValues[`${day.key}_enabled`] === '1' : !!rule,
      start: startRaw ? Number(startRaw) : rule ? rule[0] : 480,
      end: endRaw ? Number(endRaw) : rule ? rule[1] : 1020,
    }
  }
  return values
}

function createDayValues(formValues: Record<string, string> | undefined): DayValues {
  let values: DayValues = {}
  for (let day of DAYS) {
    values[day.key] = {
      checked: formValues?.[`${day.key}_enabled`] === '1',
      start: Number(formValues?.[`${day.key}_start`] ?? 480),
      end: Number(formValues?.[`${day.key}_end`] ?? 1020),
    }
  }
  return values
}

// ── Inline edit panel ──

interface EditPanelProps {
  row: OfferingConfigRow
  resources: OfferingConfigResourceOption[]
  offset?: string | undefined
  sort?: string | undefined
  order?: string | undefined
  filter?: string | undefined
  formValues?: Record<string, string> | undefined
  fieldErrors?: Record<string, string> | undefined
  formError?: string | undefined
}

function OfferingConfigEditPanel(handle: Handle<EditPanelProps>) {
  return () => {
    let {
      row,
      resources,
      offset = '',
      sort = '',
      order = '',
      filter = '',
      formValues,
      fieldErrors,
      formError,
    } = handle.props
    let dayValues = editDayValues(row, formValues)
    let selectedResourceId = formValues?.resource_id
      ? Number(formValues.resource_id)
      : Number(row.resource_id)
    let label = rowResourceName(row)
    return (
      <div mix={panelEntrance}>
        <RestfulForm
          method="PUT"
          action={routes.verwaltung.offeringConfigs.update.href({ id: row.id })}
          data-rmx-target={getSelfFrameTarget()}
          novalidate
        >
          <GridStateHiddenInputs state={{ offset, sort, order, filter }} />
          <FormErrorFocus />
          <EditorAutofocus />
          <DirtyFormGuard />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={table.panelTitle}>Konfiguration bearbeiten</span>
              <span mix={panelResourceStyle} title={label}>
                {label}
              </span>
              <span mix={table.spacer} />
              <span mix={panelIdStyle}>#{row.id}</span>
            </div>

            <div mix={table.panelBody}>
              <WeekRuleFields
                idPrefix="oc"
                mode="edit"
                resources={resources}
                selectedResourceId={selectedResourceId}
                currentResourceId={row.resource_id}
                dayValues={dayValues}
                formError={formError}
                fieldErrors={fieldErrors}
              />

              <div mix={table.actions}>
                <PendingSubmitButton>Speichern</PendingSubmitButton>
                <a
                  href={buildCancelUrl(
                    routes.verwaltung.offeringConfigs.index.href(),
                    offset,
                    sort,
                    order,
                    filter,
                  )}
                  mix={[
                    table.spacer,
                    table.linkPlain,
                    buttonLink({ tone: 'secondary' }),
                    css({ width: '100%' }),
                  ]}
                >
                  Abbrechen
                </a>
              </div>
            </div>
          </div>
        </RestfulForm>
      </div>
    )
  }
}

// ── Inline create panel ──

interface CreatePanelProps {
  resources: OfferingConfigResourceOption[]
  offset?: string | undefined
  sort?: string | undefined
  order?: string | undefined
  filter?: string | undefined
  formValues?: Record<string, string> | undefined
  fieldErrors?: Record<string, string> | undefined
  formError?: string | undefined
}

function OfferingConfigCreatePanel(handle: Handle<CreatePanelProps>) {
  return () => {
    let {
      resources,
      offset = '',
      sort = '',
      order = '',
      filter = '',
      formValues,
      fieldErrors,
      formError,
    } = handle.props
    if (!resources.some((resource) => !resource.has_config)) {
      return <NoAvailableResources resources={resources} formError={formError} />
    }
    let dayValues = createDayValues(formValues)
    let selectedResourceId = formValues?.resource_id ? Number(formValues.resource_id) : undefined
    return (
      <div mix={panelEntrance}>
        {/* Agent-aware create form: the support-agent panel's SSE replay must
            keep owning this submit (its controller answers the agent's
            ask_user gate with JSON), so it carries the data-agent-form marker
            even though its corrected data-rmx-target names the panel.
            novalidate keeps validation server-owned, so the schema's German
            inline errors own the flow instead of the browser's locale bubble. */}
        <RestfulForm
          method="POST"
          action={routes.verwaltung.offeringConfigs.create.href()}
          data-rmx-target={getSelfFrameTarget()}
          data-agent-form="true"
          novalidate
        >
          <GridStateHiddenInputs state={{ offset, sort, order, filter }} />
          <FormErrorFocus />
          <EditorAutofocus />
          <DirtyFormGuard />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={table.panelTitle}>Neue Konfiguration</span>
            </div>

            <div mix={table.panelBody}>
              <WeekRuleFields
                idPrefix="oc-c"
                mode="create"
                resources={resources}
                selectedResourceId={selectedResourceId}
                dayValues={dayValues}
                formError={formError}
                fieldErrors={fieldErrors}
              />

              <div mix={table.actions}>
                <PendingSubmitButton>Anlegen</PendingSubmitButton>
                <a
                  href={buildCancelUrl(
                    routes.verwaltung.offeringConfigs.index.href(),
                    offset,
                    sort,
                    order,
                    filter,
                  )}
                  mix={[
                    table.spacer,
                    table.linkPlain,
                    buttonLink({ tone: 'secondary' }),
                    css({ width: '100%' }),
                  ]}
                >
                  Abbrechen
                </a>
              </div>
            </div>
          </div>
        </RestfulForm>
      </div>
    )
  }
}

interface NoAvailableResourcesProps {
  resources: OfferingConfigResourceOption[]
  formError?: string | undefined
}

function NoAvailableResources(handle: Handle<NoAvailableResourcesProps>) {
  return () => {
    let { resources, formError } = handle.props
    let noneAtAll = resources.length === 0
    return (
      <div mix={panelEntrance}>
        <div mix={table.panel}>
          <div mix={table.panelHeader}>
            <span mix={table.panelTitle}>Neue Konfiguration</span>
          </div>
          <div mix={table.panelBody}>
            {formError ? (
              <div mix={table.errorBanner} role="alert">
                {formError}
              </div>
            ) : null}
            <p mix={fieldHintStyle}>
              {noneAtAll
                ? 'Es sind noch keine Ressourcen vorhanden. Legen Sie zuerst eine Ressource an.'
                : 'Alle Ressourcen haben bereits eine Konfiguration. Bearbeiten Sie eine bestehende oder legen Sie zuerst eine neue Ressource an.'}
            </p>
            <div mix={table.actions}>
              <a
                href={routes.verwaltung.resources.index.href()}
                data-rmx-target={getSelfFrameTarget()}
                mix={[table.linkPlain, buttonLink({ tone: 'primary' })]}
              >
                {noneAtAll ? 'Ressourcen anlegen' : 'Ressourcen verwalten'}
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }
}
