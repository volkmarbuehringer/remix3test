import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { Button } from 'remix/ui/button'
import { Glyph } from 'remix/ui/glyph'
import { animateEntrance } from 'remix/ui/animation'
import { input } from './mixins/input.ts'
import { table } from './mixins/admin-table.ts'
import { sortArrow, buildSortUrl, buildPaginationUrl, buildCreateUrl, buildEditUrl, formatTimestamp } from './mixins/admin-urls.ts'

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

const ADMIN_BASE = '/admin/resources'

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
          mix={table.filterBar}
        >
          <input
            type="text"
            name="filter"
            placeholder="Suche nach Beschreibung..."
            defaultValue={filter ?? ''}
            mix={table.filterInput}
          />
          <button type="submit" mix={table.searchBtn}>Suchen</button>
          {filter && (
            <a
              href="/admin/resources"
              rmx-target={frames.adminContent}
              mix={table.clearLink}
            >
              Zurücksetzen
            </a>
          )}
          <span style="flex:1" />
          <a
            href={buildCreateUrl(ADMIN_BASE, offset, sortColumn, sortDirection, filter)}
            rmx-target={frames.adminContent}
            style={{ textDecoration: 'none' }}
          >
            <Button tone="primary">+ Add New</Button>
          </a>
        </form>

        {/* Table */}
        <div mix={table.wrap}>
          {rows.length === 0 ? (
            <div mix={table.empty}>
              {filter
                ? 'Keine Ressourcen gefunden für diese Suche.'
                : 'Keine Ressourcen vorhanden.'}
            </div>
          ) : (
            <table mix={table.table}>
              <colgroup>
                <col style={{ width: '60px' }} />
                <col />
                <col style={{ width: '160px' }} />
                <col style={{ width: '160px' }} />
                <col style={{ width: '100px' }} />
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
                    <a href={buildSortUrl(ADMIN_BASE, 'description', sortColumn, sortDirection, offset, filter)}
                       rmx-target={frames.adminContent} mix={table.sortLink}>
                      Beschreibung
                      <span mix={'description' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('description', sortColumn, sortDirection)}
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
                  <th mix={table.thSortable}>
                    <a href={buildSortUrl(ADMIN_BASE, 'updated_at', sortColumn, sortDirection, offset, filter)}
                       rmx-target={frames.adminContent} mix={table.sortLink}>
                      Aktualisiert
                      <span mix={'updated_at' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('updated_at', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.th} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} mix={table.row} data-row-id={row.id}>
                    <td mix={table.td} title={String(row.id)}>{row.id}</td>
                    <td mix={table.td} title={row.description}>{row.description}</td>
                    <td mix={table.td} title={formatTimestamp(row.created_at as number)}>{formatTimestamp(row.created_at as number)}</td>
                    <td mix={table.td} title={formatTimestamp(row.updated_at as number)}>{formatTimestamp(row.updated_at as number)}</td>
                    <td mix={table.actionCell}>
                      <div mix={table.btnGroup}>
                        <a
                          href={buildEditUrl(ADMIN_BASE, row.id!, offset, sortColumn, sortDirection, filter)}
                          rmx-target={frames.adminContent}
                          mix={table.editBtn}
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
                          <button type="submit" mix={table.delBtn}>
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
            {rows.length > 0 && (
              <span mix={table.paginationInfo}>Zeige {pageStart}–{pageEnd}</span>
            )}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
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
      </div>
    )

    // Two-column layout when editing or creating
    if (editRow || creating) {
      return (
        <div mix={table.page}>
          <h2 mix={table.title}>Resources</h2>
          <div mix={table.twoColumn}>
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
      <div mix={table.page}>
        <h2 mix={table.title}>Resources</h2>
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

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={table.panelTitle}>Ressource bearbeiten</span>
            </div>

            <div mix={table.panelBody}>
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="ar-desc">Beschreibung</label>
                <input
                  id="ar-desc"
                  name="description"
                  type="text"
                  value={row.description ?? ''}
                  mix={[input.base, input.focus]}
                />
              </div>

              <div mix={table.actions}>
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

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={table.panelTitle}>Neue Ressource</span>
            </div>

            <div mix={table.panelBody}>
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="ar-desc-c">Beschreibung</label>
                <input
                  id="ar-desc-c"
                  name="description"
                  type="text"
                  required
                  mix={[input.base, input.focus]}
                />
              </div>

              <div mix={table.actions}>
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
