import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { Button } from 'remix/ui/button'
import { Glyph } from 'remix/ui/glyph'
import { animateEntrance } from 'remix/ui/animation'
import { input } from './mixins/input.ts'

import { frames } from '../routes.ts'
import type { Resource } from '../data/schema.ts'
import { RestfulForm } from './restful-form.tsx'
import { GridStateHiddenInputs } from './grid-state-hidden.tsx'
import { gridStateToParams } from '../utils/grid-state.ts'

interface AdminResourcesPageProps {
  rows: Resource[]
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
  editRow?: Resource | null
  creating?: boolean
}

// ── Helpers ──

function sortArrow(field: string, sortField: string, sortOrder: 'asc' | 'desc'): string {
  if (field !== sortField) return '\u2195'
  return sortOrder === 'asc' ? '\u2191' : '\u2193'
}

function buildSortUrl(
  field: string, currentSort: string, currentOrder: 'asc' | 'desc',
  offset: number, filter?: string,
): string {
  let newOrder = field === currentSort ? (currentOrder === 'asc' ? 'desc' : 'asc') : 'asc'
  let params = new URLSearchParams()
  params.set('offset', '0')
  params.set('sort', field)
  params.set('order', newOrder)
  if (filter) params.set('filter', filter)
  return '/admin/resources?' + params.toString()
}

function buildPaginationUrl(
  newOffset: number, sort: string, order: 'asc' | 'desc', filter?: string,
): string {
  let params = new URLSearchParams()
  params.set('offset', String(newOffset))
  params.set('sort', sort)
  params.set('order', order)
  if (filter) params.set('filter', filter)
  return '/admin/resources?' + params.toString()
}

function buildCreateUrl(offset: number, sort: string, order: string, filter?: string): string {
  let params = new URLSearchParams()
  params.set('creating', 'true')
  if (offset > 0) params.set('offset', String(offset))
  params.set('sort', sort)
  params.set('order', order)
  if (filter) params.set('filter', filter)
  return '/admin/resources?' + params.toString()
}

function buildEditUrl(id: string | number, offset: number, sort: string, order: string, filter?: string): string {
  let params = new URLSearchParams()
  params.set('editing', String(id))
  params.set('offset', String(offset))
  params.set('sort', sort)
  params.set('order', order)
  if (filter) params.set('filter', filter)
  return '/admin/resources?' + params.toString()
}

