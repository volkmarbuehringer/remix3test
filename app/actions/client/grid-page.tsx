import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../../ui/theme/theme.ts'
import button from '../../ui/theme/button.ts'

import type { Client } from '../../data/schema.ts'
import { FrameRefreshButton } from './public/grid-refresh-button.tsx'
import { ConfirmDelete } from '../../ui/confirm-delete.browser.tsx'
import { routes } from '../../routes.ts'
import { GridStateHiddenInputs } from '../../ui/grid-state-hidden.tsx'
import { CsrfTokenInput } from '../../ui/csrf-token-input.tsx'
import { table } from '../../ui/mixins/admin-table.ts'
import { getCspNonce } from '../../middleware/security-headers.ts'
import { ClientsContextMenu } from './public/clients-context-menu.tsx'

type Row = Client
type SortField = 'name' | 'email' | 'role' | 'status' | 'registered' | null

interface ClientGridPageProps {
  rows: Row[]
  offset: number
  hasPrev: boolean
  hasNext: boolean
  sortField?: string | null
  sortOrder?: 'asc' | 'desc'
  filter?: string
  pageSize?: number
  editingId?: number | null
}

// ---------------------------------------------------------------------------
// Table styles
// ---------------------------------------------------------------------------

const tableStyle = css({
  width: '100%',
  tableLayout: 'fixed',
  borderCollapse: 'collapse',
  background: theme.surface.lvl0,
  borderRadius: theme.radius.lg,
  overflow: 'hidden',
  boxShadow: theme.shadow.sm,
  border: `1px solid ${theme.colors.border.default}`,
})

const thStyle = css({
  textAlign: 'left',
  padding: `${theme.space.sm} ${theme.space.md}`,
  background: theme.surface.lvl2,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  borderBottom: `2px solid ${theme.colors.border.default}`,
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
})

const thSortableStyle = css({
  textAlign: 'left',
  padding: `${theme.space.sm} ${theme.space.md}`,
  background: theme.surface.lvl2,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  borderBottom: `2px solid ${theme.colors.border.default}`,
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
})

const sortLinkStyle = css({
  color: 'inherit',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  '&:hover': { color: theme.colors.text.primary },
})

const sortArrowStyle = css({
  display: 'inline-block',
  fontSize: '0.7rem',
  lineHeight: '1',
  color: theme.colors.text.muted,
})

const sortArrowActiveStyle = css({
  display: 'inline-block',
  fontSize: '0.8rem',
  lineHeight: '1',
  color: theme.colors.action.primary.background,
  fontWeight: theme.fontWeight.bold,
})

const tdBase = {
  padding: `${theme.space.sm} ${theme.space.md}`,
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  verticalAlign: 'middle',
} as const

const tdStyle = css({
  ...tdBase,
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.primary,
})

const tdIdStyle = css({
  ...tdBase,
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.muted,
  fontWeight: theme.fontWeight.medium,
  fontFamily: theme.fontFamily.mono,
})

const tdActionsStyle = css({
  padding: `${theme.space.xs} ${theme.space.sm}`,
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
  verticalAlign: 'middle',
  textAlign: 'center',
})

const rowStyle = css({
  transition: 'background-color 120ms ease',
  '&:nth-child(even)': { background: theme.surface.lvl1 },
  '&:hover': { background: theme.surface.lvl3 },
})

const editingRowStyle = css({
  outline: `2px solid ${theme.colors.action.primary.background}`,
  outlineOffset: '-2px',
  backgroundColor: theme.surface.lvl0,
})

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

const paginationBarStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: theme.space.md,
  padding: `0 ${theme.space.xs}`,
})

const paginationInfoStyle = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
})

const paginationBtnGroupStyle = css({
  display: 'flex',
  gap: theme.space.sm,
})

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

const filterBarStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: theme.space.sm,
  marginBottom: theme.space.md,
})

const filterInputStyle = css({
  flex: '1',
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
  '&::placeholder': { color: theme.colors.text.muted },
})

const clearLinkStyle = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
  textDecoration: 'none',
  '&:hover': {
    color: theme.colors.action.primary.foreground,
    textDecoration: 'underline',
  },
})

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

const emptyStateStyle = css({
  textAlign: 'center',
  padding: theme.space.xxl,
  color: theme.colors.text.muted,
  fontSize: theme.fontSize.md,
})

