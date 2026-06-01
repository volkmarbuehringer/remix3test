import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { Button } from 'remix/ui/button'
import { Glyph } from 'remix/ui/glyph'
import { animateEntrance } from 'remix/ui/animation'
import { input } from './mixins/input.ts'

import { frames } from '../routes.ts'
import { RestfulForm } from './restful-form.tsx'
import { GridStateHiddenInputs } from './grid-state-hidden.tsx'
import { table } from './mixins/admin-table.ts'
import { sortArrow, buildSortUrl, buildPaginationUrl, buildCreateUrl, buildCancelUrl, formatTimestamp } from './mixins/admin-urls.ts'
import { AdminUsersContextMenu } from '../assets/admin-users-context-menu.tsx'
import { getCspNonce } from '../middleware/security-headers.ts'

const ADMIN_BASE = '/admin/users'

/** User display type — password_hash is never sent to the client. */
type DisplayUser = {
  id: number | null
  email: string
  name: string
  role: string
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
}

// ── Component ──

export function AdminUsersPage(handle: Handle<AdminUsersPageProps>) {
  return () => {
    let {
      rows, offset, hasMore, prevOffset, nextOffset,
      sortColumn, sortDirection, filter,
      editRow = null, creating = false,
    } = handle.props
    let pageStart = rows.length > 0 ? offset + 1 : 0
    let pageEnd = offset + rows.length

    let gridSection = (
      <div mix={table.minWidth0}>
        {/* Toolbar + Filter */}
        <form
          method="GET"
          action="/admin/users"
          rmx-target={frames.adminContent}
          mix={table.filterBar}
        >
          <input
            type="text"
            name="filter"
            placeholder="Suche nach Name oder E-Mail..."
            defaultValue={filter ?? ''}
            mix={table.filterInput}
          />
          <button type="submit" mix={table.searchBtn}>Suchen</button>
          {filter && (
            <a
              href="/admin/users"
              rmx-target={frames.adminContent}
              mix={table.clearLink}
            >
              Zurücksetzen
            </a>
          )}
          <span mix={table.spacer} />
          <a
            href={buildCreateUrl(ADMIN_BASE, offset, sortColumn, sortDirection, filter)}
            rmx-target={frames.adminContent}
            mix={table.linkPlain}
          >
            <Button tone="primary">+ Neu anlegen</Button>
          </a>
        </form>

        {/* Table */}
        <div mix={table.wrap} data-users-table="true">
          {rows.length === 0 ? (
            <div mix={table.empty}>
              {filter
                ? 'Keine Benutzer gefunden für diese Suche.'
                : 'Keine Benutzer vorhanden.'}
            </div>
          ) : (
            <table mix={table.table}>
              <colgroup>
                <col mix={css({ width: '60px' })} />
                <col />
                <col />
                <col mix={css({ width: '100px' })} />
                <col mix={css({ width: '160px' })} />
              </colgroup>
              <thead>
                <tr>
                  <th mix={table.thSortable}>
                    <a href={buildSortUrl(ADMIN_BASE, 'id', sortColumn, sortDirection, offset, filter)}
                       rmx-target={frames.adminContent} mix={table.sortLink}>
                      ID
                      <span mix={'id' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('id', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.thSortable}>
                    <a href={buildSortUrl(ADMIN_BASE, 'name', sortColumn, sortDirection, offset, filter)}
                       rmx-target={frames.adminContent} mix={table.sortLink}>
                      Name
                      <span mix={'name' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('name', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.thSortable}>
                    <a href={buildSortUrl(ADMIN_BASE, 'email', sortColumn, sortDirection, offset, filter)}
                       rmx-target={frames.adminContent} mix={table.sortLink}>
                      E-Mail
                      <span mix={'email' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('email', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.thSortable}>
                    <a href={buildSortUrl(ADMIN_BASE, 'role', sortColumn, sortDirection, offset, filter)}
                       rmx-target={frames.adminContent} mix={table.sortLink}>
                      Rolle
                      <span mix={'role' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('role', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.thSortable}>
                    <a href={buildSortUrl(ADMIN_BASE, 'created_at', sortColumn, sortDirection, offset, filter)}
                       rmx-target={frames.adminContent} mix={table.sortLink}>
                      Erstellt
                      <span mix={'created_at' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('created_at', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} mix={[table.row, editRow?.id === row.id ? table.editingRow : undefined]} data-row-id={row.id}>
                    <td mix={table.td} title={String(row.id)}>{row.id}</td>
                    <td mix={table.td} title={row.name}>{row.name}</td>
                    <td mix={table.td} title={row.email}>{row.email}</td>
                    <td mix={table.td}>{row.role}</td>
                    <td mix={table.td} title={formatTimestamp(row.created_at)}>{formatTimestamp(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {/* Hidden DELETE forms for context menu */}
          {rows.length > 0 ? (
            <div mix={table.displayNone} aria-hidden="true">
              {rows.map((row) => (
                <RestfulForm
                  key={row.id}
                  method="DELETE"
                  action={`/admin/users/${row.id}`}
                  data-delete-form={row.id}
                >
                  <GridStateHiddenInputs
                    state={{
                      offset: String(offset),
                      sort: sortColumn,
                      order: sortDirection,
                      filter: filter ?? '',
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
                  href={buildPaginationUrl(ADMIN_BASE, prevOffset, sortColumn, sortDirection, filter)}
                  rmx-target={frames.adminContent}
                  mix={table.pageLink}
                ><Glyph name="chevronRight" width={14} height={14} style={{ transform: 'rotate(180deg)' }} /> Zurück</a>
              ) : (
                <span mix={table.pageLinkDisabled}><Glyph name="chevronRight" width={14} height={14} style={{ transform: 'rotate(180deg)' }} /> Zurück</span>
              )}
              {hasMore ? (
                <a
                  href={buildPaginationUrl(ADMIN_BASE, nextOffset, sortColumn, sortDirection, filter)}
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
        <script id="users-grid-state" type="application/json" nonce={getCspNonce()}>
          {/* WARNING: Only serialize server-controlled data here.
              User-provided values MUST be escaped to prevent </script> breakout. */}
          {JSON.stringify({
            offset: String(offset),
            sort: sortColumn,
            order: sortDirection,
            filter: filter ?? '',
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
                />
              ) : (
                <AdminUsersCreatePanel
                  offset={String(offset)}
                  sort={sortColumn}
                  order={sortDirection}
                  filter={filter}
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

// ── Inline Edit Panel ──

interface EditPanelProps {
  row: DisplayUser
  offset?: string
  sort?: string
  order?: string
  filter?: string
}

function AdminUsersEditPanel(handle: Handle<EditPanelProps>) {
  return () => {
    let { row, offset = '', sort = '', order = '', filter = '' } = handle.props
    return (
      <div mix={animateEntrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 })}>
        <RestfulForm method="PUT" action={`/admin/users/${row.id}`}>
          <GridStateHiddenInputs state={{ offset, sort, order, filter }} />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={table.panelTitle}>Benutzer bearbeiten</span>
            </div>

            <div mix={table.panelBody}>
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="au-name">Name</label>
                <input
                  id="au-name"
                  name="name"
                  type="text"
                  value={row.name ?? ''}
                  mix={[input.base, input.focus]}
                />
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="au-email">E-Mail</label>
                <input
                  id="au-email"
                  name="email"
                  type="email"
                  value={row.email ?? ''}
                  mix={[input.base, input.focus]}
                />
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="au-role">Rolle</label>
                <select
                  id="au-role"
                  name="role"
                  mix={[input.base, input.focus, table.select]}
                >
                  <option value="customer" selected={row.role === 'customer'}>Kunde</option>
                  <option value="admin" selected={row.role === 'admin'}>Admin</option>
                </select>
              </div>

              <div mix={table.actions}>
                <Button type="submit" tone="primary" mix={table.spacer}>
                  Speichern
                </Button>
                <a href={buildCancelUrl('/admin/users', offset, sort, order, filter)} mix={[table.spacer, table.linkPlain]}>
                  <Button type="button" tone="secondary" mix={css({ width: '100%' })}>
                    Abbrechen
                  </Button>
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
}

function AdminUsersCreatePanel(handle: Handle<CreatePanelProps>) {
  return () => {
    let { offset = '', sort = '', order = '', filter = '' } = handle.props
    return (
      <div mix={animateEntrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 })}>
        <RestfulForm method="POST" action="/admin/users">
          <GridStateHiddenInputs state={{ offset, sort, order, filter }} />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={table.panelTitle}>Neuer Benutzer</span>
            </div>

            <div mix={table.panelBody}>
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="au-name-c">Name</label>
                <input
                  id="au-name-c"
                  name="name"
                  type="text"
                  required
                  mix={[input.base, input.focus]}
                />
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="au-email-c">E-Mail</label>
                <input
                  id="au-email-c"
                  name="email"
                  type="email"
                  required
                  mix={[input.base, input.focus]}
                />
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="au-role-c">Rolle</label>
                <select
                  id="au-role-c"
                  name="role"
                  mix={[input.base, input.focus, table.select]}
                >
                  <option value="customer" selected>Kunde</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="au-password-c">Passwort</label>
                <input
                  id="au-password-c"
                  name="password"
                  type="password"
                  required
                  minlength={6}
                  mix={[input.base, input.focus]}
                />
              </div>

              <div mix={table.actions}>
                <Button type="submit" tone="primary" mix={table.spacer}>
                  Anlegen
                </Button>
                <a href={buildCancelUrl('/admin/users', offset, sort, order, filter)} mix={[table.spacer, table.linkPlain]}>
                  <Button type="button" tone="secondary" mix={css({ width: '100%' })}>
                    Abbrechen
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </RestfulForm>
      </div>
    )
  }
}
