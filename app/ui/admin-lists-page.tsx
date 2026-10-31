import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { panelEntrance } from './mixins/panel-entrance.ts'
import { theme } from '../ui/theme/theme.ts'
import { buttonLink } from '../ui/theme/button.ts'
import { Glyph } from '../ui/theme/glyph/glyph.tsx'
import { input } from './mixins/input.ts'

import { routes } from '../routes.ts'
import { getSelfFrameTarget } from '../utils/frame-target.ts'
import { RestfulForm } from './restful-form.tsx'
import { GridStateHiddenInputs } from './grid-state-hidden.tsx'
import { ConfirmDelete } from './confirm-delete.browser.tsx'
import { DirtyFormGuard } from './dirty-form-guard.browser.tsx'
import { EditorAutofocus } from './editor-autofocus.browser.tsx'
import { FilterAutoSubmit } from './filter-autosubmit.browser.tsx'
import { FormErrorFocus } from './form-error-focus.browser.tsx'
import { PendingSubmitButton } from './pending-submit.browser.tsx'
import { table } from './mixins/admin-table.ts'
import { rotatedGlyphCss } from './mixins/icon.ts'
import { isListItemFilter, type ListRow } from '../data/admin-lists.ts'
import {
  sortArrow,
  sortRule,
  buildSortUrl,
  buildPaginationUrl,
  buildCreateUrl,
  buildCancelUrl,
  buildEditUrl,
  buildFilterParams,
  formatTimestamp,
} from './mixins/admin-urls.ts'
import { PageSizeControl } from './page-size-control.tsx'
import { dataGridFill, dataGridWrap } from './mixins/data-grid.ts'
import { formatCompactDateDE } from '../utils/date-utils.ts'
import { paginationWindow } from '../utils/pagination-window.ts'
import type { PageSizeKey } from '../utils/get-page-size.ts'

const ADMIN_BASE = routes.admin.lists.index.href()

interface AdminListsPageProps {
  lists: ListRow[]
  offset: number
  hasMore: boolean
  /** Total rows matching the active filter (not just the current page). */
  total: number
  prevOffset: number
  nextOffset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
  status?: string | undefined
  editRow?: ListRow | null
  creating?: boolean
  pageSize: number
  pageKey: PageSizeKey
  pageSizeOverride: number | null
  formValues?: Record<string, string> | undefined
  fieldErrors?: Record<string, string> | undefined
  formError?: string | undefined
}

// -- Styles --

const inputErrorStyle = css({
  borderColor: theme.colors.action.danger.background,
  '&:focus': {
    borderColor: theme.colors.action.danger.background,
  },
})

const fieldErrorStyle = css({
  marginTop: theme.space.xs,
  fontSize: theme.fontSize.xxs,
  color: theme.colors.action.danger.background,
})

/** Compact button sizing for the toolbar's Aktualisieren/Neu anlegen links. */
const smallBtnStyle = css({
  minHeight: '1.75rem',
  paddingInline: '0.5rem',
  fontSize: '0.75rem',
})

const titleCellStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  minWidth: 0,
  // In the phone card layout the cell is a flex row (label ::before + value);
  // let the title block take the remaining width instead of hugging content.
  flex: '1 1 auto',
})

const titleTextStyle = css({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontWeight: theme.fontWeight.medium,
  color: theme.colors.text.primary,
  textDecoration: 'none',
  '&:hover': {
    color: theme.colors.action.primary.background,
    textDecoration: 'underline',
  },
  '&:focus-visible': {
    outline: '2px solid ' + theme.colors.focus.ring,
    outlineOffset: '2px',
  },
})

const descLinkStyle = css({
  color: theme.colors.action.primary.background,
  fontWeight: theme.fontWeight.medium,
  textDecoration: 'none',
  fontSize: theme.fontSize.xs,
  display: 'block',
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  '&:hover': {
    textDecoration: 'underline',
  },
})

const descEmptyStyle = css({
  color: theme.colors.text.muted,
  fontStyle: 'italic',
  fontSize: theme.fontSize.xs,
})

/** Legacy rows can have an empty title column; the grid still needs a
 *  clickable, identifiable label for the edit action and delete confirmation. */
const noTitleStyle = css({
  color: theme.colors.text.muted,
  fontStyle: 'italic',
})

/** Owner email in the Besitzer column: a quiet link that drills into the
 *  filtered users grid without competing with the title for attention. */
const ownerLinkStyle = css({
  color: theme.colors.text.secondary,
  textDecoration: 'none',
  '&:hover': {
    color: theme.colors.action.primary.background,
    textDecoration: 'underline',
  },
})

/** Restores Titel/Vorschau breathing room after the Besitzer column raised the
 *  fixed-column total. The shared `table` mixin floors at 840px for a narrower
 *  colgroup, so this page needs its own floor. Keep this in sync with the
 *  widest colgroup (currently seven columns). `!important` because the two
 *  rules land in sibling `@layer rmx.*` sub-layers (see admin-table.ts
 *  `twoColumnGrid`). The mobile override drops the floor so `mobileCards` can
 *  turn rows into viewport-width cards instead of leaving the action column
 *  behind a horizontal scrollbar. */
const listsTableFullStyle = css({
  minWidth: '880px !important',
  // Cards below 1200px: the admin sidebar leaves less than the 880px floor,
  // so keeping the table would hide Aktionen behind a horizontal scrollbar.
  '@media (max-width: 1199px), (hover: none)': { minWidth: '0 !important' },
})

/**
 * Floor while the inline editor shares the row. The focused grid drops ID,
 * Vorschau and Aktualisiert, so the remaining columns fit beside the 340px
 * panel and the row actions stay reachable instead of scrolling off-screen.
 */
const listsTableCompactStyle = css({
  minWidth: '500px !important',
  '@media (max-width: 1199px), (hover: none)': { minWidth: '0 !important' },
})

/** Quiet explanatory line under a form field. */
const fieldHintStyle = css({
  marginTop: theme.space.xs,
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
})

const previewListStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4px',
  maxWidth: '320px',
})

const previewChipStyle = css({
  display: 'inline-block',
  maxWidth: '150px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  padding: '1px ' + theme.space.xs,
  background: theme.surface.lvl0,
  border: '1px solid ' + theme.colors.border.subtle,
  borderRadius: theme.radius.sm,
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.secondary,
})

