import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { panelEntrance } from './mixins/panel-entrance.ts'
import { theme } from '../ui/theme/theme.ts'
import { rotatedGlyphCss } from './mixins/icon.ts'
import { buttonLink } from '../ui/theme/button.ts'
import { Glyph } from '../ui/theme/glyph/glyph.tsx'
import { PageSection } from './page-primitives.tsx'
import { input } from './mixins/input.ts'
import { table } from './mixins/admin-table.ts'
import {
  verwaltungGridDensity,
  verwaltungGridFill,
  verwaltungGridWrap,
} from './mixins/verwaltung-grid.ts'
import {
  sortArrow,
  sortRule,
  buildSortUrl,
  buildPaginationUrl,
  buildCreateUrl,
  buildEditUrl,
  buildCancelUrl,
  formatTimestamp,
} from './mixins/admin-urls.ts'

import { routes } from '../routes.ts'
import { getSelfFrameTarget } from '../utils/frame-target.ts'
import type { Resource } from '../data/schema.ts'
import { RestfulForm } from './restful-form.tsx'
import { GridStateHiddenInputs } from './grid-state-hidden.tsx'
import { PendingSubmitButton } from './pending-submit.browser.tsx'
import { FormErrorFocus } from './form-error-focus.browser.tsx'
import { GridStateScript } from './grid-state-script.tsx'
import { FilterAutoSubmit } from './filter-autosubmit.browser.tsx'
import { EditorAutofocus } from './editor-autofocus.browser.tsx'
import { DirtyFormGuard } from './dirty-form-guard.browser.tsx'
import { AdminResourcesContextMenu } from '../actions/admin/public/admin-resources-context-menu.tsx'
import { AdminRowActionsOverlay } from './admin-row-actions-overlay.browser.tsx'
import { PageSizeControl } from './page-size-control.tsx'
import type { PageSizeKey } from '../utils/get-page-size.ts'

interface AdminResourcesPageProps {
  rows: Resource[]
  total: number
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  pageKey: PageSizeKey
  pageSizeOverride: number | null
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
  editRow?: Resource | null | undefined
  creating?: boolean | undefined
  formValues?: Record<string, string> | undefined
  fieldErrors?: Record<string, string> | undefined
  formError?: string | undefined
}

const ADMIN_BASE = routes.verwaltung.resources.index.href()

// ── Styles ──

const colActionsWidth = css({ width: '96px' })

/** Resource name is the row's primary target: it opens the edit panel. */
const nameLinkStyle = css({
  display: 'block',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: theme.colors.text.primary,
  fontWeight: theme.fontWeight.medium,
  textDecoration: 'none',
  '&:hover': { color: theme.colors.action.primary.background, textDecoration: 'underline' },
})

/**
 * Empty grid state. The Verwaltung shell makes the grid fill the viewport, so
 * the message and its recovery actions are centred instead of floating at the
 * top of a tall empty panel.
 */
const emptyStateStyle = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.space.md,
  minHeight: '220px',
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

const pageBadgeStyle = css({
  padding: `${theme.space.xs} ${theme.space.sm}`,
  borderRadius: theme.radius.full,
  background: theme.surface.lvl2,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  whiteSpace: 'nowrap',
})

const paginationInfoGroupStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.space.sm,
})

/**
 * Reserves the second line even when a resource has no capabilities, so rows
 * keep a uniform height instead of alternating one- and two-line layouts.
 */
const capabilityLineStyle = css({ minHeight: '1.2em' })

/**
 * The two-line description cell. On phones the parent `td` becomes a
 * `justify-content: space-between` row, so the value stack has to shrink and
 * right-align itself; without `min-width: 0` its no-wrap lines push the card
 * wider than the grid and the card's right edge scrolls out of view.
 */
const descriptionStackStyle = css({
  minWidth: 0,
  '@media (max-width: 768px)': {
    flex: '1 1 auto',
    alignItems: 'flex-end',
    textAlign: 'right',
  },
})

/** Caps a line's width so its ellipsis engages inside the phone card's row. */
const descriptionLineStyle = css({
  maxWidth: '100%',
  '@media (max-width: 768px)': { textAlign: 'right' },
})

const fieldHintStyle = css({
  marginTop: theme.space.xs,
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
})

const panelIdStyle = css({
  fontFamily: theme.fontFamily.mono,
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
})

