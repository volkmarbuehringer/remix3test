import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { theme } from '../ui/theme/theme.ts'
import { rotatedGlyphCss } from './mixins/icon.ts'
import { buttonLink } from '../ui/theme/button.ts'
import { Glyph } from '../ui/theme/glyph/glyph.tsx'
import { animateEntrance } from '@remix-run/ui/animation'
import { entrance } from '../utils/motion.ts'

import { routes } from '../routes.ts'
import { getSelfFrameTarget } from '../utils/frame-target.ts'
import { RestfulForm } from './restful-form.tsx'
import { GridStateHiddenInputs } from './grid-state-hidden.tsx'
import { ConfirmDelete } from './confirm-delete.browser.tsx'
import { PendingSubmitButton } from './pending-submit.browser.tsx'
import { DirtyFormGuard } from './dirty-form-guard.browser.tsx'
import { UserAccountFields, fieldHintStyle } from './admin-users-fields.tsx'
import { table } from './mixins/admin-table.ts'
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
import { AdminUsersContextMenu } from '../actions/admin/public/admin-users-context-menu.tsx'
import { GridStateScript } from './grid-state-script.tsx'
import { PageSizeControl } from './page-size-control.tsx'
import { dataGridFill } from './mixins/data-grid.ts'
import { PASSWORD_MIN_LENGTH } from '../utils/password-complexity.ts'
import type { UserStatus } from '../utils/user-status.ts'
import type { PageSizeKey } from '../utils/get-page-size.ts'

const ADMIN_BASE = routes.admin.users.index.href()

/** User display type — password_hash is never sent to the client. */
type DisplayUser = {
  id: number
  email: string
  name: string
  role: string
  email_verified: number | null
  disabled_at: number | null
  created_at: number | null
  updated_at: number | null
}

interface AdminUsersPageProps {
  rows: DisplayUser[]
  offset: number
  hasMore: boolean
  total?: number | undefined
  prevOffset: number
  nextOffset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
  status?: UserStatus | undefined
  currentUserId?: number | null
  editRow?: DisplayUser | null
  creating?: boolean
  pageSize: number
  pageKey: PageSizeKey
  pageSizeOverride: number | null
  formValues?: Record<string, string> | undefined
  fieldErrors?: Record<string, string> | undefined
  formError?: string | undefined
}

// ── Styles ──

const userCellStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  minWidth: 0,
})

const avatarStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: '28px',
  height: '28px',
  borderRadius: theme.radius.full,
  background: theme.surface.lvl3,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.xxs,
  fontWeight: theme.fontWeight.bold,
  letterSpacing: '0.02em',
})

const avatarAdminStyle = css({
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
})

const avatarLargeStyle = css({
  width: '40px',
  height: '40px',
  fontSize: theme.fontSize.xs,
})

const userTextStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1px',
  minWidth: 0,
})

const userNameLinkStyle = css({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: theme.colors.text.primary,
  fontWeight: theme.fontWeight.medium,
  textDecoration: 'none',
  '&:hover': { color: theme.colors.action.primary.background, textDecoration: 'underline' },
})

const emailLineStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.xs,
  minWidth: 0,
})

const userEmailStyle = css({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: theme.colors.text.muted,
  fontSize: theme.fontSize.xs,
})

const verifiedIconStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  flexShrink: 0,
  color: theme.colors.success.foreground,
})

const pendingChipStyle = css({
  flexShrink: 0,
  padding: '0 4px',
  borderRadius: theme.radius.sm,
  background: theme.surface.lvl0,
  border: `1px solid ${theme.colors.border.default}`,
  color: theme.colors.text.muted,
  fontSize: theme.fontSize.xxxs,
  fontWeight: theme.fontWeight.semibold,
  whiteSpace: 'nowrap',
})

const roleBadgeStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  padding: `2px ${theme.space.sm}`,
  borderRadius: theme.radius.full,
  background: theme.surface.lvl2,
  border: `1px solid ${theme.colors.border.default}`,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  whiteSpace: 'nowrap',
})

const roleBadgeAdminStyle = css({
  background: theme.colors.action.primary.background,
  borderColor: theme.colors.action.primary.border,
  color: theme.colors.action.primary.foreground,
})

const statusPillStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  padding: `2px ${theme.space.sm}`,
  borderRadius: theme.radius.full,
  border: '1px solid transparent',
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  whiteSpace: 'nowrap',
})

const statusPillActiveStyle = css({
  background: theme.colors.success.background,
  borderColor: theme.colors.success.border,
  color: theme.colors.success.foreground,
})