const previewChipDoneStyle = css({
  color: theme.colors.text.muted,
  textDecoration: 'line-through',
})

const previewMoreStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '1px ' + theme.space.xs,
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
})

/** Expanded "Alle Elemente" list. Capped and scrollable: a long list must
 *  not stretch its table row to the height of every element. */
const detailsStyle = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.secondary,
  marginTop: theme.space.sm,
  padding: theme.space.sm,
  background: theme.surface.lvl0,
  borderRadius: theme.radius.md,
  border: '1px solid ' + theme.colors.border.subtle,
  lineHeight: 1.6,
  maxHeight: '10rem',
  overflowY: 'auto',
  overflowX: 'hidden',
  overscrollBehavior: 'contain',
})

const detailsItemStyle = css({
  display: 'flex',
  alignItems: 'baseline',
  gap: '4px',
  minWidth: 0,
})

/** Truncated element label in the expanded list; the full text is exposed
 *  through a native tooltip because the preview column is narrow. */
const detailsLabelStyle = css({
  flex: '1 1 auto',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
})

const detailsIndexStyle = css({
  color: theme.colors.text.muted,
  minWidth: '1.5em',
  flexShrink: 0,
})

const detailsCheckStyle = css({
  color: theme.colors.success.foreground,
  fontWeight: theme.fontWeight.bold,
  flexShrink: 0,
})

const summaryStyle = css({
  cursor: 'pointer',
  color: theme.colors.action.primary.background,
  fontWeight: theme.fontWeight.medium,
  fontSize: theme.fontSize.xs,
  marginTop: '2px',
})

// Fixed widths are deliberately compact: the admin content column is 896px
// wide, so the seven-column table (880px floor) must leave enough room for
// Titel and Vorschau without pushing Aktionen behind a horizontal scrollbar.
const colOwnerWidth = css({ width: '160px' })
const colItemsWidth = css({ width: '84px' })
const colUpdatedWidth = css({ width: '120px' })

/** Fixed preview width so the reclaimed action-column space grows Titel. */
const colPreviewWidth = css({ width: '200px' })

const itemCountBadgeStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '28px',
  padding: theme.space.xs + ' ' + theme.space.sm,
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  borderRadius: theme.radius.full,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  whiteSpace: 'nowrap',
})

const itemCountBadgeDoneStyle = css({
  background: theme.colors.success.background,
  color: theme.colors.success.foreground,
})

const emptyStateStyle = css({
  textAlign: 'center',
  padding: theme.space.xxl,
  color: theme.colors.text.muted,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.space.md,
})

const emptyActionsStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: theme.space.sm,
})

/** Screen-reader-only table caption. */
const srOnlyStyle = css({
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: 0,
})

const descriptionStyle = css({
  margin: `0 0 ${theme.space.md}`,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
  // Phones already spend their first screen on the toolbar; the explanatory
  // line is supplementary and would push the first card further down.
  '@media (max-width: 768px)': { display: 'none' },
})

/** Groups the preview chips and the "Alle N Elemente" disclosure so the phone
 *  card layout treats them as one value instead of two side-by-side children. */
const previewCellStyle = css({
  minWidth: 0,
  maxWidth: '100%',
  '@media (max-width: 768px)': { flex: '1 1 auto' },
})

/** Two-line date/time stack: the full "26.10.2026, 19:44" no longer fits the
 *  150px column and used to be clipped to "26.10.2026, 19…". */
const dateStackStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1px',
  lineHeight: theme.lineHeight.tight,
})

const dateMainStyle = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.secondary,
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
})

const dateTimeStyle = css({
  fontSize: theme.fontSize.xxs,
  color: theme.colors.text.muted,
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
})

/**
 * Phones and tablets: grow the page with its cards instead of clipping them
 * into the bounded desktop scroller, so the whole result set is reachable with
 * one scroll gesture (mirrors the messages/uploads grids).
 */
const listsGridWrapStyle = css({
  '@media (max-width: 1199px), (hover: none)': {
    flex: '0 0 auto',
    overflowY: 'visible',
  },
})

/**
 * Stacked-card layout for narrow viewports.
 *
 * The shared `table.mobileCards` breakpoint (768px) is too narrow for this
 * seven-column grid: with the admin sidebar visible, the content column stays
 * below the table's 880px floor until roughly 1200px, which left the row
 * actions behind a horizontal scrollbar on tablets and small laptops. The
 * rules below are the shared card layout at the wider breakpoint; keep them in
 * sync with `table.mobileCards` in mixins/admin-table.ts.
 */
const listsCardsStyle = css({
  '@media (max-width: 1199px), (hover: none)': {
    '& table': { display: 'block', tableLayout: 'auto', minWidth: '0 !important' },
    '& thead': { display: 'none' },
    '& tbody': { display: 'block' },
    '& tbody tr': {
      display: 'grid',
      gridTemplateColumns: '1fr',
      gap: theme.space.xs,
      padding: theme.space.sm,
      marginBottom: theme.space.sm,
      border: `1px solid ${theme.colors.border.default}`,
      borderRadius: theme.radius.md,
      background: theme.surface.lvl1,
    },
    '& tbody td': {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.space.sm,
      padding: `${theme.space.xs} 0`,
      borderBottom: 'none',
      overflow: 'visible',
      textOverflow: 'clip',
      whiteSpace: 'normal',
      '&::before': {
        content: 'attr(data-label)',
        flexShrink: 0,
        fontWeight: theme.fontWeight.semibold,
        fontSize: theme.fontSize.xs,
        color: theme.colors.text.secondary,
      },
    },
  },
})

/**
 * Sort toggles for phones: `table.mobileCards` hides the header row, so the
 * desktop sort links would otherwise disappear with it.
 */
const mobileSortStyle = css({
  display: 'none',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: theme.space.xs,
  width: '100%',
  '@media (max-width: 1199px), (hover: none)': { display: 'flex' },
})

const mobileSortLabelStyle = css({
  fontSize: theme.fontSize.xxs,
  fontWeight: theme.fontWeight.semibold,
  letterSpacing: theme.letterSpacing.meta,
  textTransform: 'uppercase',
  color: theme.colors.text.muted,
})

/** Footer stacks its info and controls on narrow viewports instead of wrapping
 *  mid-control. */
