import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { theme } from '../ui/theme/theme.ts'
import { rotatedGlyphCss } from './mixins/icon.ts'
import button, { buttonLink } from '../ui/theme/button.ts'
import { Glyph } from '../ui/theme/glyph/glyph.tsx'
import { PageSection } from './page-primitives.tsx'
import { animateEntrance } from '@remix-run/ui/animation'
import { entrance } from '../utils/motion.ts'
import { input } from './mixins/input.ts'
import { table } from './mixins/admin-table.ts'
import {
  verwaltungGridDensity,
  verwaltungGridFill,
  verwaltungGridWrap,
} from './mixins/verwaltung-grid.ts'
import {
  sortArrow,
  buildSortUrl,
  buildPaginationUrl,
  buildCreateUrl,
  buildEditUrl,
  buildCancelUrl,
  formatTimestamp,
} from './mixins/admin-urls.ts'

import { routes } from '../routes.ts'
import { getSelfFrameTarget } from '../utils/frame-target.ts'
import { RestfulForm } from './restful-form.tsx'
import { GridStateHiddenInputs } from './grid-state-hidden.tsx'
import type {
  OfferingConfigRow,
  OfferingConfigResourceOption,
} from '../data/offering-configs-queries.ts'
import { ConfirmDelete } from '../ui/confirm-delete.browser.tsx'
import { PendingSubmitButton } from './pending-submit.browser.tsx'
import { FormErrorFocus } from './form-error-focus.browser.tsx'
import { GridStateScript } from './grid-state-script.tsx'
import { AdminOfferingConfigsContextMenu } from '../actions/admin/public/admin-offering-configs-context-menu.tsx'
import { PageSizeControl } from './page-size-control.tsx'
import type { PageSizeKey } from '../utils/get-page-size.ts'

interface AdminOfferingConfigsPageProps {
  rows: OfferingConfigRow[]
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  pageKey: PageSizeKey
  pageSizeOverride: number | null
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
  editRow?: OfferingConfigRow | null | undefined
  creating?: boolean | undefined
  resources: OfferingConfigResourceOption[]
  formValues?: Record<string, string> | undefined
  fieldErrors?: Record<string, string> | undefined
  formError?: string | undefined
}

const DAYS = [
  { key: 'monday', label: 'Montag' },
  { key: 'tuesday', label: 'Dienstag' },
  { key: 'wednesday', label: 'Mittwoch' },
  { key: 'thursday', label: 'Donnerstag' },
  { key: 'friday', label: 'Freitag' },
  { key: 'saturday', label: 'Samstag' },
  { key: 'sunday', label: 'Sonntag' },
] as const

const DAY_LABELS_SHORT: Record<string, string> = {
  monday: 'Mo',
  tuesday: 'Di',
  wednesday: 'Mi',
  thursday: 'Do',
  friday: 'Fr',
  saturday: 'Sa',
  sunday: 'So',
}

const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => i * 60)
const TIME_END_OPTIONS = Array.from({ length: 24 }, (_, i) => (i + 1) * 60)

function fmt(minutes: number): string {
  let h = String(Math.floor(minutes / 60)).padStart(2, '0')
  let m = String(minutes % 60).padStart(2, '0')
  return `${h}:${m}`
}

interface DayRuleRowProps {
  dayKey: string
  dayLabel: string
  idPrefix: string
  checked: boolean
  startMin: number
  endMin: number
}

/** Shared day rule editor: checkbox + start/end time selects for one weekday. */
function DayRuleRow(handle: Handle<DayRuleRowProps>) {
  return () => {
    let { dayKey, dayLabel, idPrefix, checked, startMin, endMin } = handle.props
    return (
      <div key={dayKey} mix={dayRowStyle}>
        <input
          type="checkbox"
          id={`${idPrefix}-${dayKey}`}
          name={`${dayKey}_enabled`}
          value="1"
          checked={checked}
          mix={dayCheckboxStyle}
        />
        <label
          for={`${idPrefix}-${dayKey}`}
          mix={css({ width: '100px', fontSize: theme.fontSize.sm, cursor: 'pointer' })}
        >
          {dayLabel}
        </label>
        <select name={`${dayKey}_start`} mix={timeSelectStyle}>
          {TIME_OPTIONS.map((min) => (
            <option key={min} value={min} selected={min === startMin}>
              {fmt(min)}
            </option>
          ))}
        </select>
        <span mix={css({ fontSize: theme.fontSize.sm, color: theme.colors.text.muted })}>
          {'\u2013'}
        </span>
        <select name={`${dayKey}_end`} mix={timeSelectStyle}>
          {TIME_END_OPTIONS.map((min) => (
            <option key={min} value={min} selected={min === endMin}>
              {fmt(min)}
            </option>
          ))}
        </select>
      </div>
    )
  }
}

