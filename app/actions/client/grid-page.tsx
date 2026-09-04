import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../../ui/theme/theme.ts'
import { rotatedGlyphCss } from '../../ui/mixins/icon.ts'
import button from '../../ui/theme/button.ts'
import { Glyph } from '../../ui/theme/glyph/glyph.tsx'

import type { Client } from '../../data/schema.ts'
import { FrameRefreshButton } from './public/grid-refresh-button.tsx'
import { ConfirmDelete } from '../../ui/confirm-delete.browser.tsx'
import { routes } from '../../routes.ts'
import { getSelfFrameTarget } from '../../utils/frame-target.ts'
import { RestfulForm } from '../../ui/restful-form.tsx'
import { GridStateHiddenInputs } from '../../ui/grid-state-hidden.tsx'
import { table } from '../../ui/mixins/admin-table.ts'
import {
  sortArrow,
  buildSortUrl,
  buildPaginationUrl,
  buildCreateUrl,
  buildEditUrl,
  buildFilterParams,
} from '../../ui/mixins/admin-urls.ts'
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
  filter?: string | undefined
  pageSize?: number
  editingId?: number | null
}

const ADMIN_BASE = routes.admin.clients.index.href()

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const smallBtnStyle = css({
  minHeight: '1.75rem',
  paddingInline: '0.5rem',
  fontSize: '0.75rem',
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

// Segmented button group for the row actions.
const actionGroup = css({
  display: 'inline-flex',
  alignItems: 'stretch',
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  overflow: 'hidden',
  boxShadow: theme.shadow.sm,
})

const actionSeg = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  padding: `${theme.space.xs} ${theme.space.sm}`,
  minHeight: '26px',
  background: theme.surface.lvl2,
  color: theme.colors.text.secondary,
  borderTop: 'none',
  borderBottom: 'none',
  borderLeft: 'none',
  borderRight: `1px solid ${theme.colors.border.default}`,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  cursor: 'pointer',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  '&:hover': { background: theme.surface.lvl3, color: theme.colors.text.primary },
})