function formatTimestamp(ts: number | string | null | undefined): string {
  if (ts == null) return '\u2014'
  return new Date(Number(ts)).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Styles ──

const pageStyle = css({ maxWidth: '1000px' })
const titleStyle = css({
  margin: 0, fontSize: theme.fontSize.xxl, fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

const filterBarStyle = css({
  display: 'flex', alignItems: 'center', gap: theme.space.sm, marginBottom: theme.space.md,
})
const filterInputStyle = css({
  flex: '1', maxWidth: '300px', padding: `${theme.space.xs} ${theme.space.sm}`,
  fontSize: theme.fontSize.sm, border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md, background: theme.surface.lvl0, color: theme.colors.text.primary,
  outline: 'none',
  '&:focus': {
    borderColor: theme.colors.action.primary.background,
    boxShadow: `0 0 0 2px ${theme.colors.focus.ring}`,
  },
  '&::placeholder': { color: theme.colors.text.muted },
})
const searchBtnStyle = css({
  padding: `${theme.space.xs} ${theme.space.md}`,
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  border: 'none', borderRadius: theme.radius.md, fontSize: theme.fontSize.sm, cursor: 'pointer',
  '&:hover': { opacity: 0.9 },
})
const clearLinkStyle = css({
  fontSize: theme.fontSize.xs, color: theme.colors.text.muted, textDecoration: 'none',
  '&:hover': { color: theme.colors.text.primary, textDecoration: 'underline' },
})
const tableWrapStyle = css({
  marginBottom: theme.space.xl, background: theme.surface.lvl1,
  borderRadius: theme.radius.lg, border: `1px solid ${theme.colors.border.default}`, overflowX: 'auto',
})
const tableStyle = css({
  width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: theme.fontSize.sm,
})
const thStyle = css({
  textAlign: 'left', padding: `${theme.space.sm} ${theme.space.md}`,
  background: theme.surface.lvl2, borderBottom: `1px solid ${theme.colors.border.default}`,
  whiteSpace: 'nowrap', fontWeight: theme.fontWeight.semibold,
  fontSize: theme.fontSize.xs, textTransform: 'uppercase', letterSpacing: '0.06em',
  color: theme.colors.text.secondary,
})
const thSortableStyle = css({
  textAlign: 'left', padding: `${theme.space.sm} ${theme.space.md}`,
  background: theme.surface.lvl2, borderBottom: `1px solid ${theme.colors.border.default}`,
  whiteSpace: 'nowrap',
})
const sortLinkStyle = css({
  color: theme.colors.text.secondary, textDecoration: 'none', display: 'inline-flex',
  alignItems: 'center', gap: '4px', fontWeight: theme.fontWeight.semibold,
  fontSize: theme.fontSize.xs, textTransform: 'uppercase', letterSpacing: '0.06em',
  '&:hover': { color: theme.colors.text.primary },
})
const sortArrowStyle = css({
  display: 'inline-block', fontSize: '0.7rem', lineHeight: '1', color: theme.colors.text.muted,
})
const sortArrowActiveStyle = css({
  display: 'inline-block', fontSize: '0.8rem', lineHeight: '1',
  color: theme.colors.action.primary.background, fontWeight: theme.fontWeight.bold,
})
const tdStyle = css({
  padding: `${theme.space.sm} ${theme.space.md}`,
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
  color: theme.colors.text.primary, verticalAlign: 'middle',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
})
const actionCellStyle = css({
  padding: `${theme.space.sm} ${theme.space.md}`,
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
  whiteSpace: 'nowrap', textAlign: 'right',
})
const btnGroupStyle = css({
  display: 'inline-flex', alignItems: 'stretch',
})
const editBtnStyle = css({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  padding: theme.space.xs, minWidth: '28px', minHeight: '28px',
  background: theme.surface.lvl2, color: theme.colors.text.secondary,
  border: `1px solid ${theme.colors.border.default}`,
  borderRight: 'none',
  borderRadius: `${theme.radius.md} 0 0 ${theme.radius.md}`,
  fontSize: theme.fontSize.xs, textDecoration: 'none', cursor: 'pointer',
  '&:hover': { background: theme.surface.lvl3, color: theme.colors.text.primary },
})
const delBtnStyle = css({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  padding: theme.space.xs, minWidth: '28px', minHeight: '28px',
  background: theme.colors.action.danger.background, color: theme.colors.action.danger.foreground,
  border: 'none',
  borderRadius: `0 ${theme.radius.md} ${theme.radius.md} 0`,
  fontSize: theme.fontSize.xs, cursor: 'pointer',
  '&:hover': { opacity: 0.9 },
})
const emptyStateStyle = css({
  textAlign: 'center', padding: theme.space.xxl, color: theme.colors.text.muted,
})
const paginationStyle = css({
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: theme.space.md, background: theme.surface.lvl0,
  borderRadius: theme.radius.md, border: `1px solid ${theme.colors.border.default}`,
})
const paginationInfoStyle = css({
  fontSize: theme.fontSize.sm, color: theme.colors.text.muted,
})
const pageLinkStyle = css({
  padding: `${theme.space.sm} ${theme.space.md}`, background: theme.surface.lvl2,
  color: theme.colors.text.secondary, borderRadius: theme.radius.md,
  fontSize: theme.fontSize.sm, textDecoration: 'none',
  '&:hover': { background: theme.surface.lvl3, color: theme.colors.text.primary },
})
const pageLinkDisabledStyle = css({
  padding: `${theme.space.sm} ${theme.space.md}`, borderRadius: theme.radius.md,
  fontSize: theme.fontSize.sm, opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none',
})
const rowStyle = css({
  '&:nth-child(even)': { background: theme.surface.lvl0 },
  '&:hover': { background: theme.surface.lvl3 },
})
const twoColumnStyle = css({
  display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px', alignItems: 'start',
})

// ── Inline Edit Panel Styles ──

const panelStyle = css({
  background: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.lg,
  overflow: 'hidden',
})
const panelHeaderStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  padding: `${theme.space.md} ${theme.space.lg}`,
  borderBottom: `1px solid ${theme.colors.border.default}`,
  background: theme.surface.lvl2,
})
const panelTitleStyle = css({
  fontSize: theme.fontSize.md,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})
const panelBodyStyle = css({
  padding: theme.space.lg,
})
const fieldGroupStyle = css({
  marginBottom: theme.space.md,
})
const labelStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '3px',
  marginBottom: theme.space.xs,
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.secondary,
})
const actionsStyle = css({
  display: 'flex',
  gap: theme.space.sm,
  marginTop: theme.space.lg,
  paddingTop: theme.space.md,
  borderTop: `1px solid ${theme.colors.border.default}`,
})

// ── Component ──

