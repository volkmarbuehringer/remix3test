import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'
import { rotatedGlyphCss } from './mixins/icon.ts'
import button from '../ui/theme/button.ts'
import { Glyph } from '../ui/theme/glyph/glyph.tsx'
import { animateEntrance } from 'remix/ui/animation'
import { entrance } from '../utils/motion.ts'
import { input } from './mixins/input.ts'
import { table } from './mixins/admin-table.ts'
import {
  sortArrow,
  buildSortUrl,
  buildPaginationUrl,
  buildCreateUrl,
  buildEditUrl,
  buildCancelUrl,
  formatTimestamp,
} from './mixins/admin-urls.ts'

import { frames, routes } from '../routes.ts'
import type { Resource } from '../data/schema.ts'
import { RestfulForm } from './restful-form.tsx'
import { GridStateHiddenInputs } from './grid-state-hidden.tsx'
import { ConfirmDelete } from '../ui/confirm-delete.browser.tsx'
import { getCspNonce } from '../middleware/security-headers.ts'
import { AdminResourcesContextMenu } from '../actions/admin/public/admin-resources-context-menu.tsx'

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
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
  formError?: string
}

const ADMIN_BASE = routes.verwaltung.resources.index.href()

// ── Styles ──

// ── Component ──

export function AdminResourcesPage(handle: Handle<AdminResourcesPageProps>) {
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
      formValues,
      fieldErrors,
      formError,
    } = handle.props
    let pageStart = rows.length > 0 ? offset + 1 : 0
    let pageEnd = offset + rows.length

    let gridSection = (
      <div mix={table.minWidth0}>
        <ConfirmDelete />
        {formError ? <div mix={table.errorBanner}>{formError}</div> : null}
        {/* Toolbar + Filter */}
        <form
          method="GET"
          action={routes.verwaltung.resources.index.href()}
          data-rmx-target={frames.adminContent}
          mix={table.filterBar}
        >
          <input
            type="text"
            name="filter"
            placeholder="Suche"
            defaultValue={filter ?? ''}
            mix={table.filterInput}
          />
          <button type="submit" mix={table.searchBtn}>
            <Glyph name="search" width={14} height={14} /> Suchen
          </button>
          {filter && (
            <a
              href={routes.verwaltung.resources.index.href()}
              data-rmx-target={frames.adminContent}
              mix={table.clearLink}
            >
              Zurücksetzen
            </a>
          )}
          <span mix={table.spacer} />
          <a
            href={buildCreateUrl(ADMIN_BASE, offset, sortColumn, sortDirection, filter)}
            data-rmx-target={frames.adminContent}
            mix={table.linkPlain}
          >
            <button mix={[button({ tone: 'primary' })]}>
              <Glyph name="add" width={14} height={14} /> Neu anlegen
            </button>
          </a>
        </form>

        {/* Table */}
        <div mix={table.wrap} data-resources-table="true">
          {rows.length === 0 ? (
            <div mix={table.empty}>
              {filter
                ? 'Keine Ressourcen gefunden für diese Suche.'
                : 'Keine Ressourcen vorhanden.'}
            </div>
          ) : (
            <table mix={table.table}>
              <colgroup>
                <col mix={css({ width: '180px' })} />
                <col />
                <col mix={css({ width: '160px' })} />
                <col mix={css({ width: '160px' })} />
              </colgroup>
              <thead>
                <tr>
                  <th mix={table.thSortable}>
                    <a
                      href={buildSortUrl(
                        ADMIN_BASE,
                        'name',
                        sortColumn,
                        sortDirection,
                        offset,
                        filter,
                      )}
                      data-rmx-target={frames.adminContent}
                      mix={table.sortLink}
                    >
                      Name
                      <span mix={'name' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('name', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.thSortable}>
                    <a
                      href={buildSortUrl(
                        ADMIN_BASE,
                        'description',
                        sortColumn,
                        sortDirection,
                        offset,
                        filter,
                      )}
                      data-rmx-target={frames.adminContent}
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
                  <th mix={table.thSortable}>
                    <a
                      href={buildSortUrl(
                        ADMIN_BASE,
                        'created_at',
                        sortColumn,
                        sortDirection,
                        offset,
                        filter,
                      )}
                      data-rmx-target={frames.adminContent}
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
                  <th mix={table.thSortable}>
                    <a
                      href={buildSortUrl(
                        ADMIN_BASE,
                        'updated_at',
                        sortColumn,
                        sortDirection,
                        offset,
                        filter,
                      )}
                      data-rmx-target={frames.adminContent}
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
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    mix={[table.row, editRow?.id === row.id ? table.editingRow : undefined]}
                    data-row-id={row.id}
                  >
                    <td mix={table.td} title={row.name ?? ''}>
                      {row.name ?? '\u2014'}
                    </td>
                    <td mix={table.td} title={row.description}>
                      {row.description}
                    </td>
                    <td mix={table.td} title={formatTimestamp(row.created_at as number)}>
                      {formatTimestamp(row.created_at as number)}
                    </td>
                    <td mix={table.td} title={formatTimestamp(row.updated_at as number)}>
                      {formatTimestamp(row.updated_at as number)}
                    </td>
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
                  action={routes.verwaltung.resources.destroy.href({ id: row.id })}
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

          {/* Context menu data and clientEntry */}
          <script id="resources-grid-state" type="application/json" nonce={getCspNonce()}>
            {JSON.stringify({
              offset: String(offset),
              sort: sortColumn,
              order: sortDirection,
              filter: filter ?? '',
              baseHref: routes.verwaltung.resources.index.href(),
            })}
          </script>
          <AdminResourcesContextMenu />
        </div>

        {/* Pagination */}
        {(offset > 0 || hasMore) && (
          <div mix={table.pagination}>
            {rows.length > 0 && (
              <span mix={table.paginationInfo}>
                Zeige {pageStart}–{pageEnd}
              </span>
            )}
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
                  data-rmx-target={frames.adminContent}
                  mix={table.pageLink}
                >
                  <Glyph
                    name="chevronRight"
                    width={14}
                    height={14}
                    mix={rotatedGlyphCss}
                  />{' '}
                  Zurück
                </a>
              ) : (
                <span mix={table.pageLinkDisabled}>
                  <Glyph
                    name="chevronRight"
                    width={14}
                    height={14}
                    mix={rotatedGlyphCss}
                  />{' '}
                  Zurück
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
                  data-rmx-target={frames.adminContent}
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

    // Two-column layout when editing or creating
    if (editRow || creating) {
      return (
        <div mix={table.page}>
          <h2 mix={table.title}>Ressourcen</h2>
          <div mix={table.twoColumn}>
            {gridSection}
            <div mix={table.stickyPanel}>
              {editRow ? (
                <AdminResourcesEditPanel
                  row={editRow}
                  offset={String(offset)}
                  sort={sortColumn}
                  order={sortDirection}
                  filter={filter}
                  formValues={formValues}
                  fieldErrors={fieldErrors}
                />
              ) : (
                <AdminResourcesCreatePanel
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
        <h2 mix={table.title}>Ressourcen</h2>
        {gridSection}
      </div>
    )
  }
}

// ── Inline Edit Panel ──

interface EditPanelProps {
  row: Resource
  offset?: string
  sort?: string
  order?: string
  filter?: string
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
}

function AdminResourcesEditPanel(handle: Handle<EditPanelProps>) {
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
    let nameValue = formValues?.name ?? row.name ?? ''
    let nameError = fieldErrors?.name
    let descValue = formValues?.description ?? row.description ?? ''
    let descError = fieldErrors?.description
    let capsValue = formValues?.capabilities ?? row.capabilities ?? ''
    let capsError = fieldErrors?.capabilities
    return (
      <div
        mix={animateEntrance(entrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 }))}
      >
        <RestfulForm method="PUT" action={routes.verwaltung.resources.update.href({ id: row.id })}>
          <GridStateHiddenInputs state={{ offset, sort, order, filter }} />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={table.panelTitle}>Ressource bearbeiten</span>
            </div>

            <div mix={table.panelBody}>
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="ar-name">
                  Name
                </label>
                <input
                  id="ar-name"
                  name="name"
                  type="text"
                  value={nameValue}
                  mix={[input.base, input.focus, ...(nameError ? [input.error] : [])]}
                />
                {nameError ? (
                  <div
                    mix={css({
                      color: theme.colors.action.danger.background,
                      fontSize: theme.fontSize.xs,
                      marginTop: theme.space.xs,
                    })}
                  >
                    {nameError}
                  </div>
                ) : null}
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="ar-desc">
                  Beschreibung
                </label>
                <input
                  id="ar-desc"
                  name="description"
                  type="text"
                  value={descValue}
                  mix={[input.base, input.focus, ...(descError ? [input.error] : [])]}
                />
                {descError ? (
                  <div
                    mix={css({
                      color: theme.colors.action.danger.background,
                      fontSize: theme.fontSize.xs,
                      marginTop: theme.space.xs,
                    })}
                  >
                    {fieldErrors!.description}
                  </div>
                ) : null}
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="ar-caps">
                  Capabilities
                </label>
                <textarea
                  id="ar-caps"
                  name="capabilities"
                  rows={4}
                  value={capsValue}
                  mix={[
                    input.base,
                    input.focus,
                    css({ resize: 'vertical', minHeight: '80px' }),
                    ...(capsError ? [input.error] : []),
                  ]}
                />
                {capsError ? (
                  <div
                    mix={css({
                      color: theme.colors.action.danger.background,
                      fontSize: theme.fontSize.xs,
                      marginTop: theme.space.xs,
                    })}
                  >
                    {capsError}
                  </div>
                ) : null}
              </div>

              <div mix={table.actions}>
                <button type="submit" mix={[button({ tone: 'primary' }), table.spacer]}>
                  Speichern
                </button>
                <a
                  href={buildCancelUrl(
                    routes.verwaltung.resources.index.href(),
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

function AdminResourcesCreatePanel(handle: Handle<CreatePanelProps>) {
  return () => {
    let { offset = '', sort = '', order = '', filter = '', formValues, fieldErrors } = handle.props
    let nameError = fieldErrors?.name
    let descError = fieldErrors?.description
    let capsError = fieldErrors?.capabilities
    return (
      <div
        mix={animateEntrance(entrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 }))}
      >
        <RestfulForm method="POST" action={routes.verwaltung.resources.create.href()}>
          <GridStateHiddenInputs state={{ offset, sort, order, filter }} />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={table.panelTitle}>Neue Ressource</span>
            </div>

            <div mix={table.panelBody}>
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="ar-name-c">
                  Name
                </label>
                <input
                  id="ar-name-c"
                  name="name"
                  type="text"
                  required
                  defaultValue={formValues?.name ?? ''}
                  mix={[input.base, input.focus, ...(nameError ? [input.error] : [])]}
                />
                {nameError ? (
                  <div
                    mix={css({
                      color: theme.colors.action.danger.background,
                      fontSize: theme.fontSize.xs,
                      marginTop: theme.space.xs,
                    })}
                  >
                    {nameError}
                  </div>
                ) : null}
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="ar-desc-c">
                  Beschreibung
                </label>
                <input
                  id="ar-desc-c"
                  name="description"
                  type="text"
                  required
                  defaultValue={formValues?.description ?? ''}
                  mix={[input.base, input.focus, ...(descError ? [input.error] : [])]}
                />
                {descError ? (
                  <div
                    mix={css({
                      color: theme.colors.action.danger.background,
                      fontSize: theme.fontSize.xs,
                      marginTop: theme.space.xs,
                    })}
                  >
                    {fieldErrors!.description}
                  </div>
                ) : null}
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="ar-caps-c">
                  Capabilities
                </label>
                <textarea
                  id="ar-caps-c"
                  name="capabilities"
                  rows={4}
                  defaultValue={formValues?.capabilities ?? ''}
                  mix={[
                    input.base,
                    input.focus,
                    css({ resize: 'vertical', minHeight: '80px' }),
                    ...(capsError ? [input.error] : []),
                  ]}
                />
                {capsError ? (
                  <div
                    mix={css({
                      color: theme.colors.action.danger.background,
                      fontSize: theme.fontSize.xs,
                      marginTop: theme.space.xs,
                    })}
                  >
                    {capsError}
                  </div>
                ) : null}
              </div>

              <div mix={table.actions}>
                <button type="submit" mix={[button({ tone: 'primary' }), table.spacer]}>
                  Anlegen
                </button>
                <a
                  href={buildCancelUrl(
                    routes.verwaltung.resources.index.href(),
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