const paginationBarStyle = css({
  gap: theme.space.sm,
  '@media (max-width: 900px)': {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
})

const paginationControlsStyle = css({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: theme.space.sm,
  marginLeft: 'auto',
  '@media (max-width: 900px)': {
    marginLeft: 0,
    justifyContent: 'space-between',
  },
})

const pageNavStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '0.25rem',
})

const pageNumbersStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
})

const pageCurrentStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '1.75rem',
  height: '1.75rem',
  padding: '0 0.375rem',
  borderRadius: theme.radius.md,
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
})

const pageNumberLinkStyle = css({
  minWidth: '1.75rem',
  justifyContent: 'center',
})

const pageGapStyle = css({
  padding: '0 0.125rem',
  color: theme.colors.text.muted,
  fontSize: theme.fontSize.xs,
})

/** Close affordance in the editor header; the action row's Abbrechen stays the
 *  primary escape hatch, but a user who only sees the header should not have to
 *  hunt for it. */
const panelCloseStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '1.75rem',
  height: '1.75rem',
  marginLeft: 'auto',
  borderRadius: theme.radius.sm,
  color: theme.colors.text.muted,
  textDecoration: 'none',
  '&:hover': { background: theme.surface.lvl3, color: theme.colors.text.primary },
  '&:focus-visible': {
    outline: '2px solid ' + theme.colors.focus.ring,
    outlineOffset: '1px',
  },
})

/**
 * Narrow viewports stack the editor under the grid, which would leave the open
 * panel below every row. Pull it above the grid so opening a row shows the
 * editor immediately (the focused row stays highlighted below).
 */
const panelOrderStyle = css({
  '@media (max-width: 1100px)': {
    order: -1,
  },
})

/** ID/Elemente/Besitzer/Aktualisiert summary under the editor header. The
 *  focused grid hides those columns while the panel is open, so the panel
 *  carries the context instead. */
const panelMetaStyle = css({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: `${theme.space.xs} ${theme.space.md}`,
  padding: `${theme.space.sm} ${theme.space.lg}`,
  borderBottom: '1px solid ' + theme.colors.border.subtle,
  background: theme.surface.lvl0,
})

const panelMetaItemStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1px',
  minWidth: 0,
})

const panelMetaLabelStyle = css({
  fontSize: theme.fontSize.xxxs,
  fontWeight: theme.fontWeight.semibold,
  letterSpacing: theme.letterSpacing.meta,
  textTransform: 'uppercase',
  color: theme.colors.text.muted,
})

const panelMetaValueStyle = css({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.secondary,
})

/** Secondary line under a meta value (e.g. the done count). */
const panelMetaExtraStyle = css({
  fontSize: theme.fontSize.xxxs,
  color: theme.colors.text.muted,
  whiteSpace: 'nowrap',
})

const SORT_OPTIONS = [
  { field: 'title', label: 'Titel' },
  { field: 'owner', label: 'Besitzer' },
  { field: 'items', label: 'Elemente' },
  { field: 'updated_at', label: 'Aktualisiert' },
] as const

/** A list can legally have an empty title column; give the row an actionable,
 *  identifiable label instead of rendering a blank click target. */
function listDisplayTitle(title: string | null | undefined): string {
  let trimmed = title?.trim() ?? ''
  return trimmed || 'Ohne Titel'
}