const statusPillDisabledStyle = css({
  background: theme.surface.lvl0,
  borderColor: theme.colors.action.danger.border,
  color: theme.colors.action.danger.background,
})

const statusDotStyle = css({
  width: '6px',
  height: '6px',
  borderRadius: theme.radius.full,
  background: 'currentColor',
})

const idChipStyle = css({
  fontFamily: theme.fontFamily.mono,
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
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
  whiteSpace: 'nowrap',
})

const dateTimeStyle = css({
  fontSize: theme.fontSize.xxxs,
  color: theme.colors.text.muted,
  whiteSpace: 'nowrap',
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

const emptyStateStyle = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.space.md,
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

const colActionsWidth = css({ width: '112px' })
const colStatusWidth = css({ width: '124px' })
const colRoleWidth = css({ width: '96px' })
const colDateWidth = css({ width: '140px' })
const colIdWidth = css({ width: '64px' })

/**
 * Focused grid shown beside the edit/create panel: the panel already repeats
 * the user ID and timestamps, so those columns are dropped and the table is
 * allowed to shrink below the shared 840px floor. Without this the row actions
 * sat outside the narrow grid column (behind a horizontal scrollbar) and were
 * effectively invisible while editing.
 */
const focusedTableStyle = css({
  minWidth: '480px !important',
})

const actionSegDisabledStyle = css({
  opacity: 0.4,
  cursor: 'not-allowed',
  '&:hover': { background: theme.surface.lvl2, color: theme.colors.text.secondary },
})

/**
 * Bounded scroll region for the grid.
 *
 * `dataGridWrap` grows to fill the shell, which leaves a tall empty bordered
 * panel under a short result set. This variant keeps the table at content
 * height while it fits and shrinks (scrolling internally) only once the rows
 * exceed the available space, so the pagination bar stays reachable.
 */
const usersGridScrollStyle = css({
  flex: '0 1 auto',
  minHeight: 0,
  overflowY: 'auto',
  scrollbarGutter: 'stable',
})

const panelIdentityStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  padding: `${theme.space.md} ${theme.space.lg}`,
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
  background: theme.surface.lvl0,
})

const panelIdentityTextStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1px',
  minWidth: 0,
})

const panelIdentityNameStyle = css({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

const panelIdentityEmailStyle = css({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
})

const panelIdStyle = css({
  marginLeft: 'auto',
  fontFamily: theme.fontFamily.mono,
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
})

const panelCloseStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '1.75rem',
  height: '1.75rem',
  marginLeft: theme.space.xs,
  borderRadius: theme.radius.sm,
  color: theme.colors.text.muted,
  textDecoration: 'none',
  '&:hover': { background: theme.surface.lvl3, color: theme.colors.text.primary },
})

const panelMetaStyle = css({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: `${theme.space.xs} ${theme.space.md}`,
  padding: `${theme.space.sm} ${theme.space.lg}`,
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
  background: theme.surface.lvl0,
})

const panelMetaItemStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1px',
})

const panelMetaLabelStyle = css({
  fontSize: theme.fontSize.xxxs,
  fontWeight: theme.fontWeight.semibold,
  letterSpacing: theme.letterSpacing.meta,
  textTransform: 'uppercase',
  color: theme.colors.text.muted,
})

const panelMetaValueStyle = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.secondary,
  whiteSpace: 'nowrap',
})

const toggleRowStyle = css({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: theme.space.md,
  padding: theme.space.sm,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  background: theme.surface.lvl0,
})

const toggleTextStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  minWidth: 0,
})

const toggleLabelStyle = css({
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
  cursor: 'pointer',
})

const toggleCheckboxStyle = css({
  flexShrink: 0,
  width: '18px',
  height: '18px',
  marginTop: '2px',
  accentColor: theme.colors.action.primary.background,
  cursor: 'pointer',
  '&:disabled': { cursor: 'not-allowed', opacity: 0.5 },
})

/**
 * Stacked (<=1100px) layout puts the edit/create panel below the grid, where a
 * frame navigation to `?editing=` scrolled back to the top would leave the
 * panel out of view. Order it first so the panel the user just opened is the
 * first thing they see.
 */
const mobilePanelFirstStyle = css({
  '@media (max-width: 1100px)': { order: -1 },
})

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

// ── Helpers ──

function userInitials(name: string, email: string): string {
  let parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase()
  }
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return email.slice(0, 2).toUpperCase()
}