function rulesSummary(rules: Record<string, [number, number]> | null | undefined): string {
  if (!rules || Object.keys(rules).length === 0) return '\u2014'
  return Object.entries(rules)
    .map(([day, [start, end]]) => `${DAY_LABELS_SHORT[day] ?? day} ${fmt(start)}-${fmt(end)}`)
    .join(', ')
}

const ADMIN_BASE = routes.verwaltung.offeringConfigs.index.href()

// ── Page-specific styles ──
const dayRowStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  padding: `${theme.space.xs} 0`,
})
const selectStyle = css({
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
})
const timeSelectStyle = css({
  width: '90px',
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
})
const dayCheckboxStyle = css({
  width: '18px',
  height: '18px',
  cursor: 'pointer',
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
const colActionsWidth = css({ width: '96px' })
// actionsStyle and editingRowStyle moved to mixin (table.actions, table.editingRow)

export function AdminOfferingConfigsPage(handle: Handle<AdminOfferingConfigsPageProps>) {
  return () => {
    let {
      rows,
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
      resources,
      formValues,
      fieldErrors,
      formError,
    } = handle.props
    let pageStart = rows.length > 0 ? offset + 1 : 0
    let pageEnd = offset + rows.length
    let hasFormPanel = !!(editRow || creating)

    let gridSection = (
      <div mix={[table.minWidth0, hasFormPanel ? table.twoColumnGrid : verwaltungGridFill]}>
        <ConfirmDelete />
        {formError ? (
          <div mix={table.errorBanner} role="alert">
            {formError}
          </div>
        ) : null}
        <form
          method="GET"
          action={routes.verwaltung.offeringConfigs.index.href()}
          data-rmx-target={getSelfFrameTarget()}
          mix={table.filterBar}
        >
          <input
            type="text"
            name="filter"
            placeholder="Suche nach Ressource..."
            defaultValue={filter ?? ''}
            mix={table.filterInput}
          />
          <button type="submit" mix={table.searchBtn}>
            <Glyph name="search" width={14} height={14} /> Suchen
          </button>
          {filter && (
            <a href={routes.verwaltung.offeringConfigs.index.href()} mix={table.clearLink}>
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

        <div
          mix={[table.wrap, table.mobileCards, verwaltungGridWrap, verwaltungGridDensity]}
          data-grid-scroll="true"
          data-offering-configs-table="true"
        >
          {rows.length === 0 ? (
            <div mix={table.empty}>
              {filter
                ? 'Keine Konfigurationen gefunden f\u00fcr diese Suche.'
                : 'Keine Konfigurationen vorhanden.'}
              {!hasFormPanel && (
                <div mix={css({ marginTop: theme.space.md })}>
                  <a
                    href={buildCreateUrl(ADMIN_BASE, offset, sortColumn, sortDirection, filter)}
                    data-rmx-target={getSelfFrameTarget()}
                    mix={[table.linkPlain, buttonLink({ tone: 'primary' })]}
                  >
                    <Glyph name="add" width={14} height={14} /> Neu anlegen
                  </a>
                </div>
              )}
            </div>
          ) : (
            <table mix={table.table}>
              <colgroup>
                <col />
                <col />
                <col />
                <col mix={css({ width: '160px' })} />
                <col mix={colActionsWidth} />
              </colgroup>
              <thead>
                <tr>
                  <th mix={table.thSortable}>
                    <a
                      href={buildSortUrl(
                        ADMIN_BASE,
                        'resource_description',
                        sortColumn,
                        sortDirection,
                        offset,
                        filter,
                      )}
                      data-rmx-target={getSelfFrameTarget()}
                      mix={table.sortLink}
                    >
                      Ressource
                      <span
                        mix={
                          'resource_description' === sortColumn
                            ? table.sortArrowActive
                            : table.sortArrow
                        }
                      >
                        {sortArrow('resource_description', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={table.th}>Beschreibung</th>
                  <th mix={table.th}>Regeln</th>
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
                  <th mix={table.th}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    mix={[table.row, editRow?.id === row.id ? table.editingRow : undefined]}
                    data-row-id={row.id}
                  >
                    <td mix={table.td} data-label="Ressource" title={row.resource_name ?? ''}>
                      {row.resource_name ?? '\u2014'}
                    </td>
                    <td
                      mix={table.td}
                      data-label="Beschreibung"
                      title={row.resource_description ?? ''}
                    >
                      {row.resource_description ?? '\u2014'}
                    </td>
                    <td
                      mix={[table.td, css({ fontSize: '11px' })]}
                      data-label="Regeln"
                      title={rulesSummary(row.rules)}
                    >
                      {rulesSummary(row.rules)}
                    </td>
                    <td
                      mix={table.td}
                      data-label="Aktualisiert"
                      title={formatTimestamp(row.updated_at)}
                    >
                      {formatTimestamp(row.updated_at)}
                    </td>
                    <td mix={table.actionCell} data-label="Aktionen">
                      <div mix={rowActionsStyle}>
                        <a
                          href={buildEditUrl(
                            ADMIN_BASE,
                            row.id,
                            offset,
                            sortColumn,
                            sortDirection,
                            filter,
                          )}
                          data-rmx-target={getSelfFrameTarget()}
                          mix={iconActionStyle}
                          aria-label="Bearbeiten"
                          title="Bearbeiten"
                        >
                          <Glyph name="edit" width={14} height={14} />
                        </a>
                        <RestfulForm
                          method="DELETE"
                          action={routes.verwaltung.offeringConfigs.destroy.href({ id: row.id })}
                          data-delete-form={row.id}
                          data-confirm="Wirklich löschen?"
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
                ))}
              </tbody>
            </table>
          )}
        </div>

        {rows.length > 0 && (
          <div mix={table.pagination}>
            {rows.length > 0 && (
              <span mix={table.paginationInfo}>
                Zeige {pageStart}
                {'\u2013'}
                {pageEnd}
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
                  data-rmx-target={getSelfFrameTarget()}
                  mix={table.pageLink}
                >
                  <Glyph name="chevronRight" width={14} height={14} mix={rotatedGlyphCss} />{' '}
                  {'Zur\u00fcck'}
                </a>
              ) : (
                <span mix={table.pageLinkDisabled}>
                  <Glyph name="chevronRight" width={14} height={14} mix={rotatedGlyphCss} />{' '}
                  {'Zur\u00fcck'}
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
              <PageSizeControl
                action={routes.verwaltung.pageSize.href()}
                pageKey={pageKey}
                pageSize={Math.max(1, nextOffset - offset)}
                pageSizeOverride={pageSizeOverride}
                controlId="offering-configs-page-size"
              />
            </div>
          </div>
        )}

        {/* Context menu data and clientEntry */}
        <GridStateScript
          id="offering-configs-grid-state"
          baseHref={routes.verwaltung.offeringConfigs.index.href()}
          offset={offset}
          sort={sortColumn}
          order={sortDirection}
          filter={filter}
        />
        <AdminOfferingConfigsContextMenu />
      </div>
    )

    if (editRow || creating) {
      return (
        <PageSection
          title="Angebotskonfigurationen"
          description="Zeitraster-Konfigurationen für Ressourcen."
        >
          <div mix={table.pageWide}>
            <div mix={table.twoColumn}>
              {gridSection}
              <div mix={table.stickyPanel}>
                {editRow ? (
                  <EditPanel
                    row={editRow}
                    resources={resources}
                    offset={String(offset)}
                    sort={sortColumn}
                    order={sortDirection}
                    filter={filter}
                    formValues={formValues}
                    fieldErrors={fieldErrors}
                  />
                ) : (
                  <CreatePanel
                    resources={resources}
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
      <PageSection title="Angebotskonfigurationen" titleHidden compact>
        <div mix={[table.page, verwaltungGridFill]}>{gridSection}</div>
      </PageSection>
    )
  }
}

interface EditPanelProps {
  row: OfferingConfigRow
  resources: OfferingConfigResourceOption[]
  offset?: string
  sort?: string
  order?: string
  filter?: string | undefined
  formValues?: Record<string, string> | undefined
  fieldErrors?: Record<string, string> | undefined
}

function EditPanel(handle: Handle<EditPanelProps>) {
  return () => {
    let {
      row,
      resources,
      offset = '',
      sort = '',
      order = '',
      filter = '',
      formValues,
      fieldErrors,
    } = handle.props
    let rules: Record<string, [number, number]> = row.rules ?? {}
    let selectedResourceId = formValues?.resource_id
      ? Number(formValues.resource_id)
      : Number(row.resource_id)
    let resourceError = fieldErrors?.resource_id
    return (
      <div
        mix={animateEntrance(entrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 }))}
      >
        <RestfulForm
          method="PUT"
          action={routes.verwaltung.offeringConfigs.update.href({ id: row.id })}
        >
          <GridStateHiddenInputs state={{ offset, sort, order, filter }} />
          <FormErrorFocus />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={table.panelTitle}>Konfiguration bearbeiten</span>
            </div>

            <div mix={table.panelBody}>
              <div mix={table.fieldGroup}>
                <label mix={table.label} for="oc-resource">
                  Ressource
                </label>
                <select
                  id="oc-resource"
                  name="resource_id"
                  aria-invalid={resourceError ? 'true' : undefined}
                  mix={[
                    input.base,
                    input.focus,
                    selectStyle,
                    ...(resourceError ? [input.error] : []),
                  ]}
                >
                  {resources.map((r) => (
                    <option key={r.id} value={r.id} selected={Number(r.id) === selectedResourceId}>
                      {r.name}
                    </option>
                  ))}
                </select>
                {resourceError ? (
                  <div
                    role="alert"
                    mix={css({
                      color: theme.colors.action.danger.background,
                      fontSize: theme.fontSize.xs,
                      marginTop: theme.space.xs,
                    })}
                  >
                    {resourceError}
                  </div>
                ) : null}
              </div>

              {DAYS.map((day) => {
                let rule = rules[day.key]
                let checked = formValues ? formValues[`${day.key}_enabled`] === '1' : !!rule
                let startMin = formValues?.[`${day.key}_start`]
                  ? Number(formValues[`${day.key}_start`])
                  : rule
                    ? rule[0]
                    : 480
                let endMin = formValues?.[`${day.key}_end`]
                  ? Number(formValues[`${day.key}_end`])
                  : rule
                    ? rule[1]
                    : 1020
                return (
                  <DayRuleRow
                    dayKey={day.key}
                    dayLabel={day.label}
                    idPrefix="oc"
                    checked={checked}
                    startMin={startMin}
                    endMin={endMin}
                  />
                )
              })}

              <div mix={table.actions}>
                <PendingSubmitButton>Speichern</PendingSubmitButton>
                <a
                  href={buildCancelUrl(
                    routes.verwaltung.offeringConfigs.index.href(),
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

interface CreatePanelProps {
  resources: OfferingConfigResourceOption[]
  offset?: string
  sort?: string
  order?: string
  filter?: string | undefined
  formValues?: Record<string, string> | undefined
  fieldErrors?: Record<string, string> | undefined
}

function CreatePanel(handle: Handle<CreatePanelProps>) {
  return () => {
    let {
      resources,
      offset = '',
      sort = '',
      order = '',
      filter = '',
      formValues,
      fieldErrors,
    } = handle.props
    let selectedResourceId = formValues?.resource_id ? Number(formValues.resource_id) : undefined
    let resourceError = fieldErrors?.resource_id
    return (
      <div
        mix={animateEntrance(entrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 }))}
      >
        <RestfulForm method="POST" action={routes.verwaltung.offeringConfigs.create.href()}>
          <GridStateHiddenInputs state={{ offset, sort, order, filter }} />
          <FormErrorFocus />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={table.panelTitle}>Neue Konfiguration</span>
            </div>

            <div mix={table.panelBody}>
              <div mix={table.fieldGroup}>
                <label mix={table.label} for="oc-resource-c">
                  Ressource
                </label>
                <select
                  id="oc-resource-c"
                  name="resource_id"
                  required
                  aria-invalid={resourceError ? 'true' : undefined}
                  mix={[
                    input.base,
                    input.focus,
                    selectStyle,
                    ...(resourceError ? [input.error] : []),
                  ]}
                >
                  <option value="" disabled selected={!selectedResourceId}>
                    Ressource auswählen
                  </option>
                  {resources.map((r) => (
                    <option key={r.id} value={r.id} selected={selectedResourceId === Number(r.id)}>
                      {r.name}
                    </option>
                  ))}
                </select>
                {resourceError ? (
                  <div
                    role="alert"
                    mix={css({
                      color: theme.colors.action.danger.background,
                      fontSize: theme.fontSize.xs,
                      marginTop: theme.space.xs,
                    })}
                  >
                    {resourceError}
                  </div>
                ) : null}
              </div>

              {DAYS.map((day) => {
                let checked = formValues?.[`${day.key}_enabled`] === '1'
                let startMin = Number(formValues?.[`${day.key}_start`] ?? 480)
                let endMin = Number(formValues?.[`${day.key}_end`] ?? 1020)
                return (
                  <DayRuleRow
                    dayKey={day.key}
                    dayLabel={day.label}
                    idPrefix="oc-c"
                    checked={checked}
                    startMin={startMin}
                    endMin={endMin}
                  />
                )
              })}

              <div mix={table.actions}>
                <PendingSubmitButton>Anlegen</PendingSubmitButton>
                <a
                  href={buildCancelUrl(
                    routes.verwaltung.offeringConfigs.index.href(),
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