export function AdminResourcesPage(handle: Handle<AdminResourcesPageProps>) {
  return () => {
    let {
      rows, offset, hasMore, prevOffset, nextOffset,
      sortColumn, sortDirection, filter,
      editRow = null, creating = false,
    } = handle.props
    let pageStart = rows.length > 0 ? offset + 1 : 0
    let pageEnd = offset + rows.length

    let gridSection = (
      <div style="min-width:0">
        {/* Toolbar + Filter */}
        <form
          method="GET"
          action="/admin/resources"
          rmx-target={frames.adminContent}
          mix={filterBarStyle}
        >
          <input
            type="text"
            name="filter"
            placeholder="Suche nach Beschreibung..."
            defaultValue={filter ?? ''}
            mix={filterInputStyle}
          />
          <button type="submit" mix={searchBtnStyle}>Suchen</button>
          {filter && (
            <a
              href="/admin/resources"
              rmx-target={frames.adminContent}
              mix={clearLinkStyle}
            >
              Zurücksetzen
            </a>
          )}
          <span style="flex:1" />
          <a
            href={buildCreateUrl(offset, sortColumn, sortDirection, filter)}
            rmx-target={frames.adminContent}
            style={{ textDecoration: 'none' }}
          >
            <Button tone="primary">+ Add New</Button>
          </a>
        </form>

        {/* Table */}
        <div mix={tableWrapStyle}>
          {rows.length === 0 ? (
            <div mix={emptyStateStyle}>
              {filter
                ? 'Keine Ressourcen gefunden für diese Suche.'
                : 'Keine Ressourcen vorhanden.'}
            </div>
          ) : (
            <table mix={tableStyle}>
              <colgroup>
                <col style={{ width: '60px' }} />
                <col />
                <col style={{ width: '160px' }} />
                <col style={{ width: '160px' }} />
                <col style={{ width: '100px' }} />
              </colgroup>
              <thead>
                <tr>
                  <th mix={thSortableStyle}>
                    <a href={buildSortUrl('id', sortColumn, sortDirection, offset, filter)}
                       rmx-target={frames.adminContent} mix={sortLinkStyle}>
                      ID
                      <span mix={'id' === sortColumn ? sortArrowActiveStyle : sortArrowStyle}>
                        {sortArrow('id', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={thSortableStyle}>
                    <a href={buildSortUrl('description', sortColumn, sortDirection, offset, filter)}
                       rmx-target={frames.adminContent} mix={sortLinkStyle}>
                      Beschreibung
                      <span mix={'description' === sortColumn ? sortArrowActiveStyle : sortArrowStyle}>
                        {sortArrow('description', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={thSortableStyle}>
                    <a href={buildSortUrl('created_at', sortColumn, sortDirection, offset, filter)}
                       rmx-target={frames.adminContent} mix={sortLinkStyle}>
                      Erstellt
                      <span mix={'created_at' === sortColumn ? sortArrowActiveStyle : sortArrowStyle}>
                        {sortArrow('created_at', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={thSortableStyle}>
                    <a href={buildSortUrl('updated_at', sortColumn, sortDirection, offset, filter)}
                       rmx-target={frames.adminContent} mix={sortLinkStyle}>
                      Aktualisiert
                      <span mix={'updated_at' === sortColumn ? sortArrowActiveStyle : sortArrowStyle}>
                        {sortArrow('updated_at', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={thStyle} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} mix={rowStyle} data-row-id={row.id}>
                    <td mix={tdStyle} title={String(row.id)}>{row.id}</td>
                    <td mix={tdStyle} title={row.description}>{row.description}</td>
                    <td mix={tdStyle} title={formatTimestamp(row.created_at as number)}>{formatTimestamp(row.created_at as number)}</td>
                    <td mix={tdStyle} title={formatTimestamp(row.updated_at as number)}>{formatTimestamp(row.updated_at as number)}</td>
                    <td mix={actionCellStyle}>
                      <div mix={btnGroupStyle}>
                        <a
                          href={buildEditUrl(row.id!, offset, sortColumn, sortDirection, filter)}
                          rmx-target={frames.adminContent}
                          mix={editBtnStyle}
                        >
                          <Glyph name="edit" width={14} height={14} />
                        </a>
                        <RestfulForm
                          method="DELETE"
                          action={`/admin/resources/${row.id}`}
                          style="display:inline"
                        >
                          <GridStateHiddenInputs
                            state={{
                              offset: String(offset),
                              sort: sortColumn,
                              order: sortDirection,
                              filter: filter ?? '',
                            }}
                          />
                          <button type="submit" mix={delBtnStyle}>
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
          <div mix={paginationStyle}>
            {rows.length > 0 && (
              <span mix={paginationInfoStyle}>Zeige {pageStart}–{pageEnd}</span>
            )}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {offset > 0 ? (
                <a
                  href={buildPaginationUrl(prevOffset, sortColumn, sortDirection, filter)}
                  rmx-target={frames.adminContent}
                  mix={pageLinkStyle}
                ><Glyph name="chevronRight" width={14} height={14} style={{ transform: 'rotate(180deg)' }} /> Zurück</a>
              ) : (
                <span mix={pageLinkDisabledStyle}><Glyph name="chevronRight" width={14} height={14} style={{ transform: 'rotate(180deg)' }} /> Zurück</span>
              )}
              {hasMore ? (
                <a
                  href={buildPaginationUrl(nextOffset, sortColumn, sortDirection, filter)}
                  rmx-target={frames.adminContent}
                  mix={pageLinkStyle}
                >Weiter <Glyph name="chevronRight" width={14} height={14} /></a>
              ) : (
                <span mix={pageLinkDisabledStyle}>Weiter <Glyph name="chevronRight" width={14} height={14} /></span>
              )}
            </div>
          </div>
        )}
      </div>
    )

    // Two-column layout when editing or creating
    if (editRow || creating) {
      return (
        <div mix={pageStyle}>
          <h2 mix={titleStyle}>Resources</h2>
          <div mix={twoColumnStyle}>
            {gridSection}
            <div style="position:sticky;top:1.5rem">
              {editRow ? (
                <AdminResourcesEditPanel
                  row={editRow}
                  offset={String(offset)}
                  sort={sortColumn}
                  order={sortDirection}
                  filter={filter}
                />
              ) : (
                <AdminResourcesCreatePanel
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
      <div mix={pageStyle}>
        <h2 mix={titleStyle}>Resources</h2>
        {gridSection}
      </div>
    )
  }
}

// ── Inline Edit Panel ──

function cancelUrl(offset: string, sort: string, order: string, filter?: string): string {
  let qs = gridStateToParams({ offset, sort, order, filter: filter ?? '' }).toString()
  return '/admin/resources' + (qs ? '?' + qs : '')
}

interface EditPanelProps {
  row: Resource
  offset?: string
  sort?: string
  order?: string
  filter?: string
}

function AdminResourcesEditPanel(handle: Handle<EditPanelProps>) {
  return () => {
    let { row, offset = '', sort = '', order = '', filter = '' } = handle.props
    return (
      <div mix={animateEntrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 })}>
        <RestfulForm method="PUT" action={`/admin/resources/${row.id}`}>
          <GridStateHiddenInputs state={{ offset, sort, order, filter }} />

          <div mix={panelStyle}>
            <div mix={panelHeaderStyle}>
              <span mix={panelTitleStyle}>Ressource bearbeiten</span>
            </div>

            <div mix={panelBodyStyle}>
              <div mix={fieldGroupStyle}>
                <label mix={labelStyle} htmlFor="ar-desc">Beschreibung</label>
                <input
                  id="ar-desc"
                  name="description"
                  type="text"
                  value={row.description ?? ''}
                  mix={[input.base, input.focus]}
                />
              </div>

              <div mix={actionsStyle}>
                <Button type="submit" tone="primary" mix={css({ flex: 1 })}>
                  Speichern
                </Button>
                <a href={cancelUrl(offset, sort, order, filter)} style={{ flex: 1, textDecoration: 'none' }}>
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

function AdminResourcesCreatePanel(handle: Handle<CreatePanelProps>) {
  return () => {
    let { offset = '', sort = '', order = '', filter = '' } = handle.props
    return (
      <div mix={animateEntrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 })}>
        <RestfulForm method="POST" action="/admin/resources">
          <GridStateHiddenInputs state={{ offset, sort, order, filter }} />

          <div mix={panelStyle}>
            <div mix={panelHeaderStyle}>
              <span mix={panelTitleStyle}>Neue Ressource</span>
            </div>

            <div mix={panelBodyStyle}>
              <div mix={fieldGroupStyle}>
                <label mix={labelStyle} htmlFor="ar-desc-c">Beschreibung</label>
                <input
                  id="ar-desc-c"
                  name="description"
                  type="text"
                  required
                  mix={[input.base, input.focus]}
                />
              </div>

              <div mix={actionsStyle}>
                <Button type="submit" tone="primary" mix={css({ flex: 1 })}>
                  Anlegen
                </Button>
                <a href={cancelUrl(offset, sort, order, filter)} style={{ flex: 1, textDecoration: 'none' }}>
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
