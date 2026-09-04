import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'
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
  formatTimestamp,
} from './mixins/admin-urls.ts'

const ADMIN_BASE = routes.admin.lists.index.href()

export interface ListRowData {
  id: number
  title: string
  list: Array<{ id: string; label: string }>
  description: string
  created_at: number
  updated_at: number
}

interface AdminListsPageProps {
  lists: ListRowData[]
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
  editRow?: ListRowData | null
  creating?: boolean
  pageSize: number
  formValues?: Record<string, string> | undefined
  fieldErrors?: Record<string, string> | undefined
  formError?: string | undefined
}

function formatPreview(items: Array<{ label: string }>): string {
  if (!Array.isArray(items) || items.length === 0) return '(leer)'
  let labels = items.map((i) => i.label)
  if (labels.length <= 5) return labels.join(', ')
  return labels.slice(0, 5).join(', ') + ' (+' + (labels.length - 5) + ' weitere)'
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
  border: '1px solid ' + theme.colors.border.default,
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

const previewTextStyle = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.secondary,
  lineHeight: 1.5,
  maxWidth: '280px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
})

const detailsStyle = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.secondary,
  marginTop: theme.space.sm,
  padding: theme.space.sm,
  background: theme.surface.lvl0,
  borderRadius: theme.radius.md,
  border: '1px solid ' + theme.colors.border.subtle,
  lineHeight: 1.6,
})

const summaryStyle = css({
  cursor: 'pointer',
  color: theme.colors.action.primary.background,
  fontWeight: theme.fontWeight.medium,
  fontSize: theme.fontSize.xs,
})

