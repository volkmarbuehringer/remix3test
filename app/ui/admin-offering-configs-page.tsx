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
  buildCancelUrl,
  formatTimestamp,
} from './mixins/admin-urls.ts'

import { frames, routes } from '../routes.ts'
import { RestfulForm } from './restful-form.tsx'
import { GridStateHiddenInputs } from './grid-state-hidden.tsx'
import type {
  OfferingConfigRow,
  OfferingConfigResourceOption,
} from '../data/offering-configs-queries.ts'
import { ConfirmDelete } from '../ui/confirm-delete.browser.tsx'
import { getCspNonce } from '../middleware/security-headers.ts'
import { AdminOfferingConfigsContextMenu } from '../actions/admin/public/admin-offering-configs-context-menu.tsx'

interface AdminOfferingConfigsPageProps {
  rows: OfferingConfigRow[]
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
  editRow?: OfferingConfigRow | null
  creating?: boolean
  resources: OfferingConfigResourceOption[]
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
  formError?: string
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
// actionsStyle and editingRowStyle moved to mixin (table.actions, table.editingRow)

export function AdminOfferingConfigsPage(handle: Handle<AdminOfferingConfigsPageProps>) {
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
      resources,
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
        <form
          method="GET"
          action={routes.verwaltung.offeringConfigs.index.href()}
          data-rmx-target={frames.adminContent}
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
            <a
              href={routes.verwaltung.offeringConfigs.index.href()}
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

        <div mix={table.wrap} data-offering-configs-table="true">
          {rows.length === 0 ? (
            <div mix={table.empty}>
              {filter
                ? 'Keine Konfigurationen gefunden f\u00fcr diese Suche.'
                : 'Keine Konfigurationen vorhanden.'}
            </div>
          ) : (
            <table mix={table.table}>
              <colgroup>
                <col />
                <col />
                <col />
                <col mix={css({ width: '160px' })} />
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
                      data-rmx-target={frames.adminContent}
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
                    <td mix={table.td} title={row.resource_name ?? ''}>
                      {row.resource_name ?? '\u2014'}
                    </td>
                    <td mix={table.td} title={row.resource_description ?? ''}>
                      {row.resource_description ?? '\u2014'}
                    </td>
                    <td mix={[table.td, css({ fontSize: '11px' })]} title={rulesSummary(row.rules)}>
                      {rulesSummary(row.rules)}
                    </td>
                    <td mix={table.td} title={formatTimestamp(row.updated_at)}>
                      {formatTimestamp(row.updated_at)}
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
                  action={routes.verwaltung.offeringConfigs.destroy.href({ id: row.id })}
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

        {(offset > 0 || hasMore) && (
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
                  data-rmx-target={frames.adminContent}
                  mix={table.pageLink}
                >
                  <Glyph
                    name="chevronRight"
                    width={14}
                    height={14}
                    mix={rotatedGlyphCss}
                  />{' '}
                  {'Zur\u00fcck'}
                </a>
              ) : (
                <span mix={table.pageLinkDisabled}>
                  <Glyph
                    name="chevronRight"
                    width={14}
                    height={14}
                    mix={rotatedGlyphCss}
                  />{' '}
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

        {/* Context menu data and clientEntry */}
        <script id="offering-configs-grid-state" type="application/json" nonce={getCspNonce()}>
          {JSON.stringify({
            offset: String(offset),
            sort: sortColumn,
            order: sortDirection,
            filter: filter ?? '',
            baseHref: routes.verwaltung.offeringConfigs.index.href(),
          })}
        </script>
        <AdminOfferingConfigsContextMenu />
      </div>
    )

    if (editRow || creating) {
      return (
        <div mix={table.page}>
          <h2 mix={table.title}>Angebotskonfigurationen</h2>
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
      )
    }

    return (
      <div mix={table.page}>
        <h2 mix={table.title}>Angebotskonfigurationen</h2>
        {gridSection}
      </div>
    )
  }
}

interface EditPanelProps {
  row: OfferingConfigRow
  resources: OfferingConfigResourceOption[]
  offset?: string
  sort?: string
  order?: string
  filter?: string
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
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
    let hasResourceError = !!fieldErrors?.resource_id
    return (
      <div
        mix={animateEntrance(entrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 }))}
      >
        <RestfulForm
          method="PUT"
          action={routes.verwaltung.offeringConfigs.update.href({ id: row.id })}
        >
          <GridStateHiddenInputs state={{ offset, sort, order, filter }} />

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
                  mix={[
                    input.base,
                    input.focus,
                    selectStyle,
                    ...(hasResourceError ? [input.error] : []),
                  ]}
                >
                  {resources.map((r) => (
                    <option key={r.id} value={r.id} selected={Number(r.id) === selectedResourceId}>
                      {r.name}
                    </option>
                  ))}
                </select>
                {hasResourceError ? (
                  <div
                    mix={css({
                      color: theme.colors.action.danger.background,
                      fontSize: theme.fontSize.xs,
                      marginTop: theme.space.xs,
                    })}
                  >
                    {fieldErrors!.resource_id}
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
                <button type="submit" mix={[button({ tone: 'primary' }), table.spacer]}>
                  Speichern
                </button>
                <a
                  href={buildCancelUrl(
                    routes.verwaltung.offeringConfigs.index.href(),
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

interface CreatePanelProps {
  resources: OfferingConfigResourceOption[]
  offset?: string
  sort?: string
  order?: string
  filter?: string
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
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
    let hasResourceError = !!fieldErrors?.resource_id
    return (
      <div
        mix={animateEntrance(entrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 }))}
      >
        <RestfulForm method="POST" action={routes.verwaltung.offeringConfigs.create.href()}>
          <GridStateHiddenInputs state={{ offset, sort, order, filter }} />

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
                  mix={[
                    input.base,
                    input.focus,
                    selectStyle,
                    ...(hasResourceError ? [input.error] : []),
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
                {hasResourceError ? (
                  <div
                    mix={css({
                      color: theme.colors.action.danger.background,
                      fontSize: theme.fontSize.xs,
                      marginTop: theme.space.xs,
                    })}
                  >
                    {fieldErrors!.resource_id}
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
                <button type="submit" mix={[button({ tone: 'primary' }), table.spacer]}>
                  Anlegen
                </button>
                <a
                  href={buildCancelUrl(
                    routes.verwaltung.offeringConfigs.index.href(),
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
