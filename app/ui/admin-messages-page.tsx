import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { theme } from '../ui/theme/theme.ts'
import { Glyph } from '../ui/theme/glyph/glyph.tsx'
import { rotatedGlyphCss } from './mixins/icon.ts'
import { table } from './mixins/admin-table.ts'
import { buttonLink } from '../ui/theme/button.ts'
import { formatTimestamp, sortArrow, sortRule } from './mixins/admin-urls.ts'
import { formatCompactDateDE } from '../utils/date-utils.ts'
import { messagesGridHref } from '../utils/messages-grid-url.ts'
import { paginationWindow } from '../utils/pagination-window.ts'

import { routes } from '../routes.ts'
import { getSelfFrameTarget } from '../utils/frame-target.ts'
import { CsrfTokenInput } from './csrf-token-input.tsx'
import { ConnectionIndicator } from '../ui/connection-indicator.browser.tsx'
import { RestfulForm } from './restful-form.tsx'
import { GridStateHiddenInputs } from './grid-state-hidden.tsx'
import { ConfirmDelete } from './confirm-delete.browser.tsx'
import { MessageExpand } from './message-expand.browser.tsx'
import { MessageCompose } from './message-compose.browser.tsx'
import { FilterAutoSubmit } from './filter-autosubmit.browser.tsx'
import { PageSizeControl } from './page-size-control.tsx'
import { PendingSubmitButton } from './pending-submit.browser.tsx'
import { dataGridFill, dataGridWrap } from './mixins/data-grid.ts'
import type { PageSizeKey } from '../utils/get-page-size.ts'

const SORT_OPTIONS = [
  { field: 'sender_name', label: 'Absender' },
  { field: 'content', label: 'Nachricht' },
  { field: 'created_at', label: 'Erstellt' },
] as const

/** Toggle a column's sort direction; a new column starts ascending. */
function sortHref(
  field: string,
  sortColumn: string,
  sortDirection: 'asc' | 'desc',
  filter?: string | undefined,
): string {
  let nextDirection: 'asc' | 'desc' =
    field === sortColumn ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc'
  return messagesGridHref(0, field, nextDirection, filter)
}

interface MessageRow {
  id: number
  /** Null when the sender account was deleted (FK is ON DELETE SET NULL). */
  sender_id: number | null
  sender_name: string | null
  content: string
  created_at: number
}

/** Shown in place of the sender name for a message whose account was deleted. */
const DELETED_SENDER_LABEL = 'Gelöschter Nutzer'

interface AdminMessagesPageProps {
  messages: MessageRow[]
  offset: number
  hasMore: boolean
  /** Total rows matching the active filter (not just the current page). */
  total: number
  pageSize: number
  pageKey: PageSizeKey
  pageSizeOverride: number | null
  filter?: string | undefined
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  formValues?: Record<string, string> | undefined
  fieldErrors?: Record<string, string> | undefined
  formError?: string | undefined
}

// ── Helpers ──

function senderInitials(name: string | null): string {
  if (!name) return '\u2013'
  let parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase()
  }
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return '?'
}

/** Time-only companion to {@link formatCompactDateDE} for the date stack. */
function formatClockTime(ts: number): string {
  return new Date(Number(ts)).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Styles ──

const headerRowStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: theme.space.sm,
  marginBottom: theme.space.md,
})

const descriptionStyle = css({
  margin: `0 0 ${theme.space.md}`,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
})

/** Screen-reader-only table caption / helper text. */
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

/**
 * Message preview — clamped to two lines so every row keeps a compact,
 * consistent height at any page size (e.g. 15). The full text stays in the DOM
 * (hover tooltip + click-to-expand via MessageExpand), the clamp is purely
 * visual.
 */
const contentCellStyle = css({
  display: '-webkit-box',
  // Numeric vendor-prefixed values serialize unitless since remix #12121;
  // before that this rendered the invalid `-webkit-line-clamp: 2px`, the
  // browser dropped it, and long messages grew unbounded.
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  color: theme.colors.text.primary,
})

/** The content cell must not clip the expanded text (table.td sets overflow
 *  hidden + nowrap), so the wrapper lets the row grow and wraps naturally. */