function formatClockTime(ts: number | null | undefined): string {
  if (ts == null) return ''
  return new Date(Number(ts)).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function itemCountLabel(count: number): string {
  return count === 1 ? '1 Element' : count + ' Elemente'
}

// Component

export function AdminListsPage(handle: Handle<AdminListsPageProps>) {
  return () => {
    let {
      lists,
      offset,
      hasMore,
      total,
      prevOffset,
      nextOffset,
      sortColumn,
      sortDirection,
      filter,
      status,
      editRow = null,
      creating = false,
      pageSize,
      pageKey,
      pageSizeOverride,
      formValues,
      fieldErrors,
      formError,
    } = handle.props
    let hasFormPanel = Boolean(editRow || creating)
    let activeItemFilter = isListItemFilter(status) ? status : undefined
    let totalPages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1
    let currentPage = pageSize > 0 ? Math.floor(offset / pageSize) + 1 : 1
    // A stale offset (old bookmark, concurrent delete, filter change) can sit
    // past the end of the result set; never print a page number that does not
    // exist and never tell the user the whole collection is empty.
    let displayedPage = Math.min(currentPage, totalPages)
    let stalePage = lists.length === 0 && offset > 0
    let pageStart = offset + 1
    let pageEnd = lists.length > 0 ? offset + lists.length : offset
    let noun = total === 1 ? 'Liste' : 'Listen'
    let hasFilters = Boolean(filter || activeItemFilter)
    let resetFilterHref = ADMIN_BASE + '?' + buildFilterParams('', sortColumn, sortDirection, 0)

    let pageInfo =
      total === 0
        ? 'Keine Listen'
        : stalePage
          ? `Seite ${displayedPage} von ${totalPages} · insgesamt ${total} ${noun}`
          : `${pageStart}–${pageEnd} von ${total} ${noun}` +
            (totalPages > 1 ? ` · Seite ${currentPage} von ${totalPages}` : '')

    // Name the active filter so the empty state explains why nothing matched.
    let emptyMessage: string
    if (stalePage) {
      emptyMessage = 'Keine Listen auf dieser Seite.'
    } else if (filter && activeItemFilter) {
      emptyMessage = 'Keine Listen für diese Suche und diesen Filter gefunden.'
    } else if (filter) {
      emptyMessage = 'Keine Listen für diese Suche gefunden.'
    } else if (activeItemFilter === 'empty') {
      emptyMessage = 'Keine leeren Listen gefunden.'
    } else if (activeItemFilter === 'items') {
      emptyMessage = 'Keine Listen mit Elementen gefunden.'
    } else {
      emptyMessage = 'Noch keine Listen gespeichert.'
    }

    let gridSection = (
      <div mix={[table.minWidth0, hasFormPanel ? undefined : dataGridFill]}>
        <ConfirmDelete />

        <form
          method="GET"
          action={routes.admin.lists.index.href()}
          role="search"
          aria-label="Listen durchsuchen"
          data-rmx-target={getSelfFrameTarget()}
          data-rmx-history="replace"
          data-rmx-reset-focus="manual"
          data-lists-filter
          mix={table.filterBar}
        >
          <div mix={table.filterGroup} role="group" aria-label="Nach Elementanzahl filtern">
            {/* Item-count tabs always reset to page 1: keeping a stale offset
                while the result set changes can land on an empty page. They
                preserve the text search. */}
            <a
              href={
                ADMIN_BASE + '?' + buildFilterParams(filter ?? '', sortColumn, sortDirection, 0)
              }
              data-rmx-target={getSelfFrameTarget()}
              data-rmx-prefetch="intent"
              aria-current={!activeItemFilter ? 'true' : undefined}
              mix={[table.filterTab, !activeItemFilter ? table.filterTabActive : undefined]}
            >
              Alle
            </a>
            <a
              href={
                ADMIN_BASE +
                '?' +
                buildFilterParams(filter ?? '', sortColumn, sortDirection, 0, undefined, 'items')
              }
              data-rmx-target={getSelfFrameTarget()}
              data-rmx-prefetch="intent"
              aria-current={activeItemFilter === 'items' ? 'true' : undefined}
              mix={[
                table.filterTab,
                activeItemFilter === 'items' ? table.filterTabActive : undefined,
              ]}
            >
              Mit Elementen
            </a>
            <a
              href={
                ADMIN_BASE +
                '?' +
                buildFilterParams(filter ?? '', sortColumn, sortDirection, 0, undefined, 'empty')
              }
              data-rmx-target={getSelfFrameTarget()}
              data-rmx-prefetch="intent"
              aria-current={activeItemFilter === 'empty' ? 'true' : undefined}
              mix={[
                table.filterTab,
                activeItemFilter === 'empty' ? table.filterTabActive : undefined,
              ]}
            >
              Leer
            </a>
          </div>
          {/* Preserve the active sort and item filter when searching; the offset
              is intentionally absent so a new search starts on page 1. */}
          <input type="hidden" name="sort" value={sortColumn} />
          <input type="hidden" name="order" value={sortDirection} />
          {activeItemFilter ? <input type="hidden" name="status" value={activeItemFilter} /> : null}
          <input
            type="search"
            name="filter"
            placeholder="Titel, Element, Besitzer…"
            defaultValue={filter ?? ''}
            aria-label="Nach Titel, Beschreibung, Element oder Besitzer suchen"
            autoComplete="off"
            enterKeyHint="search"
            mix={table.filterInput}
          />
          <button type="submit" mix={table.searchBtn}>
            <Glyph name="search" width={14} height={14} /> Suchen
          </button>
          {hasFilters ? (
            <a href={resetFilterHref} data-rmx-target={getSelfFrameTarget()} mix={table.clearLink}>
              Zurücksetzen
            </a>
          ) : null}
          <span mix={mobileSortStyle} data-mobile-sort>
            <span mix={mobileSortLabelStyle}>Sortieren:</span>
            {SORT_OPTIONS.map((option) => {
              let active = sortColumn === option.field
              return (
                <a
                  key={option.field}
                  href={buildSortUrl(
                    ADMIN_BASE,
                    option.field,
                    sortColumn,
                    sortDirection,
                    offset,
                    filter,
                    undefined,
                    activeItemFilter,
                  )}
                  data-rmx-target={getSelfFrameTarget()}
                  aria-label={'Nach ' + option.label + ' sortieren'}
                  aria-current={active ? 'true' : undefined}
                  mix={[table.filterTab, active ? table.filterTabActive : undefined]}
                >
                  {option.label}
                  <span aria-hidden="true">
                    {sortArrow(option.field, sortColumn, sortDirection)}
                  </span>
                </a>
              )
            })}
          </span>
          <span mix={table.spacer} />
          <a
            href={buildPaginationUrl(
              ADMIN_BASE,
              offset,
              sortColumn,
              sortDirection,
              filter,
              undefined,
              activeItemFilter,
            )}
            data-rmx-target={getSelfFrameTarget()}
            mix={[buttonLink({ tone: 'secondary' }), smallBtnStyle]}
          >
            ↻ Aktualisieren
          </a>
          <a
            href={buildCreateUrl(
              ADMIN_BASE,
              offset,
              sortColumn,
              sortDirection,
              filter,
              undefined,
              activeItemFilter,
            )}
            data-rmx-target={getSelfFrameTarget()}
            mix={[buttonLink({ tone: 'primary' }), smallBtnStyle]}
          >
            <Glyph name="add" width={14} height={14} /> Neu anlegen
          </a>
        </form>
        {/* Debounced live search: typing re-runs the GET form instead of
            waiting for the Suchen button (which remains the no-JS path). */}
        <FilterAutoSubmit formSelector="form[data-lists-filter]" />

        <div
          mix={[table.wrap, listsCardsStyle, dataGridWrap, listsGridWrapStyle]}
          data-grid-scroll="true"
          data-lists-table="true"
        >
          {lists.length === 0 ? (
            <div mix={emptyStateStyle}>
              <span>{emptyMessage}</span>
              <div mix={emptyActionsStyle}>
                {stalePage ? (
                  <a
                    href={
                      ADMIN_BASE +
                      '?' +
                      buildFilterParams(
                        filter ?? '',
                        sortColumn,
                        sortDirection,
                        0,
                        undefined,
                        activeItemFilter,
                      )
                    }
                    data-rmx-target={getSelfFrameTarget()}
                    mix={[table.linkPlain, buttonLink({ tone: 'secondary' })]}
                  >
                    Zur ersten Seite
                  </a>
                ) : null}
                {hasFilters ? (
                  <a
                    href={resetFilterHref}
                    data-rmx-target={getSelfFrameTarget()}
                    mix={[table.linkPlain, buttonLink({ tone: 'secondary' })]}
                  >
                    Filter zurücksetzen
                  </a>
                ) : null}
                {!hasFormPanel ? (
                  <a
                    href={buildCreateUrl(
                      ADMIN_BASE,
                      offset,
                      sortColumn,
                      sortDirection,
                      filter,
                      undefined,
                      activeItemFilter,
                    )}
                    data-rmx-target={getSelfFrameTarget()}
                    mix={[table.linkPlain, buttonLink({ tone: 'primary' })]}
                  >
                    <Glyph name="add" width={14} height={14} /> Neu anlegen
                  </a>
                ) : null}
              </div>
            </div>
          ) : (
            <table mix={[table.table, hasFormPanel ? listsTableCompactStyle : listsTableFullStyle]}>
              <caption mix={srOnlyStyle}>Gespeicherte Listen</caption>
              <colgroup>
                {!hasFormPanel ? <col mix={css({ width: '48px' })} /> : null}
                <col />
                <col mix={colOwnerWidth} />
                <col mix={colItemsWidth} />
                {!hasFormPanel ? <col mix={colPreviewWidth} /> : null}
                {!hasFormPanel ? <col mix={colUpdatedWidth} /> : null}
                <col mix={table.floatingActionsCol} />
              </colgroup>
              <thead>
                <tr>
                  {!hasFormPanel ? (
                    <th
                      scope="col"
                      mix={table.thSortable}
                      aria-sort={sortRule('id', sortColumn, sortDirection)}
                    >
                      <a
                        href={buildSortUrl(
                          ADMIN_BASE,
                          'id',
                          sortColumn,
                          sortDirection,
                          offset,
                          filter,
                          undefined,
                          activeItemFilter,
                        )}
                        data-rmx-target={getSelfFrameTarget()}
                        mix={table.sortLink}
                        title="Nach ID sortieren"
                      >
                        ID
                        <span
                          aria-hidden="true"
                          mix={'id' === sortColumn ? table.sortArrowActive : table.sortArrow}
                        >
                          {sortArrow('id', sortColumn, sortDirection)}
                        </span>
                      </a>
                    </th>
                  ) : null}
                  <th
                    scope="col"
                    mix={table.thSortable}
                    aria-sort={sortRule('title', sortColumn, sortDirection)}
                  >
                    <a
                      href={buildSortUrl(
                        ADMIN_BASE,
                        'title',
                        sortColumn,
                        sortDirection,
                        offset,
                        filter,
                        undefined,
                        activeItemFilter,
                      )}
                      data-rmx-target={getSelfFrameTarget()}
                      mix={table.sortLink}
                      title="Nach Titel sortieren"
                    >
                      Titel
                      <span
                        aria-hidden="true"
                        mix={'title' === sortColumn ? table.sortArrowActive : table.sortArrow}
                      >
                        {sortArrow('title', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th
                    scope="col"
                    mix={table.thSortable}
                    aria-sort={sortRule('owner', sortColumn, sortDirection)}
                  >
                    <a
                      href={buildSortUrl(
                        ADMIN_BASE,
                        'owner',
                        sortColumn,
                        sortDirection,
                        offset,
                        filter,
                        undefined,
                        activeItemFilter,
                      )}
                      data-rmx-target={getSelfFrameTarget()}
                      mix={table.sortLink}
                      title="Nach Besitzer sortieren"
                    >
                      Besitzer
                      <span
                        aria-hidden="true"
                        mix={'owner' === sortColumn ? table.sortArrowActive : table.sortArrow}
                      >
                        {sortArrow('owner', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th
                    scope="col"
                    mix={table.thSortable}
                    aria-sort={sortRule('items', sortColumn, sortDirection)}
                  >
                    <a
                      href={buildSortUrl(
                        ADMIN_BASE,
                        'items',
                        sortColumn,
                        sortDirection,
                        offset,
                        filter,
                        undefined,
                        activeItemFilter,
                      )}
                      data-rmx-target={getSelfFrameTarget()}
                      mix={table.sortLink}
                      title="Nach Elementanzahl sortieren"
                    >
                      Elemente
                      <span
                        aria-hidden="true"
                        mix={'items' === sortColumn ? table.sortArrowActive : table.sortArrow}
                      >
                        {sortArrow('items', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  {!hasFormPanel ? (
                    <th scope="col" mix={table.th}>
                      Vorschau
                    </th>
                  ) : null}
                  {!hasFormPanel ? (
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
                          undefined,
                          activeItemFilter,
                        )}
                        data-rmx-target={getSelfFrameTarget()}
                        mix={table.sortLink}
                        title="Nach Aktualisierung sortieren"
                      >
                        Aktualisiert
                        <span
                          aria-hidden="true"
                          mix={
                            'updated_at' === sortColumn ? table.sortArrowActive : table.sortArrow
                          }
                        >
                          {sortArrow('updated_at', sortColumn, sortDirection)}
                        </span>
                      </a>
                    </th>
                  ) : null}
                  {/* Actions live in a hover gutter, not a visible column.
                      Keep an accessible header for the column without painting
                      an "Aktionen" label above it. */}
                  <th
                    scope="col"
                    aria-label="Aktionen"
                    mix={[table.th, table.floatingActionsHeader]}
                  ></th>
                </tr>
              </thead>
              <tbody>
                {lists.map((row) => {
                  let items = Array.isArray(row.list) ? row.list : []
                  let doneCount = items.filter((item) => item.done).length
                  let displayTitle = listDisplayTitle(row.title)
                  let updatedLabel = formatTimestamp(row.updated_at)
                  let itemBadgeLabel =
                    items.length === 0
                      ? 'Keine Elemente'
                      : doneCount > 0
                        ? doneCount +
                          ' von ' +
                          items.length +
                          (items.length === 1 ? ' Element erledigt' : ' Elementen erledigt')
                        : items.length === 1
                          ? '1 Element'
                          : items.length + ' Elemente'
                  let editHref = buildEditUrl(
                    ADMIN_BASE,
                    row.id,
                    offset,
                    sortColumn,
                    sortDirection,
                    filter,
                    undefined,
                    activeItemFilter,
                  )
                  return (
                    <tr
                      key={row.id}
                      mix={[
                        table.row,
                        editRow?.id === row.id ? table.editingRow : undefined,
                        table.floatingRowReveal,
                        table.floatingTrailingFade,
                      ]}
                      data-row-id={row.id}
                    >
                      {!hasFormPanel ? (
                        <td mix={table.td} data-label="ID" title={String(row.id)}>
                          {row.id}
                        </td>
                      ) : null}
                      <td mix={table.td} data-label="Titel">
                        <div mix={titleCellStyle}>
                          <a
                            href={editHref}
                            data-rmx-target={getSelfFrameTarget()}
                            mix={[titleTextStyle, row.title.trim() ? undefined : noTitleStyle]}
                            title={displayTitle + ' bearbeiten'}
                          >
                            {displayTitle}
                          </a>
                          {row.description ? (
                            <a
                              href={'/lists?load=' + row.id}
                              target="_top"
                              data-rmx-document
                              mix={descLinkStyle}
                              title={row.description}
                            >
                              {row.description}
                            </a>
                          ) : (
                            <span mix={descEmptyStyle}>(keine Beschreibung)</span>
                          )}
                        </div>
                      </td>
                      <td mix={table.td} data-label="Besitzer" title={row.owner_email ?? undefined}>
                        {row.owner_email ? (
                          <a
                            // Not buildFilterParams: that helper also carries the
                            // lists grid's sort/order state, which the users grid
                            // must not inherit.
                            //
                            // Document navigation, not data-rmx-target: the users
                            // grid's filter input is uncontrolled, and an in-frame
                            // reload reuses the input node, keeping the previous
                            // page's text. A full load mounts it fresh, so the
                            // visible filter matches the applied one and "Suchen"
                            // preserves the owner filter.
                            href={
                              routes.admin.users.index.href() +
                              '?' +
                              new URLSearchParams({ filter: row.owner_email }).toString()
                            }
                            target="_top"
                            data-rmx-document
                            mix={ownerLinkStyle}
                          >
                            {row.owner_email}
                          </a>
                        ) : (
                          <span mix={descEmptyStyle}>Kein Besitzer</span>
                        )}
                      </td>
                      <td
                        mix={table.td}
                        data-label="Elemente"
                        {...(hasFormPanel ? { 'data-floating-trailing': '' } : {})}
                      >
                        <span
                          mix={
                            doneCount > 0
                              ? [itemCountBadgeStyle, itemCountBadgeDoneStyle]
                              : itemCountBadgeStyle
                          }
                          title={itemBadgeLabel}
                          aria-label={itemBadgeLabel}
                        >
                          {doneCount > 0 ? doneCount + '/' + items.length : String(items.length)}
                        </span>
                      </td>
                      {!hasFormPanel ? (
                        <td mix={table.td} data-label="Vorschau">
                          <div mix={previewCellStyle}>
                            {items.length === 0 ? (
                              <span mix={descEmptyStyle}>–</span>
                            ) : (
                              <div mix={previewListStyle}>
                                {items.slice(0, 3).map((item) => (
                                  <span
                                    key={item.id || item.label}
                                    mix={
                                      item.done
                                        ? [previewChipStyle, previewChipDoneStyle]
                                        : previewChipStyle
                                    }
                                    title={item.label}
                                  >
                                    {item.done ? '✓ ' : ''}
                                    {item.label}
                                  </span>
                                ))}
                                {items.length > 3 ? (
                                  <span mix={previewMoreStyle}>+{items.length - 3} weitere</span>
                                ) : null}
                              </div>
                            )}
                            {items.length > 0 && (
                              <details data-lists-items>
                                <summary mix={summaryStyle}>
                                  {items.length === 1
                                    ? 'Element anzeigen'
                                    : 'Alle ' + items.length + ' Elemente'}
                                </summary>
                                <div mix={detailsStyle} data-lists-items-panel>
                                  {items.map((item, idx) => (
                                    <div key={item.id || String(idx)} mix={detailsItemStyle}>
                                      <span mix={detailsIndexStyle}>{idx + 1}.</span>
                                      <span
                                        mix={[
                                          detailsLabelStyle,
                                          item.done ? previewChipDoneStyle : undefined,
                                        ]}
                                        title={item.label}
                                        data-list-item-label
                                      >
                                        {item.label}
                                      </span>
                                      {item.done ? (
                                        // success.background is the pale tile fill
                                        // (#f0fdf4); success.foreground is the token
                                        // intended for text (see admin-page.tsx).
                                        <span mix={detailsCheckStyle} title="Erledigt">
                                          ✓
                                        </span>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}
                          </div>
                        </td>
                      ) : null}
                      {!hasFormPanel ? (
                        <td
                          mix={table.td}
                          data-label="Aktualisiert"
                          title={updatedLabel}
                          data-floating-trailing
                        >
                          <span mix={dateStackStyle}>
                            <span mix={dateMainStyle}>{formatCompactDateDE(row.updated_at)}</span>
                            <span mix={dateTimeStyle}>{formatClockTime(row.updated_at)}</span>
                          </span>
                        </td>
                      ) : null}
                      <td mix={[table.actionCell, table.floatingActionCell]} data-label="Aktionen">
                        <div
                          mix={[table.actionGroup, table.floatingActions]}
                          data-row-actions
                          role="group"
                          aria-label="Zeilenaktionen"
                        >
                          <a
                            href={'/lists?load=' + row.id}
                            target="_top"
                            data-rmx-document
                            aria-label={'„' + displayTitle + '“ in Listen öffnen'}
                            title="In Listen öffnen"
                            mix={table.actionSeg}
                          >
                            <Glyph name="open" width={14} height={14} />
                          </a>
                          <a
                            href={editHref}
                            data-rmx-target={getSelfFrameTarget()}
                            aria-label={'„' + displayTitle + '“ bearbeiten'}
                            title="Bearbeiten"
                            mix={table.actionSeg}
                          >
                            <Glyph name="edit" width={14} height={14} />
                          </a>
                          <RestfulForm
                            method="DELETE"
                            action={routes.admin.lists.destroy.href({ id: row.id })}
                            data-delete-form={row.id}
                            data-confirm={
                              'Liste „' +
                              displayTitle +
                              '“ (' +
                              itemCountLabel(items.length) +
                              ') löschen?'
                            }
                            data-rmx-target={getSelfFrameTarget()}
                            mix={css({ margin: 0, padding: 0, display: 'inline-flex' })}
                          >
                            <GridStateHiddenInputs
                              state={{
                                offset: String(offset),
                                sort: sortColumn,
                                order: sortDirection,
                                filter: filter ?? '',
                                status: activeItemFilter ?? '',
                              }}
                            />
                            <button
                              type="submit"
                              aria-label={'„' + displayTitle + '“ löschen'}
                              title="Löschen"
                              mix={[table.actionSeg, table.actionSegDanger]}
                            >
                              <Glyph name="trash" width={14} height={14} />
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
        </div>

        {(total > 0 || stalePage) && (
          <div mix={[table.pagination, paginationBarStyle]}>
            {/* data-pagination-info is mirrored into the document shell's live
                region (GridStatusAnnouncer), so a frame navigation announces
                the new range/page to screen readers. */}
            <span mix={table.paginationInfo} data-pagination-info>
              {pageInfo}
            </span>
            <div mix={paginationControlsStyle}>
              <nav mix={pageNavStyle} aria-label="Seitennavigation">
                {offset > 0 ? (
                  <a
                    href={buildPaginationUrl(
                      ADMIN_BASE,
                      stalePage ? Math.max(0, (totalPages - 1) * pageSize) : prevOffset,
                      sortColumn,
                      sortDirection,
                      filter,
                      undefined,
                      activeItemFilter,
                    )}
                    data-rmx-target={getSelfFrameTarget()}
                    data-rmx-prefetch="intent"
                    aria-label="Vorherige Seite"
                    mix={table.pageLink}
                  >
                    <Glyph name="chevronRight" width={14} height={14} mix={rotatedGlyphCss} />{' '}
                    Zurück
                  </a>
                ) : null}
                {totalPages > 1 && !stalePage ? (
                  <span mix={pageNumbersStyle}>
                    {paginationWindow(currentPage, totalPages).map((entry, index) =>
                      entry === 'gap' ? (
                        <span key={'gap-' + index} aria-hidden="true" mix={pageGapStyle}>
                          …
                        </span>
                      ) : entry === currentPage ? (
                        <span key={'page-' + entry} aria-current="page" mix={pageCurrentStyle}>
                          {entry}
                        </span>
                      ) : (
                        <a
                          key={'page-' + entry}
                          href={buildPaginationUrl(
                            ADMIN_BASE,
                            (entry - 1) * pageSize,
                            sortColumn,
                            sortDirection,
                            filter,
                            undefined,
                            activeItemFilter,
                          )}
                          data-rmx-target={getSelfFrameTarget()}
                          data-rmx-prefetch="intent"
                          aria-label={'Seite ' + entry}
                          mix={[table.pageLink, pageNumberLinkStyle]}
                        >
                          {entry}
                        </a>
                      ),
                    )}
                  </span>
                ) : null}
                {hasMore ? (
                  <a
                    href={buildPaginationUrl(
                      ADMIN_BASE,
                      nextOffset,
                      sortColumn,
                      sortDirection,
                      filter,
                      undefined,
                      activeItemFilter,
                    )}
                    data-rmx-target={getSelfFrameTarget()}
                    data-rmx-prefetch="intent"
                    aria-label="Nächste Seite"
                    mix={table.pageLink}
                  >
                    Weiter <Glyph name="chevronRight" width={14} height={14} />
                  </a>
                ) : null}
              </nav>
              <PageSizeControl
                action={routes.admin.pageSize.href()}
                pageKey={pageKey}
                pageSize={pageSize}
                pageSizeOverride={pageSizeOverride}
                controlId="lists-page-size"
              />
            </div>
          </div>
        )}
      </div>
    )

    if (editRow || creating) {
      return (
        // The panel shares the row with the grid; a width cap would squeeze the
        // grid back into a horizontal scroller and hide the row actions.
        <div mix={[table.pageWide, dataGridFill]}>
          <h2 mix={table.title}>Gespeicherte Listen</h2>
          {formError ? <div mix={table.errorBanner}>{formError}</div> : null}
          <div mix={table.twoColumn}>
            {gridSection}
            <div mix={[table.stickyPanel, panelOrderStyle]}>
              {editRow ? (
                <AdminListsEditPanel
                  row={editRow}
                  offset={String(offset)}
                  sort={sortColumn}
                  order={sortDirection}
                  filter={filter}
                  status={activeItemFilter}
                  formValues={formValues}
                  fieldErrors={fieldErrors}
                />
              ) : (
                <AdminListsCreatePanel
                  offset={String(offset)}
                  sort={sortColumn}
                  order={sortDirection}
                  filter={filter}
                  status={activeItemFilter}
                  formValues={formValues}
                  fieldErrors={fieldErrors}
                />
              )}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div mix={[table.page, dataGridFill]}>
        <h2 mix={table.title}>Gespeicherte Listen</h2>
        <p mix={descriptionStyle}>
          Alle Listen einsehen und Titel/Beschreibung bearbeiten. Die Elemente selbst werden im
          Listen-Bereich gepflegt.
        </p>
        {gridSection}
      </div>
    )
  }
}

// Inline Edit Panel

interface EditPanelProps {
  row: ListRow
  offset?: string
  sort?: string
  order?: string
  filter?: string | undefined
  status?: string | undefined
  formValues?: Record<string, string> | undefined
  fieldErrors?: Record<string, string> | undefined
}

function AdminListsEditPanel(handle: Handle<EditPanelProps>) {
  return () => {
    let {
      row,
      offset = '',
      sort = '',
      order = '',
      filter = '',
      status = '',
      formValues,
      fieldErrors,
    } = handle.props
    let items = Array.isArray(row.list) ? row.list : []
    let doneCount = items.filter((item) => item.done).length
    let closeHref = buildCancelUrl(
      routes.admin.lists.index.href(),
      offset,
      sort,
      order,
      filter,
      undefined,
      status,
    )
    return (
      <div mix={panelEntrance}>
        <RestfulForm
          method="PUT"
          action={routes.admin.lists.update.href({ id: row.id })}
          data-rmx-target={getSelfFrameTarget()}
          novalidate
        >
          <GridStateHiddenInputs state={{ offset, sort, order, filter, status }} />
          <EditorAutofocus />
          <DirtyFormGuard />
          <FormErrorFocus />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={table.panelTitle}>Liste bearbeiten</span>
              <a
                href={closeHref}
                data-rmx-target={getSelfFrameTarget()}
                aria-label="Editor schließen"
                title="Schließen"
                mix={panelCloseStyle}
              >
                <Glyph name="close" width={14} height={14} />
              </a>
            </div>

            {/* The focused grid drops ID, Elemente, Besitzer and Aktualisiert
                while the panel is open, so repeat that context here. */}
            <div mix={panelMetaStyle}>
              <div mix={panelMetaItemStyle}>
                <span mix={panelMetaLabelStyle}>ID</span>
                <span mix={panelMetaValueStyle}>#{row.id}</span>
              </div>
              <div mix={panelMetaItemStyle}>
                <span mix={panelMetaLabelStyle}>Elemente</span>
                <span mix={panelMetaValueStyle}>
                  {items.length === 1 ? '1 Element' : items.length + ' Elemente'}
                </span>
                {doneCount > 0 ? <span mix={panelMetaExtraStyle}>{doneCount} erledigt</span> : null}
              </div>
              <div mix={panelMetaItemStyle}>
                <span mix={panelMetaLabelStyle}>Besitzer</span>
                <span mix={panelMetaValueStyle} title={row.owner_email ?? 'Kein Besitzer'}>
                  {row.owner_email ?? 'Kein Besitzer'}
                </span>
              </div>
              <div mix={panelMetaItemStyle}>
                <span mix={panelMetaLabelStyle}>Aktualisiert</span>
                <span mix={panelMetaValueStyle} title={formatTimestamp(row.updated_at)}>
                  {formatTimestamp(row.updated_at)}
                </span>
              </div>
            </div>

            <div mix={table.panelBody}>
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="al-title">
                  Titel
                </label>
                <input
                  id="al-title"
                  name="title"
                  type="text"
                  mix={[
                    input.base,
                    input.focus,
                    fieldErrors?.title ? inputErrorStyle : null,
                  ].filter(Boolean)}
                  value={formValues?.title ?? row.title ?? ''}
                  autofocus
                  data-editor-autofocus-field
                  aria-invalid={fieldErrors?.title ? 'true' : undefined}
                  aria-describedby={fieldErrors?.title ? 'al-title-error' : undefined}
                  required
                />
                {fieldErrors?.title ? (
                  <div id="al-title-error" mix={fieldErrorStyle}>
                    {fieldErrors.title}
                  </div>
                ) : null}
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="al-description">
                  Beschreibung
                </label>
                <input
                  id="al-description"
                  name="description"
                  type="text"
                  mix={[
                    input.base,
                    input.focus,
                    fieldErrors?.description ? inputErrorStyle : null,
                  ].filter(Boolean)}
                  value={formValues?.description ?? row.description ?? ''}
                  aria-invalid={fieldErrors?.description ? 'true' : undefined}
                  aria-describedby={fieldErrors?.description ? 'al-description-error' : undefined}
                />
                {fieldErrors?.description ? (
                  <div id="al-description-error" mix={fieldErrorStyle}>
                    {fieldErrors.description}
                  </div>
                ) : null}
              </div>

              <div mix={table.actions}>
                <PendingSubmitButton>Speichern</PendingSubmitButton>
                <a
                  href={closeHref}
                  data-rmx-target={getSelfFrameTarget()}
                  mix={[
                    table.spacer,
                    table.linkPlain,
                    buttonLink({ tone: 'secondary' }),
                    css({ justifyContent: 'center', textAlign: 'center' }),
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

// Inline Create Panel

interface CreatePanelProps {
  offset?: string
  sort?: string
  order?: string
  filter?: string | undefined
  status?: string | undefined
  formValues?: Record<string, string> | undefined
  fieldErrors?: Record<string, string> | undefined
}

function AdminListsCreatePanel(handle: Handle<CreatePanelProps>) {
  return () => {
    let {
      offset = '',
      sort = '',
      order = '',
      filter = '',
      status = '',
      formValues,
      fieldErrors,
    } = handle.props
    let closeHref = buildCancelUrl(
      routes.admin.lists.index.href(),
      offset,
      sort,
      order,
      filter,
      undefined,
      status,
    )
    return (
      <div mix={panelEntrance}>
        <RestfulForm
          method="POST"
          action={routes.admin.lists.create.href()}
          data-rmx-target={getSelfFrameTarget()}
          novalidate
        >
          <GridStateHiddenInputs state={{ offset, sort, order, filter, status }} />
          <EditorAutofocus />
          <DirtyFormGuard />
          <FormErrorFocus />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={table.panelTitle}>Neue Liste</span>
              <a
                href={closeHref}
                data-rmx-target={getSelfFrameTarget()}
                aria-label="Editor schließen"
                title="Schließen"
                mix={panelCloseStyle}
              >
                <Glyph name="close" width={14} height={14} />
              </a>
            </div>

            <div mix={table.panelBody}>
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="al-title-c">
                  Titel
                </label>
                <input
                  id="al-title-c"
                  name="title"
                  type="text"
                  mix={[
                    input.base,
                    input.focus,
                    fieldErrors?.title ? inputErrorStyle : null,
                  ].filter(Boolean)}
                  value={formValues?.title ?? ''}
                  autofocus
                  data-editor-autofocus-field
                  aria-invalid={fieldErrors?.title ? 'true' : undefined}
                  aria-describedby={fieldErrors?.title ? 'al-title-c-error' : undefined}
                  required
                />
                {fieldErrors?.title ? (
                  <div id="al-title-c-error" mix={fieldErrorStyle}>
                    {fieldErrors.title}
                  </div>
                ) : null}
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="al-description-c">
                  Beschreibung
                </label>
                <input
                  id="al-description-c"
                  name="description"
                  type="text"
                  mix={[
                    input.base,
                    input.focus,
                    fieldErrors?.description ? inputErrorStyle : null,
                  ].filter(Boolean)}
                  value={formValues?.description ?? ''}
                  aria-invalid={fieldErrors?.description ? 'true' : undefined}
                  aria-describedby={fieldErrors?.description ? 'al-description-c-error' : undefined}
                />
                {fieldErrors?.description ? (
                  <div id="al-description-c-error" mix={fieldErrorStyle}>
                    {fieldErrors.description}
                  </div>
                ) : null}
              </div>

              <p mix={fieldHintStyle}>Neue Listen werden ohne Besitzer angelegt.</p>

              <div mix={table.actions}>
                <PendingSubmitButton>Anlegen</PendingSubmitButton>
                <a
                  href={closeHref}
                  data-rmx-target={getSelfFrameTarget()}
                  mix={[
                    table.spacer,
                    table.linkPlain,
                    buttonLink({ tone: 'secondary' }),
                    css({ justifyContent: 'center', textAlign: 'center' }),
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