const fieldErrorStyle = css({
  color: theme.colors.action.danger.background,
  fontSize: theme.fontSize.xs,
  marginTop: theme.space.xs,
})

const srOnlyStyle = css({
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: 0,
})

/**
 * One-line preview of the capabilities text for the grid. The full value is
 * still available through the cell's `title` and in the edit panel; the grid
 * only has room for enough to tell two rooms apart.
 */
function capabilitiesPreview(capabilities: string | null | undefined): string {
  if (!capabilities) return ''
  let text = capabilities.replace(/\s+/g, ' ').trim()
  return text.length > 90 ? `${text.slice(0, 89).trimEnd()}…` : text
}

// ── Component ──

export function AdminResourcesPage(handle: Handle<AdminResourcesPageProps>) {
  return () => {
    let {
      rows,
      total,
      offset,
      hasMore,
      prevOffset,
      nextOffset,
      pageKey,
      pageSizeOverride,
      sortColumn,
      sortDirection,
      filter,
      editRow = null,
      creating = false,
      formValues,
      fieldErrors,
      formError,
    } = handle.props
    let pageSize = Math.max(1, nextOffset - offset)
    let pageStart = rows.length > 0 ? offset + 1 : 0
    let pageEnd = offset + rows.length
    let currentPage = Math.floor(offset / pageSize) + 1
    let hasFormPanel = !!(editRow || creating)
    // A delete or a filter change can leave the URL on a page that no longer
    // exists. Distinguish that from a genuinely empty result set.
    let stalePage = rows.length === 0 && offset > 0
    let emptyMessage = stalePage
      ? 'Keine Ressourcen auf dieser Seite.'
      : filter
        ? `Keine Ressourcen gefunden für „${filter}“.`
        : 'Noch keine Ressourcen vorhanden. Legen Sie die erste an.'

    let gridSection = (
      <div mix={[table.minWidth0, hasFormPanel ? table.twoColumnGrid : verwaltungGridFill]}>
        {!hasFormPanel && formError ? (
          <div mix={table.errorBanner} role="alert">
            {formError}
          </div>
        ) : null}
        {/* Toolbar + Filter */}
        <form
          method="GET"
          action={routes.verwaltung.resources.index.href()}
          role="search"
          aria-label="Ressourcen durchsuchen"
          data-rmx-target={getSelfFrameTarget()}
          data-rmx-history="replace"
          data-rmx-reset-focus="manual"
          data-resources-filter
          mix={table.filterBar}
        >
          {/* Keep the active sort while searching; the offset is intentionally
              absent so a new search starts on page 1. */}
          <input type="hidden" name="sort" value={sortColumn} />
          <input type="hidden" name="order" value={sortDirection} />
          <input
            type="text"
            name="filter"
            placeholder="Name, Beschreibung, Ausstattung…"
            defaultValue={filter ?? ''}
            aria-label="Nach Name, Beschreibung oder Ausstattung suchen"
            mix={table.filterInput}
          />
          <button type="submit" mix={table.searchBtn}>
            <Glyph name="search" width={14} height={14} /> Suchen
          </button>
          {filter && (
            <a
              href={routes.verwaltung.resources.index.href()}
              data-rmx-target={getSelfFrameTarget()}
              mix={table.clearLink}
            >
              Zurücksetzen
            </a>
          )}
          <span mix={table.spacer} />
          <a
            href={buildCreateUrl(ADMIN_BASE, offset, sortColumn, sortDirection, filter)}
            data-rmx-target={getSelfFrameTarget()}
            mix={[table.linkPlain, buttonLink({ tone: 'primary' })]}
          >
            <Glyph name="add" width={14} height={14} /> Neu anlegen
          </a>
        </form>
        {/* Debounced live search: typing re-runs the GET form instead of waiting
            for the Suchen button (which remains the no-JS path). Disabled while
            an edit/create panel is open, because each reload replaces the panel
            and would discard half-typed edits without the dirty-form prompt. */}
        {!hasFormPanel ? <FilterAutoSubmit formSelector="form[data-resources-filter]" /> : null}

        {/* Table */}
        <div
          mix={[table.wrap, table.mobileCards, verwaltungGridWrap, verwaltungGridDensity]}
          data-grid-scroll="true"
          data-resources-table="true"
        >
          {rows.length === 0 ? (
            <div mix={emptyStateStyle}>
              <span>{emptyMessage}</span>
              <div mix={emptyActionsStyle}>
                {stalePage ? (
                  <a
                    href={buildPaginationUrl(ADMIN_BASE, 0, sortColumn, sortDirection, filter)}
                    data-rmx-target={getSelfFrameTarget()}
                    mix={[table.linkPlain, buttonLink({ tone: 'secondary' })]}
                  >
                    Zur ersten Seite
                  </a>
                ) : null}
                {filter ? (
                  <a
                    href={routes.verwaltung.resources.index.href()}
                    data-rmx-target={getSelfFrameTarget()}
                    mix={[table.linkPlain, buttonLink({ tone: 'secondary' })]}
                  >
                    Filter zurücksetzen
                  </a>
                ) : null}
                {!hasFormPanel ? (
                  <a
                    href={buildCreateUrl(ADMIN_BASE, offset, sortColumn, sortDirection, filter)}
                    data-rmx-target={getSelfFrameTarget()}
                    mix={[table.linkPlain, buttonLink({ tone: 'primary' })]}
                  >
                    <Glyph name="add" width={14} height={14} /> Neu anlegen
                  </a>
                ) : null}
              </div>
            </div>
          ) : (
            <table mix={table.table}>
              <caption mix={srOnlyStyle}>Ressourcenliste</caption>
              <colgroup>
                <col mix={css({ width: '180px' })} />
                <col />
                <col mix={css({ width: '160px' })} />
                <col mix={css({ width: '160px' })} />
                <col mix={[colActionsWidth, table.floatingActionsCol]} />
              </colgroup>
              <thead>
                <tr>
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
                      )}
                      data-rmx-target={getSelfFrameTarget()}
                      mix={table.sortLink}
                      title="Nach Name sortieren"
                    >
                      Name
                      <span mix={'name' === sortColumn ? table.sortArrowActive : table.sortArrow}>
                        {sortArrow('name', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th
                    scope="col"
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
                      title="Nach Beschreibung sortieren"
                    >
                      Beschreibung
                      <span
                        mix={'description' === sortColumn ? table.sortArrowActive : table.sortArrow}
                      >
                        {sortArrow('description', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
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
                      )}
                      data-rmx-target={getSelfFrameTarget()}
                      mix={table.sortLink}
                      title="Nach Erstellungsdatum sortieren"
                    >
                      Erstellt
                      <span
                        mix={'created_at' === sortColumn ? table.sortArrowActive : table.sortArrow}
                      >
                        {sortArrow('created_at', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th
                    scope="col"
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
                      title="Nach Änderungsdatum sortieren"
                    >
                      Aktualisiert
                      <span
                        mix={'updated_at' === sortColumn ? table.sortArrowActive : table.sortArrow}
                      >
                        {sortArrow('updated_at', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th
                    scope="col"
                    mix={[table.th, colActionsWidth, table.floatingActionsHeader]}
                    aria-label="Aktionen"
                  >
                    <span mix={table.floatingActionsHeaderText}>Aktionen</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  let capsPreview = capabilitiesPreview(row.capabilities)
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
                        table.floatingRowReveal,
                        table.floatingTrailingFade,
                        editRow?.id === row.id ? table.editingRow : undefined,
                      ]}
                      data-row-id={row.id}
                    >
                      <td mix={table.td} data-label="Name" title={row.name ?? ''}>
                        <a
                          href={editHref}
                          data-rmx-target={getSelfFrameTarget()}
                          mix={nameLinkStyle}
                          title={`${row.name ?? 'Ressource'} bearbeiten`}
                        >
                          {row.name ?? '\u2014'}
                        </a>
                      </td>
                      <td mix={table.td} data-label="Beschreibung">
                        <span mix={[table.cellStack, descriptionStackStyle]}>
                          <span
                            mix={[table.cellTitle, descriptionLineStyle]}
                            title={row.description}
                          >
                            {row.description}
                          </span>
                          {capsPreview ? (
                            <span
                              mix={[table.cellMeta, capabilityLineStyle, descriptionLineStyle]}
                              title={row.capabilities ?? ''}
                            >
                              {capsPreview}
                            </span>
                          ) : (
                            <span
                              mix={[table.cellMeta, capabilityLineStyle, descriptionLineStyle]}
                              aria-hidden="true"
                            />
                          )}
                        </span>
                      </td>
                      <td
                        mix={table.td}
                        data-label="Erstellt"
                        title={formatTimestamp(row.created_at as number)}
                      >
                        {formatTimestamp(row.created_at as number)}
                      </td>
                      <td
                        mix={table.td}
                        data-label="Aktualisiert"
                        data-floating-trailing
                        title={formatTimestamp(row.updated_at as number)}
                      >
                        {formatTimestamp(row.updated_at as number)}
                      </td>
                      <td
                        mix={[table.actionCell, table.floatingActionCell, table.mobileActionsCell]}
                        data-label="Aktionen"
                      >
                        <button
                          type="button"
                          data-row-actions-trigger
                          aria-expanded="false"
                          aria-controls={`resource-row-actions-${row.id}`}
                          aria-label={`Weitere Aktionen für ${row.name ?? 'diese Ressource'}`}
                          title="Weitere Aktionen"
                          mix={table.floatingActionsTrigger}
                        >
                          <span aria-hidden="true">⋮</span>
                        </button>
                        <div
                          id={`resource-row-actions-${row.id}`}
                          mix={[table.actionGroup, table.floatingActions]}
                          role="group"
                          aria-label={`Aktionen für ${row.name ?? 'diese Ressource'}`}
                          data-row-actions
                        >
                          <a
                            href={editHref}
                            data-rmx-target={getSelfFrameTarget()}
                            mix={[table.actionSeg, table.actionSegLabeled]}
                            aria-label={`${row.name ?? 'Ressource'} bearbeiten`}
                            title="Bearbeiten"
                          >
                            <Glyph name="edit" width={14} height={14} mix={table.actionGlyph} />
                            <span data-action-label mix={table.actionLabel}>
                              Bearbeiten
                            </span>
                          </a>

                          <RestfulForm
                            method="DELETE"
                            action={routes.verwaltung.resources.destroy.href({ id: row.id })}
                            data-delete-form={row.id}
                            data-confirm={`Ressource "${row.name ?? ''}" wirklich löschen?`}
                            data-rmx-target={getSelfFrameTarget()}
                            mix={css({ margin: 0, padding: 0, display: 'inline-flex' })}
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
                              mix={[table.actionSeg, table.actionSegDanger, table.actionSegLabeled]}
                              aria-label={`${row.name ?? 'Ressource'} löschen`}
                              title="Löschen"
                            >
                              <Glyph name="trash" width={14} height={14} mix={table.actionGlyph} />
                              <span data-action-label mix={table.actionLabel}>
                                Löschen
                              </span>
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
          {/* Hidden DELETE forms for context menu */}
          {rows.length > 0 ? (
            <div mix={table.displayNone} aria-hidden="true">
              {rows.map((row) => (
                <RestfulForm
                  key={row.id}
                  method="DELETE"
                  action={routes.verwaltung.resources.destroy.href({ id: row.id })}
                  data-delete-form={row.id}
                  data-rmx-target={getSelfFrameTarget()}
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
          <GridStateScript
            id="resources-grid-state"
            baseHref={routes.verwaltung.resources.index.href()}
            offset={offset}
            sort={sortColumn}
            order={sortDirection}
            filter={filter}
          />
          <AdminResourcesContextMenu />
          <AdminRowActionsOverlay />
        </div>

        {/* Pagination */}
        {(rows.length > 0 || offset > 0) && (
          <div mix={table.pagination}>
            <span mix={paginationInfoGroupStyle}>
              {rows.length > 0 ? (
                <span mix={table.paginationInfo} data-pagination-info>
                  Zeige {pageStart}–{pageEnd} von {total}
                </span>
              ) : null}
              <span mix={pageBadgeStyle} aria-label={`Seite ${currentPage}`}>
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
                  )}
                  data-rmx-target={getSelfFrameTarget()}
                  data-rmx-prefetch="viewport"
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
                  )}
                  data-rmx-target={getSelfFrameTarget()}
                  data-rmx-prefetch="viewport"
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
                action={routes.verwaltung.pageSize.href()}
                pageKey={pageKey}
                pageSize={pageSize}
                pageSizeOverride={pageSizeOverride}
                controlId="resources-page-size"
              />
            </div>
          </div>
        )}
      </div>
    )

    // Two-column layout when editing or creating
    if (editRow || creating) {
      return (
        <PageSection title="Ressourcen" description="Ressourcen anlegen und verwalten.">
          <div mix={table.pageWide}>
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
        </PageSection>
      )
    }

    return (
      <PageSection title="Ressourcen" titleHidden compact>
        <div mix={[table.page, verwaltungGridFill]}>{gridSection}</div>
      </PageSection>
    )
  }
}

// ── Inline Edit Panel ──

interface EditPanelProps {
  row: Resource
  offset?: string | undefined
  sort?: string | undefined
  order?: string | undefined
  filter?: string | undefined
  formValues?: Record<string, string> | undefined
  fieldErrors?: Record<string, string> | undefined
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
    return (
      <div mix={panelEntrance}>
        {/* Server-owned validation (same as the lists/users panels): novalidate
            lets the schema's German inline errors + FormErrorFocus own the
            flow instead of the browser's locale-dependent constraint bubble. */}
        <RestfulForm
          method="PUT"
          action={routes.verwaltung.resources.update.href({ id: row.id })}
          data-rmx-target={getSelfFrameTarget()}
          novalidate
        >
          <GridStateHiddenInputs state={{ offset, sort, order, filter }} />
          <FormErrorFocus />
          <EditorAutofocus />
          <DirtyFormGuard />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={table.panelTitle}>Ressource bearbeiten</span>
              <span mix={panelIdStyle}>#{row.id}</span>
            </div>

            <div mix={table.panelBody}>
              <ResourceFields
                idPrefix="ar"
                mode="edit"
                values={{
                  name: formValues?.name ?? row.name ?? '',
                  description: formValues?.description ?? row.description ?? '',
                  capabilities: formValues?.capabilities ?? row.capabilities ?? '',
                }}
                fieldErrors={fieldErrors}
              />

              <div mix={table.actions}>
                <PendingSubmitButton>Speichern</PendingSubmitButton>
                <a
                  href={buildCancelUrl(
                    routes.verwaltung.resources.index.href(),
                    offset,
                    sort,
                    order,
                    filter,
                  )}
                  mix={[
                    table.spacer,
                    table.linkPlain,
                    buttonLink({ tone: 'secondary' }),
                    css({ width: '100%' }),
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

// ── Inline Create Panel ──

interface CreatePanelProps {
  offset?: string | undefined
  sort?: string | undefined
  order?: string | undefined
  filter?: string | undefined
  formValues?: Record<string, string> | undefined
  fieldErrors?: Record<string, string> | undefined
}

function AdminResourcesCreatePanel(handle: Handle<CreatePanelProps>) {
  return () => {
    let { offset = '', sort = '', order = '', filter = '', formValues, fieldErrors } = handle.props
    return (
      <div mix={panelEntrance}>
        {/* Agent-aware create form: the support-agent panel's SSE replay must
            keep owning this submit (its controller answers the agent's
            ask_user gate with JSON), so it carries the data-agent-form marker
            even though its corrected data-rmx-target names the panel.
            novalidate keeps validation server-owned (see the edit panel). */}
        <RestfulForm
          method="POST"
          action={routes.verwaltung.resources.create.href()}
          data-rmx-target={getSelfFrameTarget()}
          data-agent-form="true"
          novalidate
        >
          <GridStateHiddenInputs state={{ offset, sort, order, filter }} />
          <FormErrorFocus />
          <EditorAutofocus />
          <DirtyFormGuard />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={table.panelTitle}>Neue Ressource</span>
            </div>

            <div mix={table.panelBody}>
              <ResourceFields
                idPrefix="ar-c"
                mode="create"
                values={{
                  name: formValues?.name ?? '',
                  description: formValues?.description ?? '',
                  capabilities: formValues?.capabilities ?? '',
                }}
                fieldErrors={fieldErrors}
              />

              <div mix={table.actions}>
                <PendingSubmitButton>Anlegen</PendingSubmitButton>
                <a
                  href={buildCancelUrl(
                    routes.verwaltung.resources.index.href(),
                    offset,
                    sort,
                    order,
                    filter,
                  )}
                  mix={[
                    table.spacer,
                    table.linkPlain,
                    buttonLink({ tone: 'secondary' }),
                    css({ width: '100%' }),
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

// ── Shared panel fields ──

interface ResourceFieldValues {
  name: string
  description: string
  capabilities: string
}

interface ResourceFieldsProps {
  /** Prefixes every field/error/hint id (`ar` for edit, `ar-c` for create). */
  idPrefix: string
  /** `edit` renders server-owned `value`s; `create` seeds `defaultValue`s. */
  mode: 'edit' | 'create'
  values: ResourceFieldValues
  fieldErrors: Record<string, string> | undefined
}

/**
 * The three resource fields, shared by the edit and create panels. Keeping one
 * component means the labels, minimums, hints and aria wiring cannot drift
 * between "neu" and "bearbeiten" — the server validates both with the same
 * schema (`name` ≥ 4, `description` ≥ 8, `capabilities` ≤ 10 000).
 */
function ResourceFields(handle: Handle<ResourceFieldsProps>) {
  return () => {
    let { idPrefix, mode, values, fieldErrors } = handle.props
    let nameError = fieldErrors?.name
    let descError = fieldErrors?.description
    let capsError = fieldErrors?.capabilities
    let valueProps = (value: string) => (mode === 'edit' ? { value } : { defaultValue: value })
    let describedBy = (...ids: (string | undefined)[]) => ids.filter(Boolean).join(' ') || undefined

    return (
      <>
        <div mix={table.fieldGroup}>
          <label mix={table.label} htmlFor={`${idPrefix}-name`}>
            Name
          </label>
          <input
            id={`${idPrefix}-name`}
            name="name"
            type="text"
            required
            minLength={4}
            data-editor-autofocus-field
            aria-invalid={nameError ? 'true' : undefined}
            aria-describedby={describedBy(
              `${idPrefix}-name-hint`,
              nameError ? `${idPrefix}-name-error` : undefined,
            )}
            {...valueProps(values.name)}
            mix={[input.base, input.focus, ...(nameError ? [input.error] : [])]}
          />
          <div id={`${idPrefix}-name-hint`} mix={fieldHintStyle}>
            Mindestens 4 Zeichen.
          </div>
          {nameError ? (
            <div id={`${idPrefix}-name-error`} role="alert" mix={fieldErrorStyle}>
              {nameError}
            </div>
          ) : null}
        </div>

        <div mix={table.fieldGroup}>
          <label mix={table.label} htmlFor={`${idPrefix}-desc`}>
            Beschreibung
          </label>
          <input
            id={`${idPrefix}-desc`}
            name="description"
            type="text"
            required
            minLength={8}
            aria-invalid={descError ? 'true' : undefined}
            aria-describedby={describedBy(
              `${idPrefix}-desc-hint`,
              descError ? `${idPrefix}-desc-error` : undefined,
            )}
            {...valueProps(values.description)}
            mix={[input.base, input.focus, ...(descError ? [input.error] : [])]}
          />
          <div id={`${idPrefix}-desc-hint`} mix={fieldHintStyle}>
            Mindestens 8 Zeichen.
          </div>
          {descError ? (
            <div id={`${idPrefix}-desc-error`} role="alert" mix={fieldErrorStyle}>
              {descError}
            </div>
          ) : null}
        </div>

        <div mix={table.fieldGroup}>
          <label mix={table.label} htmlFor={`${idPrefix}-caps`}>
            Ausstattung &amp; Fähigkeiten
          </label>
          <textarea
            id={`${idPrefix}-caps`}
            name="capabilities"
            rows={4}
            maxLength={10000}
            aria-invalid={capsError ? 'true' : undefined}
            aria-describedby={describedBy(
              `${idPrefix}-caps-hint`,
              capsError ? `${idPrefix}-caps-error` : undefined,
            )}
            {...valueProps(values.capabilities)}
            mix={[
              input.base,
              input.focus,
              css({ resize: 'vertical', minHeight: '80px' }),
              ...(capsError ? [input.error] : []),
            ]}
          />
          <div id={`${idPrefix}-caps-hint`} mix={fieldHintStyle}>
            Optional. Eine Angabe pro Zeile – erscheint als Vorschau in der Übersicht.
          </div>
          {capsError ? (
            <div id={`${idPrefix}-caps-error`} role="alert" mix={fieldErrorStyle}>
              {capsError}
            </div>
          ) : null}
        </div>
      </>
    )
  }
}