const contentTdStyle = css({
  overflow: 'visible',
  whiteSpace: 'normal',
  // The shared card layout puts the label and value side by side. A message is
  // the card's main content, so give it the full width under its label instead
  // of squeezing it into the right-hand column.
  '@media (max-width: 768px)': {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
})

/**
 * Card-mode `td` is a flex row (label ::before + content). The message cell has
 * two children (clamped text + "Mehr" toggle), so group them: otherwise the
 * mobile card lays the label, text and toggle out side by side.
 */
const contentCellWrapStyle = css({
  flex: '1 1 auto',
  minWidth: 0,
})

const expandBtnStyle = css({
  display: 'none',
  padding: 0,
  margin: `${theme.space.xs} 0 0`,
  border: 'none',
  background: 'none',
  color: theme.colors.action.primary.background,
  fontSize: theme.fontSize.xs,
  cursor: 'pointer',
  textDecoration: 'underline',
  textDecorationColor: theme.colors.border.default,
  '&:hover': { textDecorationColor: theme.colors.action.primary.background },
})

const senderCellStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  minWidth: 0,
})

const avatarStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  flexShrink: 0,
  borderRadius: theme.radius.full,
  background: theme.surface.lvl3,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.xxs,
  fontWeight: theme.fontWeight.semibold,
  letterSpacing: '0.02em',
})

const avatarDeletedStyle = css({
  background: theme.surface.lvl2,
  color: theme.colors.text.muted,
})

const senderNameStyle = css({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: theme.colors.text.primary,
})

const deletedSenderStyle = css({
  color: theme.colors.text.muted,
  fontStyle: 'italic',
})

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

/** Right-aligned action row inside the compose panel. */
const composeFooterStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: theme.space.sm,
  marginTop: theme.space.md,
  paddingTop: theme.space.md,
  borderTop: '1px solid ' + theme.colors.border.default,
  // Phones: a right-aligned button after a full-width hint reads as an orphan.
  // Stack the hint over a full-width send button instead. The width override
  // beats the vendor button's `width: max-content` (same layer caveat as the
  // other !important overrides in this file).
  '@media (max-width: 480px)': {
    flexDirection: 'column',
    alignItems: 'stretch',
    '& > button': { width: '100% !important' },
  },
})

const composeHintStyle = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
})

/** Toolbar row holding the GET filter form and its live-search entry. */
const toolbarRowStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  flexWrap: 'wrap',
  marginBottom: theme.space.lg,
})

const filterFormStyle = css({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  flexWrap: 'wrap',
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
  '@media (max-width: 768px)': { display: 'flex' },
})

const mobileSortLabelStyle = css({
  fontSize: theme.fontSize.xxs,
  fontWeight: theme.fontWeight.semibold,
  letterSpacing: theme.letterSpacing.meta,
  textTransform: 'uppercase',
  color: theme.colors.text.muted,
})

const colActionsWidth = css({ width: '80px' })
const colSenderWidth = css({ width: '170px' })
const colDateWidth = css({ width: '150px' })
const dateCellStyle = css({ whiteSpace: 'nowrap' })
const composeFormStyle = css({ marginBottom: theme.space.sm })
const deleteFormStyle = css({ margin: 0, padding: 0 })

/**
 * Phones: let the page grow with its rows instead of clipping them into the
 * bounded desktop scroller. The card layout already removes the horizontal
 * overflow, so the remaining job is to stop the inner box from becoming a
 * short second scroll region.
 */
const messagesGridWrapStyle = css({
  '@media (max-width: 768px)': {
    flex: '0 0 auto',
    overflowY: 'visible',
  },
})

const emptyStateStyle = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '1 1 auto',
  minHeight: 0,
  gap: theme.space.sm,
  padding: theme.space.xxl,
  color: theme.colors.text.muted,
  textAlign: 'center',
})

const emptyGlyphStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '40px',
  height: '40px',
  borderRadius: theme.radius.full,
  background: theme.surface.lvl2,
  color: theme.colors.text.muted,
})

const emptyTextStyle = css({
  margin: 0,
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.muted,
})

/** Footer lets the info and controls stack on narrow viewports instead of
 *  wrapping mid-control. */
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
  gap: theme.space.sm,
  flexWrap: 'wrap',
  '@media (max-width: 900px)': { justifyContent: 'space-between' },
})

const pageNavStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: theme.space.xs,
})

const pageNumbersStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '2px',
})

const pageNumberLinkStyle = css({
  justifyContent: 'center',
  minWidth: '28px',
})

const pageCurrentStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '28px',
  padding: theme.space.xs + ' ' + theme.space.sm,
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  borderRadius: theme.radius.md,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
})

const pageGapStyle = css({
  padding: '0 2px',
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
})

const pageSizeSlotStyle = css({
  marginLeft: 'auto',
  '@media (max-width: 720px)': {
    marginLeft: 0,
    width: '100%',
    '& form > button': { flex: '1 1 auto' },
  },
})

// ── Row ──

interface MessageRowItemProps {
  message: MessageRow
  offset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter?: string | undefined
}

function MessageRowItem(handle: Handle<MessageRowItemProps>) {
  return () => {
    let { message: msg, offset, sortColumn, sortDirection, filter } = handle.props
    let senderLabel = msg.sender_name ?? DELETED_SENDER_LABEL
    let preview = msg.content.length > 60 ? `${msg.content.slice(0, 60)}\u2026` : msg.content
    return (
      <tr mix={table.row}>
        <td mix={table.td} data-label="Absender" title={senderLabel}>
          <div mix={senderCellStyle}>
            <span
              mix={[avatarStyle, msg.sender_name ? undefined : avatarDeletedStyle]}
              aria-hidden="true"
            >
              {senderInitials(msg.sender_name)}
            </span>
            <span mix={[senderNameStyle, msg.sender_name ? undefined : deletedSenderStyle]}>
              {senderLabel}
            </span>
          </div>
        </td>
        <td
          mix={[table.td, contentTdStyle]}
          data-label="Nachricht"
          title={msg.content}
          data-message-cell={msg.id}
        >
          <div mix={contentCellWrapStyle}>
            <span mix={contentCellStyle} data-message-text id={`message-${msg.id}`}>
              {msg.content}
            </span>
            <button
              type="button"
              mix={expandBtnStyle}
              data-expand-msg={msg.id}
              data-label-more="Mehr"
              data-label-less="Weniger"
              aria-expanded="false"
              aria-controls={`message-${msg.id}`}
            >
              Mehr
            </button>
          </div>
        </td>
        <td
          mix={[table.td, dateCellStyle]}
          data-label="Erstellt"
          title={formatTimestamp(msg.created_at)}
        >
          <span mix={dateStackStyle}>
            <span mix={dateMainStyle}>{formatCompactDateDE(msg.created_at)}</span>
            <span mix={dateTimeStyle}>{formatClockTime(msg.created_at)}</span>
          </span>
        </td>
        <td mix={table.actionCell} data-label="Aktionen">
          <div mix={rowActionsStyle}>
            <RestfulForm
              method="POST"
              action={routes.admin.messages.destroy.href({ id: msg.id })}
              data-delete-form={msg.id}
              data-confirm={`Nachricht „${preview}“ von ${senderLabel} löschen?`}
              data-rmx-target={getSelfFrameTarget()}
              mix={deleteFormStyle}
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
                mix={[iconActionStyle, iconActionDangerStyle]}
                aria-label={`Nachricht von ${senderLabel} löschen: „${preview}“`}
                title="Löschen"
              >
                <Glyph name="trash" width={14} height={14} />
              </button>
            </RestfulForm>
          </div>
        </td>
      </tr>
    )
  }
}

// ── Pagination ──

interface MessagesPaginationProps {
  offset: number
  hasMore: boolean
  totalPages: number
  currentPage: number
  stalePage: boolean
  pageSize: number
  pageInfo: string
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter?: string | undefined
  pageKey: PageSizeKey
  pageSizeOverride: number | null
}