const descLinkStyle = css({
  color: theme.colors.action.primary.background,
  fontWeight: theme.fontWeight.medium,
  textDecoration: 'none',
  fontSize: theme.fontSize.sm,
  display: 'block',
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

const colItemsWidth = css({ width: '60px' })
const colDescWidth = css({ width: '200px' })
const colUpdatedWidth = css({ width: '155px' })
const colActionsWidth = css({ width: '120px' })

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

// Component

export function AdminListsPage(handle: Handle<AdminListsPageProps>) {
  return () => {
    let {
      lists,
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
    let pageStart = lists.length > 0 ? offset + 1 : 0
    let pageEnd = offset + lists.length
    let hasFormPanel = Boolean(editRow || creating)

    let gridSection = (
      <div mix={table.minWidth0}>
        <ConfirmDelete />

        <form
          method="GET"
          action={routes.admin.lists.index.href()}
          data-rmx-target={getSelfFrameTarget()}
          data-rmx-history="replace"
          mix={table.filterBar}
        >
          <input
            type="text"
            name="filter"
            placeholder="Nach Element oder Beschreibung suchen…"
            defaultValue={filter ?? ''}
            aria-label="Nach Element oder Beschreibung suchen"
            mix={table.filterInput}
          />
          <input type="hidden" name="sort" value={sortColumn} />
          <input type="hidden" name="order" value={sortDirection} />
          <button type="submit" mix={table.searchBtn}>
            <Glyph name="search" width={14} height={14} /> Suchen
          </button>
          {filter && (
            <a href={routes.admin.lists.index.href()} mix={table.clearLink}>
              Zurücksetzen
            </a>
          )}
          <span mix={table.spacer} />
          <a
            href={buildCreateUrl(ADMIN_BASE, offset, sortColumn, sortDirection, filter)}
            data-rmx-target={getSelfFrameTarget()}
            mix={table.linkPlain}
          >
            <button type="button" mix={[button({ tone: 'primary' })]}>
              <Glyph name="add" width={14} height={14} /> Neu anlegen
            </button>
          </a>
        </form>

        <div mix={table.wrap} data-lists-table="true">
          {lists.length === 0 ? (
            <div mix={emptyStateStyle}>
              <span>
                {filter
                  ? 'Keine Listen für diese Suche gefunden.'
                  : 'Noch keine Listen gespeichert.'}
              </span>
              {!hasFormPanel && (
                <a
                  href={buildCreateUrl(ADMIN_BASE, offset, sortColumn, sortDirection, filter)}
                  data-rmx-target={getSelfFrameTarget()}
                  mix={table.linkPlain}
                >
                  <button type="button" mix={[button({ tone: 'primary' })]}>
                    <Glyph name="add" width={14} height={14} /> Neu anlegen
                  </button>
                </a>
              )}
            </div>
          ) : (
            <table mix={table.table}>
              <colgroup>
                <col mix={css({ width: '60px' })} />
                <col />
                <col mix={colItemsWidth} />
                <col mix={colDescWidth} />
                <col />
                <col mix={colUpdatedWidth} />
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
                      )}
                      data-rmx-target={getSelfFrameTarget()}
                      mix={table.sortLink}
                    >
                      Titel
                      <span mix={'title' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('title', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.th}>Elemente</th>
                  <th
                    mix={table.thSortable}
                    aria-sort={sortRule('description', sortColumn, sortDirection)}
                  >
                    <a
                      href={buildSortUrl(
                        ADMIN_BASE,
                        'description',
                        sortColumn,
                        sortDirection,
                        offset,
                        filter,
                      )}
                      data-rmx-target={getSelfFrameTarget()}
                      mix={table.sortLink}
                    >
                      Beschreibung
                      <span
                        mix={'description' === sortColumn ? table.sortArrowActive : table.sortArrow}
                      >
                        {sortArrow('description', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.th}>Vorschau</th>
                  <th
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
                    >
                      Aktualisiert
                      <span
                        mix={'updated_at' === sortColumn ? table.sortArrowActive : table.sortArrow}
                      >
                        {sortArrow('updated_at', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.th}>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {lists.map((row) => {
                  let items = Array.isArray(row.list) ? row.list : []
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
                      mix={[table.row, editRow?.id === row.id ? table.editingRow : undefined]}
                      data-row-id={row.id}
                    >
                      <td mix={table.td} title={String(row.id)}>
                        {row.id}
                      </td>
                      <td mix={table.td} title={row.title}>
                        {row.title}
                      </td>
                      <td mix={table.td}>
                        <span mix={itemCountBadgeStyle}>{items.length}</span>
                      </td>
                      <td mix={table.td}>
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
                      </td>
                      <td mix={table.td}>
                        <div mix={previewTextStyle}>{formatPreview(items)}</div>
                        {items.length > 0 && (
                          <details>
                            <summary mix={summaryStyle}>
                              Alle {items.length} Elemente anzeigen
                            </summary>
                            <div mix={detailsStyle}>
                              {items.map((item, idx) => (
                                <div key={item.id}>
                                  <span
                                    mix={css({
                                      color: theme.colors.text.muted,
                                      marginRight: '4px',
                                    })}
                                  >
                                    {idx + 1}.
                                  </span>
                                  {item.label}
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </td>
                      <td mix={table.td} title={formatTimestamp(row.updated_at)}>
                        {formatTimestamp(row.updated_at)}
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
                            method="DELETE"
                            action={routes.admin.lists.destroy.href({ id: row.id })}
                            data-delete-form={row.id}
                            data-confirm={
                              'Liste #' + row.id + ' (' + items.length + ' Elemente) löschen?'
                            }
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

        {(offset > 0 || hasMore) && (
          <div mix={table.pagination}>
            <span mix={css({ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' })}>
              {lists.length > 0 ? (
                <span mix={table.paginationInfo}>
                  Zeige {pageStart}–{pageEnd}
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
                  Zurück
                </a>
              ) : null}
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
                  Weiter
                </a>
              ) : null}
            </div>
          </div>
        )}
      </div>
    )

    if (editRow || creating) {
      return (
        <div mix={table.page}>
          <h2 mix={table.title}>Gespeicherte Listen</h2>
          {formError ? <div mix={table.errorBanner}>{formError}</div> : null}
          <div mix={table.twoColumn}>
            {gridSection}
            <div mix={table.stickyPanel}>
              {editRow ? (
                <AdminListsEditPanel
                  row={editRow}
                  offset={String(offset)}
                  sort={sortColumn}
                  order={sortDirection}
                  filter={filter}
                  formValues={formValues}
                  fieldErrors={fieldErrors}
                />
              ) : (
                <AdminListsCreatePanel
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
        <h2 mix={table.title}>Gespeicherte Listen</h2>
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

// Inline Edit Panel

interface EditPanelProps {
  row: ListRowData
  offset?: string
  sort?: string
  order?: string
  filter?: string | undefined
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
      formValues,
      fieldErrors,
    } = handle.props
    return (
      <div
        mix={animateEntrance(entrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 }))}
      >
        <RestfulForm
          method="PUT"
          action={routes.admin.lists.update.href({ id: row.id })}
          data-rmx-target={getSelfFrameTarget()}
          novalidate
        >
          <GridStateHiddenInputs state={{ offset, sort, order, filter }} />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={table.panelTitle}>Liste bearbeiten</span>
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
                  required
                />
                {fieldErrors?.title ? <div mix={fieldErrorStyle}>{fieldErrors.title}</div> : null}
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
                />
                {fieldErrors?.description ? (
                  <div mix={fieldErrorStyle}>{fieldErrors.description}</div>
                ) : null}
              </div>

              <div mix={table.actions}>
                <button type="submit" mix={[button({ tone: 'primary' }), table.spacer]}>
                  Speichern
                </button>
                <a
                  href={buildCancelUrl(
                    routes.admin.lists.index.href(),
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

// Inline Create Panel

interface CreatePanelProps {
  offset?: string
  sort?: string
  order?: string
  filter?: string | undefined
  formValues?: Record<string, string> | undefined
  fieldErrors?: Record<string, string> | undefined
}

function AdminListsCreatePanel(handle: Handle<CreatePanelProps>) {
  return () => {
    let { offset = '', sort = '', order = '', filter = '', formValues, fieldErrors } = handle.props
    return (
      <div
        mix={animateEntrance(entrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 }))}
      >
        <RestfulForm
          method="POST"
          action={routes.admin.lists.create.href()}
          data-rmx-target={getSelfFrameTarget()}
          novalidate
        >
          <GridStateHiddenInputs state={{ offset, sort, order, filter }} />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={table.panelTitle}>Neue Liste</span>
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
                  required
                />
                {fieldErrors?.title ? <div mix={fieldErrorStyle}>{fieldErrors.title}</div> : null}
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
                />
                {fieldErrors?.description ? (
                  <div mix={fieldErrorStyle}>{fieldErrors.description}</div>
                ) : null}
              </div>

              <div mix={table.actions}>
                <button type="submit" mix={[button({ tone: 'primary' }), table.spacer]}>
                  Anlegen
                </button>
                <a
                  href={buildCancelUrl(
                    routes.admin.lists.index.href(),
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
