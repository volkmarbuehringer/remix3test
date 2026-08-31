import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'
import { rotatedGlyphCss } from './mixins/icon.ts'
import button from '../ui/theme/button.ts'
import { Glyph } from '../ui/theme/glyph/glyph.tsx'
import { animateEntrance } from 'remix/ui/animation'
import { entrance } from '../utils/motion.ts'
import { input } from './mixins/input.ts'

import { routes } from '../routes.ts'
import { getSelfFrameTarget } from '../utils/frame-target.ts'
import { RestfulForm } from './restful-form.tsx'
import { GridStateHiddenInputs } from './grid-state-hidden.tsx'
import { ConfirmDelete } from './confirm-delete.browser.tsx'
import { table } from './mixins/admin-table.ts'
import {
  sortArrow,
  buildSortUrl,
  buildPaginationUrl,
  buildCreateUrl,
  buildCancelUrl,
  buildEditUrl,
  buildFilterParams,
  formatTimestamp,
} from './mixins/admin-urls.ts'
import { AdminUsersContextMenu } from '../actions/admin/public/admin-users-context-menu.tsx'
import { getCspNonce } from '../middleware/security-headers.ts'

const ADMIN_BASE = routes.admin.users.index.href()

/** User display type — password_hash is never sent to the client. */
type DisplayUser = {
  id: number
  email: string
  name: string
  role: string
  disabled_at: number | null
  created_at: number | null
  updated_at: number | null
}

interface AdminUsersPageProps {
  rows: DisplayUser[]
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
  editRow?: DisplayUser | null
  creating?: boolean
  pageSize: number
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
  formError?: string
}

// ── Styles ──

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

const colActionsWidth = css({ width: '120px' })

const pageBadgeStyle = css({
  padding: `${theme.space.xs} ${theme.space.sm}`,
  borderRadius: theme.radius.full,
  background: theme.surface.lvl2,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  whiteSpace: 'nowrap',
})

// ── Component ──