function MessagesPagination(handle: Handle<MessagesPaginationProps>) {
  return () => {
    let {
      offset,
      hasMore,
      totalPages,
      currentPage,
      stalePage,
      pageSize,
      pageInfo,
      sortColumn,
      sortDirection,
      filter,
      pageKey,
      pageSizeOverride,
    } = handle.props
    let pageHref = (newOffset: number): string =>
      messagesGridHref(newOffset, sortColumn, sortDirection, filter)
    // A delete (or a concurrent one) can leave the URL past the result set.
    // "Zurück" must land on the last page that actually has rows instead of
    // walking backwards from the nonexistent offset.
    let previousOffset = stalePage
      ? Math.max(0, (totalPages - 1) * pageSize)
      : Math.max(0, offset - pageSize)

    return (
      <div mix={[table.pagination, paginationBarStyle]}>
        <span mix={table.paginationInfo} data-pagination-info>
          {pageInfo}
        </span>
        <div mix={paginationControlsStyle}>
          <nav mix={pageNavStyle} aria-label="Seitennavigation">
            {offset > 0 ? (
              <a
                href={pageHref(previousOffset)}
                data-rmx-target={getSelfFrameTarget()}
                mix={table.pageLink}
                aria-label="Vorherige Seite"
              >
                <Glyph name="chevronRight" width={14} height={14} mix={rotatedGlyphCss} /> Zurück
              </a>
            ) : null}
            {totalPages > 1 && !stalePage ? (
              <span mix={pageNumbersStyle}>
                {paginationWindow(currentPage, totalPages).map((entry, index) =>
                  entry === 'gap' ? (
                    <span key={`gap-${index}`} aria-hidden="true" mix={pageGapStyle}>
                      …
                    </span>
                  ) : entry === currentPage ? (
                    <span key={`page-${entry}`} aria-current="page" mix={pageCurrentStyle}>
                      {entry}
                    </span>
                  ) : (
                    <a
                      key={`page-${entry}`}
                      href={pageHref((entry - 1) * pageSize)}
                      data-rmx-target={getSelfFrameTarget()}
                      aria-label={`Seite ${entry}`}
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
                href={pageHref(offset + pageSize)}
                data-rmx-target={getSelfFrameTarget()}
                mix={table.pageLink}
                aria-label="Nächste Seite"
              >
                Weiter <Glyph name="chevronRight" width={14} height={14} />
              </a>
            ) : null}
          </nav>
          <div mix={pageSizeSlotStyle}>
            <PageSizeControl
              action={routes.admin.pageSize.href()}
              pageKey={pageKey}
              pageSize={pageSize}
              pageSizeOverride={pageSizeOverride}
              controlId="messages-page-size"
            />
          </div>
        </div>
      </div>
    )
  }
}

// ── Toolbar ──

interface MessagesToolbarProps {
  filter?: string | undefined
  sortColumn: string
  sortDirection: 'asc' | 'desc'
}

function MessagesToolbar(handle: Handle<MessagesToolbarProps>) {
  return () => {
    let { filter, sortColumn, sortDirection } = handle.props
    let searchValue = filter ?? ''

    return (
      <div mix={toolbarRowStyle}>
        {/* `data-rmx-reset-focus="manual"` keeps the frame runtime from moving
            focus to the document after a live-search reload, so the caret can
            go back into the freshly rendered search field. */}
        <form
          method="GET"
          action={routes.admin.messages.index.href()}
          role="search"
          aria-label="Nachrichten durchsuchen"
          data-rmx-target={getSelfFrameTarget()}
          data-rmx-history="replace"
          data-rmx-reset-focus="manual"
          data-messages-filter
          mix={filterFormStyle}
        >
          <input
            type="search"
            name="filter"
            placeholder="Nach Inhalt oder Absender suchen…"
            defaultValue={searchValue}
            aria-label="Nach Inhalt oder Absender suchen"
            autoComplete="off"
            enterKeyHint="search"
            mix={table.filterInput}
          />
          {/* Preserve a non-default sort while searching; omit the defaults so
              a plain search stays `/admin/messages?filter=…`. */}
          {sortColumn !== 'created_at' ? (
            <input type="hidden" name="sort" value={sortColumn} />
          ) : null}
          {sortDirection !== 'desc' ? (
            <input type="hidden" name="order" value={sortDirection} />
          ) : null}
          <button type="submit" mix={table.searchBtn}>
            <Glyph name="search" width={14} height={14} /> Suchen
          </button>
          {searchValue ? (
            <a
              href={messagesGridHref(0, sortColumn, sortDirection)}
              data-rmx-target={getSelfFrameTarget()}
              mix={table.clearLink}
            >
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
                  href={sortHref(option.field, sortColumn, sortDirection, filter)}
                  data-rmx-target={getSelfFrameTarget()}
                  aria-label={`Nach ${option.label} sortieren`}
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
        </form>
        {/* Debounced live search: typing re-runs the filter instead of waiting
            for the "Suchen" button (which remains the no-JS path). */}
        <FilterAutoSubmit formSelector="form[data-messages-filter]" />
      </div>
    )
  }
}

// ── Grid ──

interface MessagesGridProps {
  messages: MessageRow[]
  offset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter?: string | undefined
  emptyMessage: string
  emptyHref?: string | undefined
  emptyActionLabel: string
}

function MessagesGrid(handle: Handle<MessagesGridProps>) {
  return () => {
    let {
      messages,
      offset,
      sortColumn,
      sortDirection,
      filter,
      emptyMessage,
      emptyHref,
      emptyActionLabel,
    } = handle.props

    return (
      <div
        mix={[table.wrap, dataGridWrap, table.mobileCards, messagesGridWrapStyle]}
        data-grid-scroll="true"
        data-messages-table="true"
      >
        {messages.length === 0 ? (
          <div mix={emptyStateStyle}>
            <span mix={emptyGlyphStyle} aria-hidden="true">
              <Glyph name="chat" width={18} height={18} />
            </span>
            <p mix={emptyTextStyle}>{emptyMessage}</p>
            {emptyHref ? (
              <a
                href={emptyHref}
                data-rmx-target={getSelfFrameTarget()}
                mix={[table.linkPlain, buttonLink({ tone: 'secondary' })]}
              >
                {emptyActionLabel}
              </a>
            ) : null}
          </div>
        ) : (
          <table mix={table.table}>
            <caption mix={srOnlyStyle}>Nachrichten</caption>
            <colgroup>
              <col mix={colSenderWidth} />
              <col />
              <col mix={colDateWidth} />
              <col mix={colActionsWidth} />
            </colgroup>
            <thead>
              <tr>
                <th
                  scope="col"
                  mix={table.thSortable}
                  aria-sort={sortRule('sender_name', sortColumn, sortDirection)}
                >
                  <a
                    href={sortHref('sender_name', sortColumn, sortDirection, filter)}
                    data-rmx-target={getSelfFrameTarget()}
                    mix={table.sortLink}
                    title="Nach Absender sortieren"
                  >
                    Absender
                    <span
                      aria-hidden="true"
                      mix={'sender_name' === sortColumn ? table.sortArrowActive : table.sortArrow}
                    >
                      {sortArrow('sender_name', sortColumn, sortDirection)}
                    </span>
                  </a>
                </th>
                <th
                  scope="col"
                  mix={table.thSortable}
                  aria-sort={sortRule('content', sortColumn, sortDirection)}
                >
                  <a
                    href={sortHref('content', sortColumn, sortDirection, filter)}
                    data-rmx-target={getSelfFrameTarget()}
                    mix={table.sortLink}
                    title="Nach Nachricht sortieren"
                  >
                    Nachricht
                    <span
                      aria-hidden="true"
                      mix={'content' === sortColumn ? table.sortArrowActive : table.sortArrow}
                    >
                      {sortArrow('content', sortColumn, sortDirection)}
                    </span>
                  </a>
                </th>
                <th
                  scope="col"
                  mix={table.thSortable}
                  aria-sort={sortRule('created_at', sortColumn, sortDirection)}
                >
                  <a
                    href={sortHref('created_at', sortColumn, sortDirection, filter)}
                    data-rmx-target={getSelfFrameTarget()}
                    mix={table.sortLink}
                    title="Nach Erstellungsdatum sortieren"
                  >
                    Erstellt
                    <span
                      aria-hidden="true"
                      mix={'created_at' === sortColumn ? table.sortArrowActive : table.sortArrow}
                    >
                      {sortArrow('created_at', sortColumn, sortDirection)}
                    </span>
                  </a>
                </th>
                <th scope="col" mix={table.th}>
                  Aktionen
                </th>
              </tr>
            </thead>
            <tbody>
              {messages.map((msg) => (
                <MessageRowItem
                  key={msg.id}
                  message={msg}
                  offset={offset}
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  filter={filter}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    )
  }
}

// ── Compose panel ──

interface MessagesComposePanelProps {
  contentValue: string
  fieldErrors?: Record<string, string> | undefined
  formError?: string | undefined
  offset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter?: string | undefined
}

function MessagesComposePanel(handle: Handle<MessagesComposePanelProps>) {
  return () => {
    let { contentValue, fieldErrors, formError, offset, sortColumn, sortDirection, filter } =
      handle.props

    return (
      <form
        method="POST"
        id="messages-compose-form"
        action={routes.admin.messages.action.href()}
        data-rmx-target={getSelfFrameTarget()}
        mix={composeFormStyle}
      >
        <CsrfTokenInput />
        <GridStateHiddenInputs
          state={{
            offset: String(offset),
            sort: sortColumn,
            order: sortDirection,
            filter: filter ?? '',
          }}
        />
        <div mix={table.panel}>
          <div mix={table.panelBody}>
            <div mix={table.fieldGroup}>
              <label mix={table.label} htmlFor="messages-content">
                Nachricht
              </label>
              <MessageCompose
                maxLength={1000}
                strippableWarning
                value={contentValue}
                contentError={fieldErrors?.content}
                formError={formError}
              />
            </div>
            <div mix={composeFooterStyle}>
              <span mix={composeHintStyle}>Strg/⌘ + Enter zum Senden</span>
              <PendingSubmitButton pendingLabel="Wird gesendet…" icon="send" stretch={false}>
                Nachricht senden
              </PendingSubmitButton>
            </div>
          </div>
        </div>
      </form>
    )
  }
}

// ── Component ──

export function AdminMessagesPage(handle: Handle<AdminMessagesPageProps>) {
  return () => {
    let {
      messages,
      offset,
      hasMore,
      total,
      pageSize,
      sortColumn,
      sortDirection,
      filter,
      formValues,
      fieldErrors,
      formError,
      pageKey,
      pageSizeOverride,
    } = handle.props
    let contentValue = formValues?.content ?? ''
    let searchValue = filter ?? ''
    let totalPages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1
    let currentPage = pageSize > 0 ? Math.floor(offset / pageSize) + 1 : 0
    // A stale offset can sit far past the last page (old bookmark, concurrent
    // deletes), so never print a page number that does not exist.
    let displayedPage = Math.min(currentPage, totalPages)
    let pageStart = offset + 1
    let pageEnd = messages.length > 0 ? offset + messages.length : offset
    let stalePage = messages.length === 0 && offset > 0
    let noun = total === 1 ? 'Nachricht' : 'Nachrichten'

    let pageInfo =
      total === 0
        ? 'Keine Nachrichten'
        : stalePage
          ? `Seite ${displayedPage} von ${totalPages} \u00b7 insgesamt ${total} ${noun}`
          : `${pageStart}\u2013${pageEnd} von ${total} ${noun}` +
            (totalPages > 1 ? ` \u00b7 Seite ${currentPage} von ${totalPages}` : '')

    let emptyMessage = stalePage
      ? 'Keine Nachrichten auf dieser Seite.'
      : searchValue
        ? 'Keine Nachrichten f\u00fcr diese Suche gefunden.'
        : 'Noch keine Nachrichten. Sende die erste!'
    let emptyHref = stalePage
      ? messagesGridHref(0, sortColumn, sortDirection, filter)
      : searchValue
        ? messagesGridHref(0, sortColumn, sortDirection)
        : undefined
    let emptyActionLabel = stalePage ? 'Zur ersten Seite' : 'Filter zur\u00fccksetzen'

    return (
      <div mix={[table.page, dataGridFill]}>
        <ConfirmDelete />
        <MessageExpand />
        <div mix={headerRowStyle}>
          <h2 mix={table.title}>Nachrichten</h2>
          <ConnectionIndicator url={routes.admin.messages.subscribe.href()} />
        </div>
        <p mix={descriptionStyle}>
          Öffentliche Nachrichten verwalten. Nur Admins können Nachrichten senden und löschen.
        </p>

        {/* Compose panel */}
        <MessagesComposePanel
          contentValue={contentValue}
          fieldErrors={fieldErrors}
          formError={formError}
          offset={offset}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          filter={filter}
        />

        {/* Toolbar: filter (GET) */}
        <MessagesToolbar filter={filter} sortColumn={sortColumn} sortDirection={sortDirection} />

        {/* Messages grid */}
        <MessagesGrid
          messages={messages}
          offset={offset}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          filter={filter}
          emptyMessage={emptyMessage}
          emptyHref={emptyHref}
          emptyActionLabel={emptyActionLabel}
        />

        {/* Pagination */}
        <MessagesPagination
          offset={offset}
          hasMore={hasMore}
          totalPages={totalPages}
          currentPage={currentPage}
          stalePage={stalePage}
          pageSize={pageSize}
          pageInfo={pageInfo}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          filter={filter}
          pageKey={pageKey}
          pageSizeOverride={pageSizeOverride}
        />
      </div>
    )
  }
}
