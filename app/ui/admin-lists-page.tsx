import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'
import button, { buttonLink } from '../ui/theme/button.ts'
import { Glyph } from '../ui/theme/glyph/glyph.tsx'
import { animateEntrance } from 'remix/ui/animation'
import { entrance } from '../utils/motion.ts'
import { input } from './mixins/input.ts'

import { routes } from '../routes.ts'
import { getSelfFrameTarget } from '../utils/frame-target.ts'
import { RestfulForm } from './restful-form.tsx'
import { GridStateHiddenInputs } from './grid-state-hidden.tsx'
import { ConfirmDelete } from './confirm-delete.browser.tsx'
import { DirtyFormGuard } from './dirty-form-guard.browser.tsx'
import { table } from './mixins/admin-table.ts'
import { rotatedGlyphCss } from './mixins/icon.ts'
import { isListItemFilter, type ListRow } from '../data/admin-lists.ts'
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

const ADMIN_BASE = routes.admin.lists.index.href()

interface AdminListsPageProps {
  lists: ListRow[]
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
  status?: string | undefined
  editRow?: ListRow | null
  creating?: boolean
  pageSize: number
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
})

const titleTextStyle = css({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontWeight: theme.fontWeight.medium,
  color: theme.colors.text.primary,
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

const detailsItemStyle = css({
  display: 'flex',
  alignItems: 'baseline',
  gap: '4px',
})

const summaryStyle = css({
  cursor: 'pointer',
  color: theme.colors.action.primary.background,
  fontWeight: theme.fontWeight.medium,
  fontSize: theme.fontSize.xs,
  marginTop: '2px',
})

const colItemsWidth = css({ width: '96px' })
const colUpdatedWidth = css({ width: '150px' })
const colActionsWidth = css({ width: '104px' })

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

const pageBadgeStyle = css({
  padding: theme.space.xs + ' ' + theme.space.sm,
  borderRadius: theme.radius.full,
  background: theme.surface.lvl2,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  whiteSpace: 'nowrap',
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
      status,
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
    let activeItemFilter = isListItemFilter(status) ? status : undefined
    let currentPage = Math.floor(offset / pageSize) + 1

    // Name the active filter so the empty state explains why nothing matched.
    let emptyMessage: string
    if (!filter && !activeItemFilter) {
      emptyMessage = 'Noch keine Listen gespeichert.'
    } else if (!filter && activeItemFilter === 'empty') {
      emptyMessage = 'Keine leeren Listen gefunden.'
    } else if (!filter && activeItemFilter === 'items') {
      emptyMessage = 'Keine Listen mit Elementen gefunden.'
    } else if (filter && !activeItemFilter) {
      emptyMessage = 'Keine Listen für diese Suche gefunden.'
    } else {
      emptyMessage = 'Keine Listen für diese Filter gefunden.'
    }

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
          <div mix={table.filterGroup}>
            {/* Item-count tabs always reset to page 1: keeping a stale offset
                while the result set changes can land on an empty page. They
                preserve the text search. */}
            <a
              href={
                ADMIN_BASE + '?' + buildFilterParams(filter ?? '', sortColumn, sortDirection, 0)
              }
              data-rmx-target={getSelfFrameTarget()}
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
            type="text"
            name="filter"
            placeholder="Suche nach Titel, Beschreibung oder Element…"
            defaultValue={filter ?? ''}
            aria-label="Nach Titel, Beschreibung oder Element suchen"
            mix={table.filterInput}
          />
          <button type="submit" mix={table.searchBtn}>
            <Glyph name="search" width={14} height={14} /> Suchen
          </button>
          {filter || activeItemFilter ? (
            <a href={routes.admin.lists.index.href()} mix={table.clearLink}>
              Zurücksetzen
            </a>
          ) : null}
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

        <div mix={table.wrap} data-lists-table="true">
          {lists.length === 0 ? (
            <div mix={emptyStateStyle}>
              <span>{emptyMessage}</span>
              {!hasFormPanel && (
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
                  mix={buttonLink({ tone: 'primary' })}
                >
                  <Glyph name="add" width={14} height={14} /> Neu anlegen
                </a>
              )}
            </div>
          ) : (
            <table mix={table.table}>
              <colgroup>
                <col mix={css({ width: '56px' })} />
                <col />
                <col mix={colItemsWidth} />
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
                        undefined,
                        activeItemFilter,
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
                        undefined,
                        activeItemFilter,
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
                        undefined,
                        activeItemFilter,
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
                  let doneCount = items.filter((item) => item.done).length
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
                      mix={[table.row, editRow?.id === row.id ? table.editingRow : undefined]}
                      data-row-id={row.id}
                    >
                      <td mix={table.td} title={String(row.id)}>
                        {row.id}
                      </td>
                      <td mix={table.td}>
                        <div mix={titleCellStyle}>
                          <span mix={titleTextStyle} title={row.title}>
                            {row.title}
                          </span>
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
                      <td mix={table.td}>
                        <span
                          mix={
                            doneCount > 0
                              ? [itemCountBadgeStyle, itemCountBadgeDoneStyle]
                              : itemCountBadgeStyle
                          }
                          title={
                            items.length === 0
                              ? 'Keine Elemente'
                              : doneCount + ' von ' + items.length + ' Elementen erledigt'
                          }
                          aria-label={
                            items.length === 0
                              ? 'Keine Elemente'
                              : doneCount + ' von ' + items.length + ' Elementen erledigt'
                          }
                        >
                          {doneCount > 0 ? doneCount + '/' + items.length : String(items.length)}
                        </span>
                      </td>
                      <td mix={table.td}>
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
                          <details>
                            <summary mix={summaryStyle}>Alle {items.length} Elemente</summary>
                            <div mix={detailsStyle}>
                              {items.map((item, idx) => (
                                <div key={item.id || String(idx)} mix={detailsItemStyle}>
                                  <span
                                    mix={css({
                                      color: theme.colors.text.muted,
                                      minWidth: '1.5em',
                                    })}
                                  >
                                    {idx + 1}.
                                  </span>
                                  <span mix={item.done ? previewChipDoneStyle : undefined}>
                                    {item.label}
                                  </span>
                                  {item.done ? (
                                    // success.background is the pale tile fill
                                    // (#f0fdf4); success.foreground is the token
                                    // intended for text (see admin-page.tsx).
                                    <span
                                      mix={css({
                                        color: theme.colors.success.foreground,
                                        fontWeight: theme.fontWeight.bold,
                                      })}
                                      title="Erledigt"
                                    >
                                      ✓
                                    </span>
                                  ) : null}
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
                        <div mix={table.actionGroup}>
                          <a
                            href={'/lists?load=' + row.id}
                            target="_top"
                            data-rmx-document
                            aria-label="In Listen öffnen"
                            title="In Listen öffnen"
                            mix={table.actionSeg}
                          >
                            <Glyph name="open" width={14} height={14} />
                          </a>
                          <a
                            href={editHref}
                            data-rmx-target={getSelfFrameTarget()}
                            aria-label="Bearbeiten"
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
                              'Liste "' + row.title + '" (' + items.length + ' Elemente) löschen?'
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
                              aria-label="Löschen"
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

        {(offset > 0 || hasMore) && (
          <div mix={table.pagination}>
            <span mix={css({ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' })}>
              {lists.length > 0 ? (
                <span mix={table.paginationInfo}>
                  Zeige {pageStart}–{pageEnd}
                </span>
              ) : null}
              <span mix={pageBadgeStyle} aria-label={'Seite ' + currentPage}>
                Seite {currentPage}
              </span>
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
                    activeItemFilter,
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
                    undefined,
                    activeItemFilter,
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
          <GridStateHiddenInputs state={{ offset, sort, order, filter, status }} />
          <DirtyFormGuard />

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
                    undefined,
                    status,
                  )}
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
          <GridStateHiddenInputs state={{ offset, sort, order, filter, status }} />
          <DirtyFormGuard />

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
                    undefined,
                    status,
                  )}
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