export function AdminUsersPage(handle: Handle<AdminUsersPageProps>) {
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
      editRow = null,
      creating = false,
      pageSize,
      formValues,
      fieldErrors,
      formError,
    } = handle.props
    let pageStart = rows.length > 0 ? offset + 1 : 0
    let pageEnd = offset + rows.length
    let currentPage = pageSize > 0 ? Math.floor(offset / pageSize) + 1 : 0

    let gridSection = (
      <div mix={table.minWidth0}>
        <ConfirmDelete />

        {/* Toolbar + Filter */}
        <form
          method="GET"
          action={routes.admin.users.index.href()}
          data-rmx-target={getSelfFrameTarget()}
          mix={table.filterBar}
        >
          <div mix={table.filterGroup}>
            <a
              href={ADMIN_BASE + '?' + buildFilterParams('', sortColumn, sortDirection, offset)}
              data-rmx-target={getSelfFrameTarget()}
              mix={[
                table.filterTab,
                !filter || (filter !== 'enabled' && filter !== 'disabled')
                  ? table.filterTabActive
                  : undefined,
              ]}
            >
              Alle
            </a>
            <a
              href={
                ADMIN_BASE + '?' + buildFilterParams('enabled', sortColumn, sortDirection, offset)
              }
              data-rmx-target={getSelfFrameTarget()}
              mix={[table.filterTab, filter === 'enabled' ? table.filterTabActive : undefined]}
            >
              Aktiv
            </a>
            <a
              href={
                ADMIN_BASE + '?' + buildFilterParams('disabled', sortColumn, sortDirection, offset)
              }
              data-rmx-target={getSelfFrameTarget()}
              mix={[table.filterTab, filter === 'disabled' ? table.filterTabActive : undefined]}
            >
              Deaktiviert
            </a>
          </div>
          <input
            type="text"
            name="filter"
            placeholder="Suche nach Name, E-Mail oder ID..."
            defaultValue={filter && filter !== 'enabled' && filter !== 'disabled' ? filter : ''}
            aria-label="Nach Name, E-Mail oder ID suchen"
            mix={table.filterInput}
          />
          <button type="submit" mix={table.searchBtn}>
            <Glyph name="search" width={14} height={14} /> Suchen
          </button>
          {filter && (
            <a href={routes.admin.users.index.href()} mix={table.clearLink}>
              Zurücksetzen
            </a>
          )}
          <span mix={table.spacer} />
          <a
            href={buildCreateUrl(ADMIN_BASE, offset, sortColumn, sortDirection, filter)}
            data-rmx-target={getSelfFrameTarget()}
            mix={table.linkPlain}
          >
            <button mix={[button({ tone: 'primary' })]}>
              <Glyph name="add" width={14} height={14} /> Neu anlegen
            </button>
          </a>
        </form>

        {/* Table */}
        <div mix={table.wrap} data-users-table="true">
          {rows.length === 0 ? (
            <div mix={table.empty}>
              {filter ? 'Keine Benutzer gefunden für diese Suche.' : 'Keine Benutzer vorhanden.'}
            </div>
          ) : (
            <table mix={table.table}>
              <colgroup>
                <col mix={css({ width: '60px' })} />
                <col />
                <col />
                <col mix={css({ width: '100px' })} />
                <col mix={css({ width: '80px' })} />
                <col mix={css({ width: '120px' })} />
                <col mix={colActionsWidth} />
              </colgroup>
              <thead>
                <tr>
                  <th mix={table.thSortable} aria-sort={sortRule('id', sortColumn, sortDirection)}>
                    <a
                      href={buildSortUrl(
                        ADMIN_BASE,
                        'id',
                        sortColumn,
                        sortDirection,
                        offset,
                        filter,
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
                  <th
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
                      )}
                      data-rmx-target={getSelfFrameTarget()}
                      mix={table.sortLink}
                    >
                      Name
                      <span mix={'name' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('name', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th
                    mix={table.thSortable}
                    aria-sort={sortRule('email', sortColumn, sortDirection)}
                  >
                    <a
                      href={buildSortUrl(
                        ADMIN_BASE,
                        'email',
                        sortColumn,
                        sortDirection,
                        offset,
                        filter,
                      )}
                      data-rmx-target={getSelfFrameTarget()}
                      mix={table.sortLink}
                    >
                      E-Mail
                      <span mix={'email' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('email', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th
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
                  <th mix={table.th}>Status</th>
                  <th
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
                      )}
                      data-rmx-target={getSelfFrameTarget()}
                      mix={table.sortLink}
                    >
                      Erstellt
                      <span
                        mix={'created_at' === sortColumn ? table.sortArrowActive : table.sortArrow}
                      >
                        {sortArrow('created_at', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.th}>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  let isDisabled = !!row.disabled_at
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
                        editRow?.id === row.id ? table.editingRow : undefined,
                        isDisabled ? table.disabledRow : undefined,
                      ]}
                      data-row-id={row.id}
                      data-disabled-at={row.disabled_at ?? ''}
                    >
                      <td mix={table.td} title={String(row.id)}>
                        {row.id}
                      </td>
                      <td mix={table.td} title={row.name}>
                        {row.name}
                      </td>
                      <td mix={table.td} title={row.email}>
                        {row.email}
                      </td>
                      <td mix={table.td}>{row.role}</td>
                      <td mix={table.td}>
                        <span
                          mix={[
                            table.statusBadge,
                            isDisabled ? table.statusBadgeDisabled : table.statusBadgeActive,
                          ]}
                        >
                          {isDisabled ? 'Deaktiviert' : 'Aktiv'}
                        </span>
                      </td>
                      <td mix={table.td} title={formatTimestamp(row.created_at)}>
                        {formatTimestamp(row.created_at)}
                      </td>
                      <td mix={table.actionCell}>
                        <div mix={rowActionsStyle}>
                          <a
                            href={editHref}
                            data-rmx-target={getSelfFrameTarget()}
                            mix={iconActionStyle}
                            aria-label="Bearbeiten"
                            title="Bearbeiten"
                          >
                            <Glyph name="edit" width={14} height={14} />
                          </a>

                          <RestfulForm
                            method="POST"
                            action={routes.admin.users.toggleDisabled.href({ id: row.id })}
                            data-toggle-form={row.id}
                            data-rmx-target={getSelfFrameTarget()}
                            mix={css({ margin: 0, padding: 0 })}
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
                              mix={iconActionStyle}
                              aria-label={isDisabled ? 'Aktivieren' : 'Deaktivieren'}
                              title={isDisabled ? 'Aktivieren' : 'Deaktivieren'}
                            >
                              <Glyph
                                name={isDisabled ? 'check' : 'shield'}
                                width={14}
                                height={14}
                              />
                            </button>
                          </RestfulForm>

                          <RestfulForm
                            method="DELETE"
                            action={routes.admin.users.destroy.href({ id: row.id })}
                            data-delete-form={row.id}
                            data-confirm={`Benutzer "${row.name}" wirklich löschen?`}
                            data-rmx-target={getSelfFrameTarget()}
                            mix={css({ margin: 0, padding: 0 })}
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
                              aria-label="Löschen"
                              title="Löschen"
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

        {/* Pagination */}
        {(offset > 0 || hasMore) && (
          <div mix={table.pagination}>
            <span mix={css({ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' })}>
              {rows.length > 0 ? (
                <span mix={table.paginationInfo}>
                  Zeige {pageStart}–{pageEnd}
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
        <script id="users-grid-state" type="application/json" nonce={getCspNonce()}>
          {/* WARNING: Only serialize server-controlled data here.
              User-provided values MUST be escaped to prevent </script> breakout. */}
          {JSON.stringify({
            offset: String(offset),
            sort: sortColumn,
            order: sortDirection,
            filter: filter ?? '',
            baseHref: routes.admin.users.index.href(),
          })}
        </script>
        <AdminUsersContextMenu />
      </div>
    )

    // Two-column layout when editing or creating
    if (editRow || creating) {
      return (
        <div mix={table.page}>
          <h2 mix={table.title}>Benutzer</h2>
          {formError ? <div mix={table.errorBanner}>{formError}</div> : null}
          <div mix={table.twoColumn}>
            {gridSection}
            <div mix={table.stickyPanel}>
              {editRow ? (
                <AdminUsersEditPanel
                  row={editRow}
                  offset={String(offset)}
                  sort={sortColumn}
                  order={sortDirection}
                  filter={filter}
                  formValues={formValues}
                  fieldErrors={fieldErrors}
                />
              ) : (
                <AdminUsersCreatePanel
                  offset={String(offset)}
                  sort={sortColumn}
                  order={sortDirection}
                  filter={filter}
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
      <div mix={table.page}>
        <h2 mix={table.title}>Benutzer</h2>
        {gridSection}
      </div>
    )
  }
}

function sortRule(
  field: string,
  sortField: string,
  sortOrder: 'asc' | 'desc',
): 'ascending' | 'descending' | undefined {
  if (field !== sortField) return undefined
  return sortOrder === 'asc' ? 'ascending' : 'descending'
}

// ── Inline Edit Panel ──

interface EditPanelProps {
  row: DisplayUser
  offset?: string
  sort?: string
  order?: string
  filter?: string
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
}

function AdminUsersEditPanel(handle: Handle<EditPanelProps>) {
  return () => {
    let {
      row,
      offset = '',
      sort = '',
      order = '',
      filter = '',
      formValues,
      fieldErrors,
    } = handle.props
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
          <GridStateHiddenInputs state={{ offset, sort, order, filter }} />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={table.panelTitle}>Benutzer bearbeiten</span>
            </div>

            <div mix={table.panelBody}>
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="au-name">
                  Name
                </label>
                <input
                  id="au-name"
                  name="name"
                  type="text"
                  mix={[input.base, input.focus, fieldErrors?.name ? inputErrorStyle : null].filter(
                    Boolean,
                  )}
                  value={formValues?.name ?? row.name ?? ''}
                />
                {fieldErrors?.name ? <div mix={fieldErrorStyle}>{fieldErrors.name}</div> : null}
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="au-email">
                  E-Mail
                </label>
                <input
                  id="au-email"
                  name="email"
                  type="email"
                  mix={[
                    input.base,
                    input.focus,
                    fieldErrors?.email ? inputErrorStyle : null,
                  ].filter(Boolean)}
                  value={formValues?.email ?? row.email ?? ''}
                />
                {fieldErrors?.email ? <div mix={fieldErrorStyle}>{fieldErrors.email}</div> : null}
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="au-role">
                  Rolle
                </label>
                <select
                  id="au-role"
                  name="role"
                  mix={[input.base, input.focus, table.select]}
                  aria-invalid={fieldErrors?.role ? true : undefined}
                >
                  <option value="customer" selected={(formValues?.role ?? row.role) === 'customer'}>
                    Kunde
                  </option>
                  <option value="admin" selected={(formValues?.role ?? row.role) === 'admin'}>
                    Admin
                  </option>
                </select>
                {fieldErrors?.role ? <div mix={fieldErrorStyle}>{fieldErrors.role}</div> : null}
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label}>
                  <input
                    type="checkbox"
                    name="disabled"
                    value="true"
                    checked={
                      formValues?.disabled !== undefined
                        ? formValues.disabled === 'true'
                        : !!row.disabled_at
                    }
                    mix={css({ marginRight: '6px' })}
                  />
                  Deaktiviert
                </label>
              </div>

              <div mix={table.actions}>
                <button type="submit" mix={[button({ tone: 'primary' }), table.spacer]}>
                  Speichern
                </button>
                <a
                  href={buildCancelUrl(
                    routes.admin.users.index.href(),
                    offset,
                    sort,
                    order,
                    filter,
                  )}
                  mix={[table.spacer, table.linkPlain]}
                >
                  <button
                    type="button"
                    mix={[button({ tone: 'secondary' }), css({ width: '100%' })]}
                  >
                    Abbrechen
                  </button>
                </a>
              </div>
            </div>
          </div>
        </RestfulForm>
      </div>
    )
  }
}

// ── Inline Create Panel ──

interface CreatePanelProps {
  offset?: string
  sort?: string
  order?: string
  filter?: string
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
}

function AdminUsersCreatePanel(handle: Handle<CreatePanelProps>) {
  return () => {
    let { offset = '', sort = '', order = '', filter = '', formValues, fieldErrors } = handle.props
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
          <GridStateHiddenInputs state={{ offset, sort, order, filter }} />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={table.panelTitle}>Neuer Benutzer</span>
            </div>

            <div mix={table.panelBody}>
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="au-name-c">
                  Name
                </label>
                <input
                  id="au-name-c"
                  name="name"
                  type="text"
                  mix={[input.base, input.focus, fieldErrors?.name ? inputErrorStyle : null].filter(
                    Boolean,
                  )}
                  value={formValues?.name ?? ''}
                  required
                />
                {fieldErrors?.name ? <div mix={fieldErrorStyle}>{fieldErrors.name}</div> : null}
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="au-email-c">
                  E-Mail
                </label>
                <input
                  id="au-email-c"
                  name="email"
                  type="email"
                  mix={[
                    input.base,
                    input.focus,
                    fieldErrors?.email ? inputErrorStyle : null,
                  ].filter(Boolean)}
                  value={formValues?.email ?? ''}
                  required
                />
                {fieldErrors?.email ? <div mix={fieldErrorStyle}>{fieldErrors.email}</div> : null}
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="au-role-c">
                  Rolle
                </label>
                <select
                  id="au-role-c"
                  name="role"
                  mix={[input.base, input.focus, table.select]}
                  aria-invalid={fieldErrors?.role ? true : undefined}
                >
                  <option
                    value="customer"
                    selected={(formValues?.role ?? 'customer') === 'customer'}
                  >
                    Kunde
                  </option>
                  <option value="admin" selected={formValues?.role === 'admin'}>
                    Admin
                  </option>
                </select>
                {fieldErrors?.role ? <div mix={fieldErrorStyle}>{fieldErrors.role}</div> : null}
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="au-password-c">
                  Passwort
                </label>
                <input
                  id="au-password-c"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  mix={[
                    input.base,
                    input.focus,
                    fieldErrors?.password ? inputErrorStyle : null,
                  ].filter(Boolean)}
                />
                {fieldErrors?.password ? (
                  <div mix={fieldErrorStyle}>{fieldErrors.password}</div>
                ) : null}
              </div>

              <div mix={table.actions}>
                <button type="submit" mix={[button({ tone: 'primary' }), table.spacer]}>
                  Anlegen
                </button>
                <a
                  href={buildCancelUrl(
                    routes.admin.users.index.href(),
                    offset,
                    sort,
                    order,
                    filter,
                  )}
                  mix={[table.spacer, table.linkPlain]}
                >
                  <button
                    type="button"
                    mix={[button({ tone: 'secondary' }), css({ width: '100%' })]}
                  >
                    Abbrechen
                  </button>
                </a>
              </div>
            </div>
          </div>
        </RestfulForm>
      </div>
    )
  }
}