const smallBtnStyle = css({
  minHeight: '1.75rem',
  paddingInline: '0.5rem',
  fontSize: '0.75rem',
})

const actionBtnGroup = css({
  display: 'inline-flex',
  alignItems: 'stretch',
  gap: '0.25rem',
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sortArrow(
  field: string,
  sortField: string | null | undefined,
  sortOrder: 'asc' | 'desc',
): string {
  if (field !== sortField) return '\u2195'
  return sortOrder === 'asc' ? '\u2191' : '\u2193'
}

function buildSortUrl(
  field: string,
  currentSort: string | null | undefined,
  currentOrder: 'asc' | 'desc',
  offset: number,
  filter?: string,
  editingId?: number | null,
): string {
  let newOrder: 'asc' | 'desc'
  if (field === currentSort) {
    newOrder = currentOrder === 'asc' ? 'desc' : 'asc'
  } else {
    newOrder = 'asc'
  }
  let params = new URLSearchParams()
  params.set('offset', '0')
  params.set('sort', field)
  params.set('order', newOrder)
  if (filter) params.set('filter', filter)
  if (editingId) params.set('editing', String(editingId))
  return '/admin/clients?' + params.toString()
}

function buildPaginationUrl(
  newOffset: number,
  sort: string | null | undefined,
  order: 'asc' | 'desc',
  filter?: string,
  editingId?: number | null,
): string {
  let params = new URLSearchParams()
  params.set('offset', String(newOffset))
  if (sort) params.set('sort', sort)
  if (order) params.set('order', order)
  if (filter) params.set('filter', filter)
  if (editingId) params.set('editing', String(editingId))
  return '/admin/clients?' + params.toString()
}

function buildFilterUrl(
  filterValue: string,
  currentSort: string | null | undefined,
  currentOrder: 'asc' | 'desc',
  offset: number,
  editingId?: number | null,
): string {
  let params = new URLSearchParams()
  if (filterValue) params.set('filter', filterValue)
  params.set('sort', currentSort ?? 'id')
  params.set('order', currentOrder)
  if (offset > 0) params.set('offset', String(offset))
  if (editingId) params.set('editing', String(editingId))
  return '/admin/clients?' + params.toString()
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function buildCreateUrl(
  sort: string | null | undefined,
  order: string,
  offset: number,
  filter?: string,
): string {
  let params = new URLSearchParams()
  params.set('creating', 'true')
  if (sort) params.set('sort', sort)
  if (order) params.set('order', order)
  if (offset > 0) params.set('offset', String(offset))
  if (filter) params.set('filter', filter)
  return '/admin/clients?' + params.toString()
}

function buildEditUrl(
  rowId: number,
  offset: number,
  sort: string | null | undefined,
  order: string,
  filter?: string,
): string {
  let params = new URLSearchParams()
  params.set('editing', String(rowId))
  params.set('offset', String(offset))
  if (sort) params.set('sort', sort)
  if (order) params.set('order', order)
  if (filter) params.set('filter', filter)
  return '/admin/clients?' + params.toString()
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ClientGridPage(handle: Handle<ClientGridPageProps>) {
  return () => {
    let {
      rows,
      offset,
      hasPrev,
      hasNext,
      sortField = null,
      sortOrder = 'asc',
      filter,
      pageSize = 20,
      editingId,
    } = handle.props
    let pageStart = rows.length > 0 ? offset + 1 : 0
    let pageEnd = offset + rows.length
    let isStatusFilter = filter === 'active' || filter === 'inactive'

    return (
      <div id="client-grid-content">
        <ConfirmDelete />

        {/* Toolbar: Add New + Refresh button */}
        <div
          mix={css({
            display: 'flex',
            justifyContent: 'flex-end',
            gap: theme.space.sm,
            marginBottom: theme.space.sm,
          })}
        >
          <FrameRefreshButton />
          <a
            href={buildCreateUrl(sortField, sortOrder, offset, filter)}
            data-rmx-document
            mix={css({ textDecoration: 'none' })}
          >
            <button mix={[button({ tone: 'primary' }), smallBtnStyle]}>+ Add New</button>
          </a>
        </div>

        {/* Filter bar: status tabs + search */}
        <div mix={filterBarStyle}>
          <div mix={table.filterGroup}>
            <a
              href={buildFilterUrl('', sortField, sortOrder, offset, editingId)}
              data-rmx-target="admin-content"
              mix={[
                table.filterTab,
                !isStatusFilter ? table.filterTabActive : undefined,
              ]}
            >
              Alle
            </a>
            <a
              href={buildFilterUrl('active', sortField, sortOrder, offset, editingId)}
              data-rmx-target="admin-content"
              mix={[table.filterTab, filter === 'active' ? table.filterTabActive : undefined]}
            >
              Aktiv
            </a>
            <a
              href={buildFilterUrl('inactive', sortField, sortOrder, offset, editingId)}
              data-rmx-target="admin-content"
              mix={[table.filterTab, filter === 'inactive' ? table.filterTabActive : undefined]}
            >
              Inaktiv
            </a>
          </div>
          <form
            method="GET"
            action="/admin/clients"
            data-rmx-target="admin-content"
            data-rmx-history="replace"
            mix={css({ flex: 1, display: 'flex', gap: theme.space.sm, margin: 0 })}
          >
            <input
              type="text"
              name="filter"
              placeholder="Search by name or email..."
              defaultValue={filter && !isStatusFilter ? filter : ''}
              mix={filterInputStyle}
            />
            {editingId ? <input type="hidden" name="editing" value={editingId} /> : null}
            <button type="submit" mix={[button({ tone: 'secondary' })]}>
              Search
            </button>
          </form>
          {filter && !isStatusFilter ? (
            <a href={routes.admin.clients.index.href()} mix={clearLinkStyle}>
              Clear
            </a>
          ) : null}
        </div>

        {rows.length === 0 ? (
          <div mix={emptyStateStyle}>
            <p>{filter ? 'No client records match your filter.' : 'No client records found.'}</p>
          </div>
        ) : (
          <>
            <table mix={tableStyle} data-clients-table="true">
              <colgroup>
                <col mix={css({ width: '5%' })} />
                <col mix={css({ width: '18%' })} />
                <col mix={css({ width: '25%' })} />
                <col mix={css({ width: '10%' })} />
                <col mix={css({ width: '10%' })} />
                <col mix={css({ width: '15%' })} />
                <col mix={css({ width: '17%' })} />
              </colgroup>
              <thead>
                <tr>
                  <th mix={thStyle}>ID</th>
                  <th mix={thSortableStyle}>
                    <a
                      href={buildSortUrl('name', sortField, sortOrder, offset, filter, editingId)}
                      data-rmx-target="admin-content"
                      mix={sortLinkStyle}
                    >
                      Name
                      <span mix={sortField === 'name' ? sortArrowActiveStyle : sortArrowStyle}>
                        {sortArrow('name', sortField, sortOrder)}
                      </span>
                    </a>
                  </th>
                  <th mix={thSortableStyle}>
                    <a
                      href={buildSortUrl('email', sortField, sortOrder, offset, filter, editingId)}
                      data-rmx-target="admin-content"
                      mix={sortLinkStyle}
                    >
                      Email
                      <span mix={sortField === 'email' ? sortArrowActiveStyle : sortArrowStyle}>
                        {sortArrow('email', sortField, sortOrder)}
                      </span>
                    </a>
                  </th>
                  <th mix={thSortableStyle}>
                    <a
                      href={buildSortUrl('role', sortField, sortOrder, offset, filter, editingId)}
                      data-rmx-target="admin-content"
                      mix={sortLinkStyle}
                    >
                      Role
                      <span mix={sortField === 'role' ? sortArrowActiveStyle : sortArrowStyle}>
                        {sortArrow('role', sortField, sortOrder)}
                      </span>
                    </a>
                  </th>
                  <th mix={thSortableStyle}>
                    <a
                      href={buildSortUrl('status', sortField, sortOrder, offset, filter, editingId)}
                      data-rmx-target="admin-content"
                      mix={sortLinkStyle}
                    >
                      Status
                      <span mix={sortField === 'status' ? sortArrowActiveStyle : sortArrowStyle}>
                        {sortArrow('status', sortField, sortOrder)}
                      </span>
                    </a>
                  </th>
                  <th mix={thSortableStyle}>
                    <a
                      href={buildSortUrl(
                        'registered',
                        sortField,
                        sortOrder,
                        offset,
                        filter,
                        editingId,
                      )}
                      data-rmx-target="admin-content"
                      mix={sortLinkStyle}
                    >
                      Reg.
                      <span
                        mix={sortField === 'registered' ? sortArrowActiveStyle : sortArrowStyle}
                      >
                        {sortArrow('registered', sortField, sortOrder)}
                      </span>
                    </a>
                  </th>
                  <th mix={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    data-row-id={row.id}
                    data-status={row.status}
                    mix={[rowStyle, editingId === row.id ? editingRowStyle : undefined]}
                  >
                    <td mix={tdIdStyle}>{row.id}</td>
                    <td mix={tdStyle} title={row.name}>
                      {row.name}
                    </td>
                    <td mix={tdStyle} title={row.email}>
                      {row.email}
                    </td>
                    <td mix={tdStyle}>{row.role}</td>
                    <td mix={tdStyle}>
                      <span
                        mix={[
                          table.statusBadge,
                          row.status === 'Active'
                            ? table.statusBadgeActive
                            : table.statusBadgeDisabled,
                        ]}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td mix={tdStyle}>{formatDate(row.registered as number)}</td>
                    <td mix={tdActionsStyle}>
                      <div mix={actionBtnGroup}>
                        <a
                          href={buildEditUrl(row.id, offset, sortField, sortOrder, filter)}
                          target="_top"
                          data-rmx-document
                        >
                          <button mix={[button({ tone: 'secondary' }), smallBtnStyle]}>Edit</button>
                        </a>
                        <form
                          method="POST"
                          action={routes.admin.clients.toggleStatus.href({ id: row.id })}
                          data-toggle-form={row.id}
                          data-rmx-target="admin-content"
                          mix={css({ margin: 0, padding: 0, display: 'inline-flex' })}
                        >
                          <CsrfTokenInput />
                          <GridStateHiddenInputs
                            state={{
                              offset: String(offset),
                              sort: sortField ?? '',
                              order: sortOrder,
                              filter: filter ?? '',
                            }}
                          />
                          <button
                            type="submit"
                            mix={[button({ tone: 'secondary' }), smallBtnStyle]}
                          >
                            {row.status === 'Active' ? 'Deactivate' : 'Activate'}
                          </button>
                        </form>
                        <form
                          method="POST"
                          action={`/admin/clients/${row.id}`}
                          data-rmx-target="admin-content"
                          data-delete-form={row.id}
                          data-confirm="Delete this row?"
                        >
                          <CsrfTokenInput />
                          <input type="hidden" name="_method" value="DELETE" />
                          <GridStateHiddenInputs
                            state={{
                              offset: String(offset),
                              sort: sortField ?? '',
                              order: sortOrder,
                              filter: filter ?? '',
                            }}
                          />
                          <button type="submit" mix={[button({ tone: 'danger' }), smallBtnStyle]}>
                            Del
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination bar */}
            <div mix={paginationBarStyle}>
              <span mix={paginationInfoStyle}>
                {pageStart}–{pageEnd} of {hasNext ? `${pageEnd}+` : pageEnd}
              </span>
              <div mix={paginationBtnGroupStyle}>
                <a
                  href={buildPaginationUrl(
                    offset - pageSize,
                    sortField,
                    sortOrder,
                    filter,
                    editingId,
                  )}
                  data-rmx-target="admin-content"
                  mix={css({ textDecoration: 'none' }) }
                >
                  <button disabled={!hasPrev} mix={[button({ tone: 'secondary' }), smallBtnStyle]}>
                    ← Prev
                  </button>
                </a>
                <a
                  href={buildPaginationUrl(
                    offset + pageSize,
                    sortField,
                    sortOrder,
                    filter,
                    editingId,
                  )}
                  data-rmx-target="admin-content"
                  mix={css({ textDecoration: 'none' }) }
                >
                  <button disabled={!hasNext} mix={[button({ tone: 'secondary' }), smallBtnStyle]}>
                    Next →
                  </button>
                </a>
              </div>
            </div>
          </>
        )}

        {/* Context menu data and clientEntry */}
        <script id="clients-grid-state" type="application/json" nonce={getCspNonce()}>
          {JSON.stringify({
            offset: String(offset),
            sort: sortField ?? '',
            order: sortOrder,
            filter: filter ?? '',
            baseHref: routes.admin.clients.index.href(),
          })}
        </script>
        <ClientsContextMenu />
      </div>
    )
  }
}

export { ClientGridPage }