function roleLabel(role: string): string {
  return role === 'admin' ? 'Admin' : 'Kunde'
}

function formatDatePart(ts: number | null | undefined): string {
  if (!ts) return '—'
  return new Date(Number(ts)).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatTimePart(ts: number | null | undefined): string {
  if (!ts) return ''
  return new Date(Number(ts)).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Component ──

export function AdminUsersPage(handle: Handle<AdminUsersPageProps>) {
  return () => {
    let {
      rows,
      offset,
      hasMore,
      total,
      prevOffset,
      nextOffset,
      sortColumn,
      sortDirection,
      filter,
      status,
      currentUserId = null,
      editRow = null,
      creating = false,
      pageSize,
      pageKey,
      pageSizeOverride,
      formValues,
      fieldErrors,
      formError,
    } = handle.props
    let pageStart = rows.length > 0 ? offset + 1 : 0
    let pageEnd = offset + rows.length
    let currentPage = pageSize > 0 ? Math.floor(offset / pageSize) + 1 : 0
    let hasPanel = Boolean(editRow || creating)
    let activeStatus: UserStatus | undefined = status
    let searchValue = filter ?? ''
    let hasFilters = searchValue.length > 0 || activeStatus !== undefined
    let stalePage = rows.length === 0 && offset > 0

    let emptyMessage: string
    if (stalePage) {
      // A delete or a filter change can leave the URL on a page that no longer
      // exists; "no disabled users" would wrongly claim the result set is empty.
      emptyMessage = 'Keine Benutzer auf dieser Seite.'
    } else if (searchValue && activeStatus) {
      emptyMessage = 'Keine Benutzer für diese Filter gefunden.'
    } else if (searchValue) {
      emptyMessage = 'Keine Benutzer für diese Suche gefunden.'
    } else if (activeStatus === 'enabled') {
      emptyMessage = 'Keine aktiven Benutzer vorhanden.'
    } else if (activeStatus === 'disabled') {
      emptyMessage = 'Keine deaktivierten Benutzer vorhanden.'
    } else {
      emptyMessage = 'Noch keine Benutzer vorhanden.'
    }

    let gridSection = (
      <div mix={[table.minWidth0, hasPanel ? undefined : dataGridFill]}>
        <ConfirmDelete />

        {/* Toolbar + Filter */}
        <form
          method="GET"
          action={routes.admin.users.index.href()}
          role="search"
          aria-label="Benutzer suchen und filtern"
          data-rmx-target={getSelfFrameTarget()}
          data-rmx-history="replace"
          mix={table.filterBar}
        >
          <div mix={table.filterGroup} role="group" aria-label="Status filtern">
            {/* Switching status keeps the text search but always restarts on page
                1: keeping the previous offset while the result set changes can
                land on an empty page. */}
            <a
              href={ADMIN_BASE + '?' + buildFilterParams(searchValue, sortColumn, sortDirection, 0)}
              data-rmx-target={getSelfFrameTarget()}
              data-rmx-prefetch="intent"
              aria-current={!activeStatus ? 'page' : undefined}
              mix={[table.filterTab, !activeStatus ? table.filterTabActive : undefined]}
            >
              Alle
            </a>
            <a
              href={
                ADMIN_BASE +
                '?' +
                buildFilterParams(searchValue, sortColumn, sortDirection, 0, undefined, 'enabled')
              }
              data-rmx-target={getSelfFrameTarget()}
              data-rmx-prefetch="intent"
              aria-current={activeStatus === 'enabled' ? 'page' : undefined}
              mix={[
                table.filterTab,
                activeStatus === 'enabled' ? table.filterTabActive : undefined,
              ]}
            >
              Aktiv
            </a>
            <a
              href={
                ADMIN_BASE +
                '?' +
                buildFilterParams(searchValue, sortColumn, sortDirection, 0, undefined, 'disabled')
              }
              data-rmx-target={getSelfFrameTarget()}
              data-rmx-prefetch="intent"
              aria-current={activeStatus === 'disabled' ? 'page' : undefined}
              mix={[
                table.filterTab,
                activeStatus === 'disabled' ? table.filterTabActive : undefined,
              ]}
            >
              Deaktiviert
            </a>
          </div>
          {/* Preserve the active sort and status while searching; the offset is
              intentionally absent so a new search starts on page 1. */}
          <input type="hidden" name="sort" value={sortColumn} />
          <input type="hidden" name="order" value={sortDirection} />
          {activeStatus ? <input type="hidden" name="status" value={activeStatus} /> : null}
          <input
            type="text"
            name="filter"
            placeholder="Name, E-Mail oder ID…"
            defaultValue={searchValue}
            aria-label="Nach Name, E-Mail oder ID suchen"
            mix={table.filterInput}
          />
          <button type="submit" mix={table.searchBtn}>
            <Glyph name="search" width={14} height={14} /> Suchen
          </button>
          {hasFilters ? (
            <a href={routes.admin.users.index.href()} mix={table.clearLink}>
              Zurücksetzen
            </a>
          ) : null}
          <span mix={table.spacer} />
          <a
            href={buildCreateUrl(
              ADMIN_BASE,
              offset,
              sortColumn,
              sortDirection,
              searchValue,
              undefined,
              activeStatus,
            )}
            data-rmx-target={getSelfFrameTarget()}
            mix={[table.linkPlain, buttonLink({ tone: 'primary' })]}
          >
            <Glyph name="add" width={14} height={14} /> Neu anlegen
          </a>
        </form>

        {/* Table */}
        <div
          mix={[table.wrap, table.mobileCards, usersGridScrollStyle]}
          data-grid-scroll="true"
          data-users-table="true"
        >
          {rows.length === 0 ? (
            <div mix={emptyStateStyle}>
              <span>{emptyMessage}</span>
              <div mix={emptyActionsStyle}>
                {stalePage ? (
                  <a
                    href={buildPaginationUrl(
                      ADMIN_BASE,
                      0,
                      sortColumn,
                      sortDirection,
                      filter,
                      undefined,
                      activeStatus,
                    )}
                    data-rmx-target={getSelfFrameTarget()}
                    mix={[table.linkPlain, buttonLink({ tone: 'secondary' })]}
                  >
                    Zur ersten Seite
                  </a>
                ) : null}
                {hasFilters ? (
                  <a
                    href={routes.admin.users.index.href()}
                    data-rmx-target={getSelfFrameTarget()}
                    mix={[table.linkPlain, buttonLink({ tone: 'secondary' })]}
                  >
                    Filter zurücksetzen
                  </a>
                ) : null}
                {!hasPanel ? (
                  <a
                    href={buildCreateUrl(
                      ADMIN_BASE,
                      offset,
                      sortColumn,
                      sortDirection,
                      searchValue,
                      undefined,
                      activeStatus,
                    )}
                    data-rmx-target={getSelfFrameTarget()}
                    mix={[table.linkPlain, buttonLink({ tone: 'primary' })]}
                  >
                    <Glyph name="add" width={14} height={14} /> Benutzer anlegen
                  </a>
                ) : null}
              </div>
            </div>
          ) : (
            <table mix={[table.table, hasPanel ? focusedTableStyle : undefined]}>
              <caption mix={srOnlyStyle}>Benutzerliste</caption>
              <colgroup>
                {!hasPanel ? <col mix={colIdWidth} /> : null}
                <col />
                <col mix={colRoleWidth} />
                <col mix={colStatusWidth} />
                {!hasPanel ? <col mix={colDateWidth} /> : null}
                <col mix={[colActionsWidth, table.floatingActionsCol]} />
              </colgroup>
              <thead>
                <tr>
                  {!hasPanel ? (
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
                          activeStatus,
                        )}
                        data-rmx-target={getSelfFrameTarget()}
                        mix={table.sortLink}
                      >
                        ID
                        <span mix={'id' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                          {sortArrow('id', sortColumn, sortDirection)}
                        </span>
                      </a>
                    </th>
                  ) : null}
                  <th
                    scope="col"
                    mix={table.thSortable}
                    aria-sort={sortRule('name', sortColumn, sortDirection)}
                  >
                    <a
                      href={buildSortUrl(
                        ADMIN_BASE,
                        'name',
                        sortColumn,
                        sortDirection,
                        offset,
                        filter,
                        undefined,
                        activeStatus,
                      )}
                      data-rmx-target={getSelfFrameTarget()}
                      mix={table.sortLink}
                      title="Nach Name sortieren"
                    >
                      Benutzer
                      <span mix={'name' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('name', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th
                    scope="col"
                    mix={table.thSortable}
                    aria-sort={sortRule('role', sortColumn, sortDirection)}
                  >
                    <a
                      href={buildSortUrl(
                        ADMIN_BASE,
                        'role',
                        sortColumn,
                        sortDirection,
                        offset,
                        filter,
                        undefined,
                        activeStatus,
                      )}
                      data-rmx-target={getSelfFrameTarget()}
                      mix={table.sortLink}
                    >
                      Rolle
                      <span mix={'role' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('role', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th scope="col" mix={table.th}>
                    Status
                  </th>
                  {!hasPanel ? (
                    <th
                      scope="col"
                      mix={table.thSortable}
                      aria-sort={sortRule('created_at', sortColumn, sortDirection)}
                    >
                      <a
                        href={buildSortUrl(
                          ADMIN_BASE,
                          'created_at',
                          sortColumn,
                          sortDirection,
                          offset,
                          filter,
                          undefined,
                          activeStatus,
                        )}
                        data-rmx-target={getSelfFrameTarget()}
                        mix={table.sortLink}
                      >
                        Erstellt
                        <span
                          mix={
                            'created_at' === sortColumn ? table.sortArrowActive : table.sortArrow
                          }
                        >
                          {sortArrow('created_at', sortColumn, sortDirection)}
                        </span>
                      </a>
                    </th>
                  ) : null}
                  <th
                    scope="col"
                    aria-label="Aktionen"
                    mix={[table.th, table.floatingActionsHeader]}
                  >
                    <span mix={table.floatingActionsHeaderText}>Aktionen</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  let isDisabled = !!row.disabled_at
                  let isSelf = currentUserId != null && row.id === currentUserId
                  let toggleBlocked = isSelf && !isDisabled
                  let editHref = buildEditUrl(
                    ADMIN_BASE,
                    row.id,
                    offset,
                    sortColumn,
                    sortDirection,
                    filter,
                    undefined,
                    activeStatus,
                  )
                  let createdTitle = formatTimestamp(row.created_at)
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
                      data-disabled-at={row.disabled_at ?? ''}
                      data-self={isSelf ? 'true' : undefined}
                    >
                      {!hasPanel ? (
                        <td mix={table.td} data-label="ID" title={String(row.id)}>
                          <span mix={idChipStyle}>#{row.id}</span>
                        </td>
                      ) : null}
                      <td mix={table.td} data-label="Benutzer" title={row.email}>
                        <div mix={userCellStyle}>
                          <span
                            mix={[avatarStyle, row.role === 'admin' ? avatarAdminStyle : undefined]}
                            aria-hidden="true"
                          >
                            {userInitials(row.name, row.email)}
                          </span>
                          <div mix={userTextStyle}>
                            <a
                              href={editHref}
                              data-rmx-target={getSelfFrameTarget()}
                              mix={userNameLinkStyle}
                              title={`${row.name} bearbeiten`}
                            >
                              {row.name}
                            </a>
                            <span mix={emailLineStyle}>
                              <span mix={userEmailStyle} title={row.email}>
                                {row.email}
                              </span>
                              {row.email_verified ? (
                                <span
                                  mix={verifiedIconStyle}
                                  role="img"
                                  title="E-Mail-Adresse bestätigt"
                                  aria-label="E-Mail-Adresse bestätigt"
                                >
                                  <Glyph name="check" width={11} height={11} />
                                </span>
                              ) : (
                                <span
                                  mix={pendingChipStyle}
                                  title="E-Mail-Adresse noch nicht bestätigt"
                                >
                                  unbestätigt
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td mix={table.td} data-label="Rolle">
                        <span
                          mix={[
                            roleBadgeStyle,
                            row.role === 'admin' ? roleBadgeAdminStyle : undefined,
                          ]}
                        >
                          {roleLabel(row.role)}
                        </span>
                      </td>
                      <td
                        mix={table.td}
                        data-label="Status"
                        {...(hasPanel ? { 'data-floating-trailing': '' } : {})}
                      >
                        <span
                          mix={[
                            statusPillStyle,
                            isDisabled ? statusPillDisabledStyle : statusPillActiveStyle,
                          ]}
                          title={
                            isDisabled
                              ? 'Konto ist deaktiviert'
                              : 'Konto ist aktiv und kann sich anmelden'
                          }
                        >
                          <span mix={statusDotStyle} aria-hidden="true" />
                          {isDisabled ? 'Deaktiviert' : 'Aktiv'}
                        </span>
                      </td>
                      {!hasPanel ? (
                        <td
                          mix={table.td}
                          data-label="Erstellt"
                          title={createdTitle}
                          data-floating-trailing
                        >
                          <span mix={dateStackStyle}>
                            <span mix={dateMainStyle}>{formatDatePart(row.created_at)}</span>
                            <span mix={dateTimeStyle}>{formatTimePart(row.created_at)}</span>
                          </span>
                        </td>
                      ) : null}
                      <td mix={[table.actionCell, table.floatingActionCell]} data-label="Aktionen">
                        <div
                          mix={[table.actionGroup, table.floatingActions]}
                          role="group"
                          aria-label="Zeilenaktionen"
                          data-row-actions
                        >
                          <a
                            href={editHref}
                            data-rmx-target={getSelfFrameTarget()}
                            mix={table.actionSeg}
                            aria-label={`${row.name} bearbeiten`}
                            title="Bearbeiten"
                          >
                            <Glyph name="edit" width={13} height={13} />
                          </a>

                          {/* Blocked actions stay focusable (aria-disabled +
                              type="button") so keyboard users can reveal the
                              cluster and hear why the action is unavailable;
                              native `disabled` drops them from the tab order. */}
                          <RestfulForm
                            method="POST"
                            action={routes.admin.users.toggleDisabled.href({ id: row.id })}
                            data-toggle-form={row.id}
                            data-rmx-target={getSelfFrameTarget()}
                            mix={css({ margin: 0, padding: 0, display: 'inline-flex' })}
                          >
                            <GridStateHiddenInputs
                              state={{
                                offset: String(offset),
                                sort: sortColumn,
                                order: sortDirection,
                                filter: filter ?? '',
                                status: activeStatus ?? '',
                              }}
                            />
                            <button
                              type={toggleBlocked ? 'button' : 'submit'}
                              aria-disabled={toggleBlocked ? 'true' : undefined}
                              mix={[
                                table.actionSeg,
                                toggleBlocked ? actionSegDisabledStyle : undefined,
                              ]}
                              aria-label={
                                toggleBlocked
                                  ? 'Das eigene Konto kann nicht deaktiviert werden'
                                  : isDisabled
                                    ? `${row.name} aktivieren`
                                    : `${row.name} deaktivieren`
                              }
                              title={
                                toggleBlocked
                                  ? 'Das eigene Konto kann nicht deaktiviert werden.'
                                  : isDisabled
                                    ? 'Konto aktivieren'
                                    : 'Konto deaktivieren'
                              }
                            >
                              <Glyph
                                name={isDisabled ? 'check' : 'shield'}
                                width={13}
                                height={13}
                              />
                            </button>
                          </RestfulForm>

                          <RestfulForm
                            method="DELETE"
                            action={routes.admin.users.destroy.href({ id: row.id })}
                            data-delete-form={row.id}
                            data-confirm={`Benutzer "${row.name}" wirklich löschen?`}
                            data-rmx-target={getSelfFrameTarget()}
                            mix={css({ margin: 0, padding: 0, display: 'inline-flex' })}
                          >
                            <GridStateHiddenInputs
                              state={{
                                offset: String(offset),
                                sort: sortColumn,
                                order: sortDirection,
                                filter: filter ?? '',
                                status: activeStatus ?? '',
                              }}
                            />
                            <button
                              type={isSelf ? 'button' : 'submit'}
                              aria-disabled={isSelf ? 'true' : undefined}
                              mix={[
                                table.actionSeg,
                                table.actionSegDanger,
                                isSelf ? actionSegDisabledStyle : undefined,
                              ]}
                              aria-label={
                                isSelf
                                  ? 'Das eigene Konto kann nicht gelöscht werden'
                                  : `${row.name} löschen`
                              }
                              title={
                                isSelf ? 'Das eigene Konto kann nicht gelöscht werden.' : 'Löschen'
                              }
                            >
                              <Glyph name="trash" width={13} height={13} />
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

        {/* Pagination */}
        {(offset > 0 || hasMore || rows.length > 0) && (
          <div mix={table.pagination}>
            <span mix={css({ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' })}>
              {rows.length > 0 ? (
                <span mix={table.paginationInfo}>
                  Zeige {pageStart}–{pageEnd}
                  {typeof total === 'number' ? ` von ${total}` : ''}
                </span>
              ) : null}
              {currentPage > 0 ? (
                <span mix={pageBadgeStyle} aria-label={`Seite ${currentPage}`}>
                  Seite {currentPage}
                </span>
              ) : null}
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
                    undefined,
                    activeStatus,
                  )}
                  data-rmx-target={getSelfFrameTarget()}
                  mix={table.pageLink}
                  aria-label="Vorherige Seite"
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
                    undefined,
                    activeStatus,
                  )}
                  data-rmx-target={getSelfFrameTarget()}
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
                action={routes.admin.pageSize.href()}
                pageKey={pageKey}
                pageSize={pageSize}
                pageSizeOverride={pageSizeOverride}
                controlId="users-page-size"
              />
            </div>
          </div>
        )}

        {/* Context menu data and clientEntry */}
        <GridStateScript
          id="users-grid-state"
          baseHref={routes.admin.users.index.href()}
          offset={offset}
          sort={sortColumn}
          order={sortDirection}
          filter={filter}
          status={activeStatus}
        />
        <AdminUsersContextMenu />
      </div>
    )

    // Two-column layout when editing or creating
    if (hasPanel) {
      return (
        <div mix={[table.pageWide, table.minWidth0]}>
          <h2 mix={table.title}>Benutzer</h2>
          {formError ? <div mix={table.errorBanner}>{formError}</div> : null}
          <div mix={table.twoColumn}>
            {gridSection}
            <div mix={[table.stickyPanel, mobilePanelFirstStyle]}>
              {editRow ? (
                <AdminUsersEditPanel
                  row={editRow}
                  offset={String(offset)}
                  sort={sortColumn}
                  order={sortDirection}
                  filter={filter}
                  status={activeStatus}
                  isSelf={currentUserId != null && editRow.id === currentUserId}
                  formValues={formValues}
                  fieldErrors={fieldErrors}
                />
              ) : (
                <AdminUsersCreatePanel
                  offset={String(offset)}
                  sort={sortColumn}
                  order={sortDirection}
                  filter={filter}
                  status={activeStatus}
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
        <h2 mix={table.title}>Benutzer</h2>
        {gridSection}
      </div>
    )
  }
}

// ── Inline Edit Panel ──

interface EditPanelProps {
  row: DisplayUser
  offset?: string | undefined
  sort?: string | undefined
  order?: string | undefined
  filter?: string | undefined
  status?: string | undefined
  isSelf?: boolean
  formValues?: Record<string, string> | undefined
  fieldErrors?: Record<string, string> | undefined
}

function AdminUsersEditPanel(handle: Handle<EditPanelProps>) {
  return () => {
    let {
      row,
      offset = '',
      sort = '',
      order = '',
      filter = '',
      status = '',
      isSelf = false,
      formValues,
      fieldErrors,
    } = handle.props
    let cancelHref = buildCancelUrl(
      routes.admin.users.index.href(),
      offset,
      sort,
      order,
      filter,
      undefined,
      status,
    )
    let disabled =
      formValues?.disabled !== undefined ? formValues.disabled === 'true' : !!row.disabled_at
    let displayName = formValues?.name || row.name
    let displayEmail = formValues?.email || row.email
    return (
      <div
        mix={animateEntrance(entrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 }))}
      >
        <RestfulForm
          method="PUT"
          action={routes.admin.users.update.href({ id: row.id })}
          data-rmx-target={getSelfFrameTarget()}
          novalidate
        >
          <GridStateHiddenInputs state={{ offset, sort, order, filter, status }} />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={table.panelTitle}>Benutzer bearbeiten</span>
              <span mix={panelIdStyle}>#{row.id}</span>
              <a href={cancelHref} mix={panelCloseStyle} aria-label="Panel schließen">
                <Glyph name="close" width={15} height={15} />
              </a>
            </div>

            <div mix={panelIdentityStyle}>
              <span
                mix={[
                  avatarStyle,
                  avatarLargeStyle,
                  row.role === 'admin' ? avatarAdminStyle : undefined,
                ]}
                aria-hidden="true"
              >
                {userInitials(displayName, displayEmail)}
              </span>
              <span mix={panelIdentityTextStyle}>
                <span mix={panelIdentityNameStyle}>{displayName}</span>
                <span mix={emailLineStyle}>
                  <span mix={panelIdentityEmailStyle}>{displayEmail}</span>
                  {row.email_verified ? (
                    <span
                      mix={verifiedIconStyle}
                      role="img"
                      title="E-Mail-Adresse bestätigt"
                      aria-label="E-Mail-Adresse bestätigt"
                    >
                      <Glyph name="check" width={11} height={11} />
                    </span>
                  ) : (
                    <span mix={pendingChipStyle} title="E-Mail-Adresse noch nicht bestätigt">
                      unbestätigt
                    </span>
                  )}
                </span>
              </span>
              <span mix={[roleBadgeStyle, row.role === 'admin' ? roleBadgeAdminStyle : undefined]}>
                {roleLabel(row.role)}
              </span>
            </div>

            <div mix={panelMetaStyle}>
              <span mix={panelMetaItemStyle}>
                <span mix={panelMetaLabelStyle}>Erstellt</span>
                <span mix={panelMetaValueStyle}>
                  {row.created_at ? formatTimestamp(row.created_at) : '—'}
                </span>
              </span>
              <span mix={panelMetaItemStyle}>
                <span mix={panelMetaLabelStyle}>Aktualisiert</span>
                <span mix={panelMetaValueStyle}>
                  {row.updated_at ? formatTimestamp(row.updated_at) : '—'}
                </span>
              </span>
            </div>

            <div mix={table.panelBody}>
              <UserAccountFields
                idPrefix="au"
                formValues={formValues}
                fieldErrors={fieldErrors}
                defaultName={row.name ?? ''}
                defaultEmail={row.email ?? ''}
                defaultRole={row.role}
                passwordPlaceholder="Unverändert lassen"
                passwordHint={`Leer lassen, um das aktuelle Passwort beizubehalten. Mindestens ${PASSWORD_MIN_LENGTH} Zeichen, eine Zahl und ein Sonderzeichen.`}
                statusSlot={
                  <div mix={table.fieldGroup}>
                    <div mix={toggleRowStyle}>
                      <span mix={toggleTextStyle}>
                        <label htmlFor="au-disabled" mix={toggleLabelStyle}>
                          Konto deaktiviert
                        </label>
                        <span id="au-disabled-hint" mix={fieldHintStyle}>
                          {isSelf
                            ? 'Das eigene Konto kann nicht deaktiviert werden.'
                            : 'Deaktivierte Konten können sich nicht anmelden. Bestehende Sitzungen und API-Tokens werden ungültig.'}
                        </span>
                      </span>
                      <input
                        id="au-disabled"
                        name="disabled"
                        type="checkbox"
                        value="true"
                        checked={disabled}
                        disabled={isSelf}
                        mix={toggleCheckboxStyle}
                        aria-describedby="au-disabled-hint"
                      />
                    </div>
                  </div>
                }
              />

              <div mix={table.actions}>
                <PendingSubmitButton>Speichern</PendingSubmitButton>
                <a
                  href={cancelHref}
                  mix={[
                    table.spacer,
                    table.linkPlain,
                    buttonLink({ tone: 'secondary' }),
                    css({ flex: 1 }),
                  ]}
                >
                  Abbrechen
                </a>
              </div>
            </div>
          </div>
          <DirtyFormGuard />
        </RestfulForm>
      </div>
    )
  }
}

// ── Inline Create Panel ──

interface CreatePanelProps {
  offset?: string | undefined
  sort?: string | undefined
  order?: string | undefined
  filter?: string | undefined
  status?: string | undefined
  formValues?: Record<string, string> | undefined
  fieldErrors?: Record<string, string> | undefined
}

function AdminUsersCreatePanel(handle: Handle<CreatePanelProps>) {
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
    let cancelHref = buildCancelUrl(
      routes.admin.users.index.href(),
      offset,
      sort,
      order,
      filter,
      undefined,
      status,
    )
    return (
      <div
        mix={animateEntrance(entrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 }))}
      >
        <RestfulForm
          method="POST"
          action={routes.admin.users.create.href()}
          data-rmx-target={getSelfFrameTarget()}
          novalidate
        >
          <GridStateHiddenInputs state={{ offset, sort, order, filter, status }} />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={table.panelTitle}>Neuer Benutzer</span>
              <a href={cancelHref} mix={panelCloseStyle} aria-label="Panel schließen">
                <Glyph name="close" width={15} height={15} />
              </a>
            </div>

            <div mix={table.panelBody}>
              <UserAccountFields
                idPrefix="au-c"
                formValues={formValues}
                fieldErrors={fieldErrors}
                defaultName=""
                defaultEmail=""
                defaultRole="customer"
                emailHint="Wird als Login verwendet und muss eindeutig sein."
                passwordRequired
                passwordHint={`Mindestens ${PASSWORD_MIN_LENGTH} Zeichen, eine Zahl und ein Sonderzeichen.`}
              />

              <div mix={table.actions}>
                <PendingSubmitButton>Anlegen</PendingSubmitButton>
                <a
                  href={cancelHref}
                  mix={[
                    table.spacer,
                    table.linkPlain,
                    buttonLink({ tone: 'secondary' }),
                    css({ flex: 1 }),
                  ]}
                >
                  Abbrechen
                </a>
              </div>
            </div>
          </div>
          <DirtyFormGuard />
        </RestfulForm>
      </div>
    )
  }
}