const actionSegDanger = css({
  background: theme.colors.action.danger.background,
  color: theme.colors.action.danger.foreground,
  borderRight: 'none',
  '&:hover': {
    background: theme.colors.action.danger.background,
    color: theme.colors.action.danger.foreground,
    opacity: 0.9,
  },
})

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function sortRule(
  field: string,
  sortField: string,
  sortOrder: 'asc' | 'desc',
): 'ascending' | 'descending' | undefined {
  if (field !== sortField) return undefined
  return sortOrder === 'asc' ? 'ascending' : 'descending'
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

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
      pageSize = 15,
      editingId,
    } = handle.props
    let sortCol = sortField ?? 'id'
    let pageStart = rows.length > 0 ? offset + 1 : 0
    let pageEnd = offset + rows.length
    let currentPage = pageSize > 0 ? Math.floor(offset / pageSize) + 1 : 0
    let isStatusFilter = filter === 'active' || filter === 'inactive'

    // Shared grid state carried across row actions / tab filter links.
    let gridState = {
      offset: String(offset),
      sort: sortCol,
      order: sortOrder,
      filter: filter ?? '',
    }

    return (
      <div id="client-grid-content">
        <ConfirmDelete />

        {/* Toolbar + Filter bar (single GET form → frame navigation) */}
        <form
          method="GET"
          action={ADMIN_BASE}
          data-rmx-target={getSelfFrameTarget()}
          data-rmx-history="replace"
          mix={table.filterBar}
        >
          <div mix={table.filterGroup}>
            <a
              href={ADMIN_BASE + '?' + buildFilterParams('', sortCol, sortOrder, offset)}
              data-rmx-target={getSelfFrameTarget()}
              mix={[table.filterTab, !isStatusFilter ? table.filterTabActive : undefined]}
            >
              Alle
            </a>
            <a
              href={ADMIN_BASE + '?' + buildFilterParams('active', sortCol, sortOrder, offset)}
              data-rmx-target={getSelfFrameTarget()}
              mix={[table.filterTab, filter === 'active' ? table.filterTabActive : undefined]}
            >
              Aktiv
            </a>
            <a
              href={ADMIN_BASE + '?' + buildFilterParams('inactive', sortCol, sortOrder, offset)}
              data-rmx-target={getSelfFrameTarget()}
              mix={[table.filterTab, filter === 'inactive' ? table.filterTabActive : undefined]}
            >
              Inaktiv
            </a>
          </div>
          <input
            type="text"
            name="filter"
            placeholder="Search by name or email..."
            defaultValue={filter && !isStatusFilter ? filter : ''}
            aria-label="Nach Name oder E-Mail suchen"
            mix={table.filterInput}
          />
          <button type="submit" mix={table.searchBtn}>
            <Glyph name="search" width={14} height={14} /> Search
          </button>
          {filter && !isStatusFilter ? (
            <a href={ADMIN_BASE} mix={table.clearLink}>
              Clear
            </a>
          ) : null}
          <span mix={table.spacer} />
          {editingId ? <input type="hidden" name="editing" value={editingId} /> : null}
          <FrameRefreshButton />
          <a
            href={buildCreateUrl(ADMIN_BASE, offset, sortCol, sortOrder, filter)}
            data-rmx-document
            mix={table.linkPlain}
          >
            <button mix={[button({ tone: 'primary' }), smallBtnStyle]}>
              <Glyph name="add" width={14} height={14} /> Add New
            </button>
          </a>
        </form>

        {/* Table */}
        {rows.length === 0 ? (
          <div mix={table.wrap}>
            <div mix={table.empty}>
              {filter ? 'No client records match your filter.' : 'No client records found.'}
            </div>
          </div>
        ) : (
          <div mix={table.wrap} data-clients-table-wrap="true">
            <table mix={table.table} data-clients-table="true">
              <colgroup>
                <col mix={css({ width: '60px' })} />
                <col />
                <col />
                <col mix={css({ width: '90px' })} />
                <col mix={css({ width: '100px' })} />
                <col mix={css({ width: '110px' })} />
                <col mix={css({ width: '220px' })} />
              </colgroup>
              <thead>
                <tr>
                  <th mix={table.thSortable} aria-sort={sortRule('id', sortCol, sortOrder)}>
                    <a
                      href={buildSortUrl(ADMIN_BASE, 'id', sortCol, sortOrder, offset, filter)}
                      data-rmx-target={getSelfFrameTarget()}
                      mix={table.sortLink}
                    >
                      ID
                      <span mix={'id' === sortCol ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('id', sortCol, sortOrder)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.thSortable} aria-sort={sortRule('name', sortCol, sortOrder)}>
                    <a
                      href={buildSortUrl(ADMIN_BASE, 'name', sortCol, sortOrder, offset, filter)}
                      data-rmx-target={getSelfFrameTarget()}
                      mix={table.sortLink}
                    >
                      Name
                      <span mix={'name' === sortCol ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('name', sortCol, sortOrder)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.thSortable} aria-sort={sortRule('email', sortCol, sortOrder)}>
                    <a
                      href={buildSortUrl(ADMIN_BASE, 'email', sortCol, sortOrder, offset, filter)}
                      data-rmx-target={getSelfFrameTarget()}
                      mix={table.sortLink}
                    >
                      Email
                      <span mix={'email' === sortCol ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('email', sortCol, sortOrder)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.thSortable} aria-sort={sortRule('role', sortCol, sortOrder)}>
                    <a
                      href={buildSortUrl(ADMIN_BASE, 'role', sortCol, sortOrder, offset, filter)}
                      data-rmx-target={getSelfFrameTarget()}
                      mix={table.sortLink}
                    >
                      Role
                      <span mix={'role' === sortCol ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('role', sortCol, sortOrder)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.thSortable} aria-sort={sortRule('status', sortCol, sortOrder)}>
                    <a
                      href={buildSortUrl(ADMIN_BASE, 'status', sortCol, sortOrder, offset, filter)}
                      data-rmx-target={getSelfFrameTarget()}
                      mix={table.sortLink}
                    >
                      Status
                      <span mix={'status' === sortCol ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('status', sortCol, sortOrder)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.thSortable} aria-sort={sortRule('registered', sortCol, sortOrder)}>
                    <a
                      href={buildSortUrl(
                        ADMIN_BASE,
                        'registered',
                        sortCol,
                        sortOrder,
                        offset,
                        filter,
                      )}
                      data-rmx-target={getSelfFrameTarget()}
                      mix={table.sortLink}
                    >
                      Reg.
                      <span
                        mix={'registered' === sortCol ? table.sortArrowActive : table.sortArrow}
                      >
                        {sortArrow('registered', sortCol, sortOrder)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    data-row-id={row.id}
                    data-status={row.status}
                    mix={[table.row, editingId === row.id ? table.editingRow : undefined]}
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
                          row.status === 'Active'
                            ? table.statusBadgeActive
                            : table.statusBadgeDisabled,
                        ]}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td mix={table.td} title={formatDate(row.registered as number)}>
                      {formatDate(row.registered as number)}
                    </td>
                    <td mix={table.actionCell}>
                      <div mix={actionGroup}>
                        <a
                          href={buildEditUrl(
                            ADMIN_BASE,
                            row.id,
                            offset,
                            sortCol,
                            sortOrder,
                            filter,
                          )}
                          data-rmx-target={getSelfFrameTarget()}
                          title="Edit"
                          mix={actionSeg}
                        >
                          <Glyph name="edit" width={13} height={13} /> Edit
                        </a>
                        <RestfulForm
                          method="POST"
                          action={routes.admin.clients.toggleStatus.href({ id: row.id })}
                          data-toggle-form={row.id}
                          data-rmx-target={getSelfFrameTarget()}
                          mix={css({ margin: 0, padding: 0, display: 'inline-flex' })}
                        >
                          <GridStateHiddenInputs state={gridState} />
                          <button
                            type="submit"
                            title={row.status === 'Active' ? 'Deactivate' : 'Activate'}
                            mix={actionSeg}
                          >
                            {row.status === 'Active' ? 'Deactivate' : 'Activate'}
                          </button>
                        </RestfulForm>
                        <RestfulForm
                          method="DELETE"
                          action={routes.admin.clients.destroy.href({ id: row.id })}
                          data-delete-form={row.id}
                          data-confirm="Delete this row?"
                          data-rmx-target={getSelfFrameTarget()}
                          mix={css({ margin: 0, padding: 0, display: 'inline-flex' })}
                        >
                          <GridStateHiddenInputs state={gridState} />
                          <button type="submit" title="Delete" mix={[actionSeg, actionSegDanger]}>
                            <Glyph name="trash" width={13} height={13} /> Del
                          </button>
                        </RestfulForm>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {(offset > 0 || hasNext) && (
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
              {hasPrev ? (
                <a
                  href={buildPaginationUrl(
                    ADMIN_BASE,
                    offset - pageSize,
                    sortCol,
                    sortOrder,
                    filter,
                  )}
                  data-rmx-target={getSelfFrameTarget()}
                  mix={table.pageLink}
                >
                  <Glyph name="chevronRight" width={14} height={14} mix={rotatedGlyphCss} /> Prev
                </a>
              ) : (
                <span mix={table.pageLinkDisabled}>
                  <Glyph name="chevronRight" width={14} height={14} mix={rotatedGlyphCss} /> Prev
                </span>
              )}
              {hasNext ? (
                <a
                  href={buildPaginationUrl(
                    ADMIN_BASE,
                    offset + pageSize,
                    sortCol,
                    sortOrder,
                    filter,
                  )}
                  data-rmx-target={getSelfFrameTarget()}
                  mix={table.pageLink}
                >
                  Next <Glyph name="chevronRight" width={14} height={14} />
                </a>
              ) : (
                <span mix={table.pageLinkDisabled}>
                  Next <Glyph name="chevronRight" width={14} height={14} />
                </span>
              )}
            </div>
          </div>
        )}

        {/* Context menu data and clientEntry */}
        <script id="clients-grid-state" type="application/json" nonce={getCspNonce()}>
          {JSON.stringify({
            offset: String(offset),
            sort: sortCol,
            order: sortOrder,
            filter: filter ?? '',
            baseHref: ADMIN_BASE,
          })}
        </script>
        <ClientsContextMenu />
      </div>
    )
  }
}

export { ClientGridPage }
