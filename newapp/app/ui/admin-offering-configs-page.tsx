import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { Button } from 'remix/ui/button'
import { Glyph } from 'remix/ui/glyph'
import { animateEntrance } from 'remix/ui/animation'
import { input } from './mixins/input.ts'

import { frames } from '../routes.ts'
import { RestfulForm } from './restful-form.tsx'
import { GridStateHiddenInputs } from './grid-state-hidden.tsx'
import { gridStateToParams } from '../utils/grid-state.ts'
import type { OfferingConfigRow, ResourceOption } from '../actions/admin-offering-configs-controller.tsx'

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
  resources: ResourceOption[]
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
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
}

const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => i * 60)
const TIME_END_OPTIONS = Array.from({ length: 24 }, (_, i) => (i + 1) * 60)

function fmt(minutes: number): string {
  let h = String(Math.floor(minutes / 60)).padStart(2, '0')
  let m = String(minutes % 60).padStart(2, '0')
  return `${h}:${m}`
}

function rulesSummary(rules: Record<string, [number, number]> | null | undefined): string {
  if (!rules || Object.keys(rules).length === 0) return '\u2014'
  return Object.entries(rules)
    .map(([day, [start, end]]) => `${DAY_LABELS_SHORT[day] ?? day} ${fmt(start)}-${fmt(end)}`)
    .join(', ')
}

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
  return '/admin/offering-configs?' + params.toString()
}

function buildPaginationUrl(
  newOffset: number, sort: string, order: 'asc' | 'desc', filter?: string,
): string {
  let params = new URLSearchParams()
  params.set('offset', String(newOffset))
  params.set('sort', sort)
  params.set('order', order)
  if (filter) params.set('filter', filter)
  return '/admin/offering-configs?' + params.toString()
}

function buildCreateUrl(offset: number, sort: string, order: string, filter?: string): string {
  let params = new URLSearchParams()
  params.set('creating', 'true')
  if (offset > 0) params.set('offset', String(offset))
  params.set('sort', sort)
  params.set('order', order)
  if (filter) params.set('filter', filter)
  return '/admin/offering-configs?' + params.toString()
}

function buildEditUrl(id: string | number, offset: number, sort: string, order: string, filter?: string): string {
  let params = new URLSearchParams()
  params.set('editing', String(id))
  params.set('offset', String(offset))
  params.set('sort', sort)
  params.set('order', order)
  if (filter) params.set('filter', filter)
  return '/admin/offering-configs?' + params.toString()
}

function formatTimestamp(ts: number | string | null | undefined): string {
  if (ts == null) return '\u2014'
  return new Date(Number(ts)).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

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
const dayRowStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  padding: `${theme.space.xs} 0`,
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
const actionsStyle = css({
  display: 'flex',
  gap: theme.space.sm,
  marginTop: theme.space.lg,
  paddingTop: theme.space.md,
  borderTop: `1px solid ${theme.colors.border.default}`,
})

export function AdminOfferingConfigsPage(handle: Handle<AdminOfferingConfigsPageProps>) {
  return () => {
    let {
      rows, offset, hasMore, prevOffset, nextOffset,
      sortColumn, sortDirection, filter,
      editRow = null, creating = false, resources,
    } = handle.props
    let pageStart = rows.length > 0 ? offset + 1 : 0
    let pageEnd = offset + rows.length

    let gridSection = (
      <div style="min-width:0">
        <form
          method="GET"
          action="/admin/offering-configs"
          rmx-target={frames.adminContent}
          mix={filterBarStyle}
        >
          <input
            type="text"
            name="filter"
            placeholder="Suche nach Ressource..."
            defaultValue={filter ?? ''}
            mix={filterInputStyle}
          />
          <button type="submit" mix={searchBtnStyle}>Suchen</button>
          {filter && (
            <a
              href="/admin/offering-configs"
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

        <div mix={tableWrapStyle}>
          {rows.length === 0 ? (
            <div mix={emptyStateStyle}>
              {filter
                ? 'Keine Konfigurationen gefunden f\u00fcr diese Suche.'
                : 'Keine Konfigurationen vorhanden.'}
            </div>
          ) : (
            <table mix={tableStyle}>
              <colgroup>
                <col style={{ width: '60px' }} />
                <col />
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
                    <a href={buildSortUrl('resource_description', sortColumn, sortDirection, offset, filter)}
                       rmx-target={frames.adminContent} mix={sortLinkStyle}>
                      Ressource
                      <span mix={'resource_description' === sortColumn ? sortArrowActiveStyle : sortArrowStyle}>
                        {sortArrow('resource_description', sortColumn, sortDirection)}
                      </span>
                    </a>
                  </th>
                  <th mix={thStyle}>Regeln</th>
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
                    <td mix={tdStyle} title={row.resource_description ?? ''}>{row.resource_description}</td>
                    <td mix={tdStyle} title={rulesSummary(row.rules)} style={{ fontSize: '11px' }}>{rulesSummary(row.rules)}</td>
                    <td mix={tdStyle} title={formatTimestamp(row.created_at)}>{formatTimestamp(row.created_at)}</td>
                    <td mix={tdStyle} title={formatTimestamp(row.updated_at)}>{formatTimestamp(row.updated_at)}</td>
                    <td mix={actionCellStyle}>
                      <div mix={btnGroupStyle}>
                        <a
                          href={buildEditUrl(row.id, offset, sortColumn, sortDirection, filter)}
                          rmx-target={frames.adminContent}
                          mix={editBtnStyle}
                        >
                          <Glyph name="edit" width={14} height={14} />
                        </a>
                        <RestfulForm
                          method="DELETE"
                          action={`/admin/offering-configs/${row.id}`}
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

        {(offset > 0 || hasMore) && (
          <div mix={paginationStyle}>
            {rows.length > 0 && (
              <span mix={paginationInfoStyle}>Zeige {pageStart}{'\u2013'}{pageEnd}</span>
            )}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {offset > 0 ? (
                <a
                  href={buildPaginationUrl(prevOffset, sortColumn, sortDirection, filter)}
                  rmx-target={frames.adminContent}
                  mix={pageLinkStyle}
                ><Glyph name="chevronRight" width={14} height={14} style={{ transform: 'rotate(180deg)' }} /> {'Zur\u00fcck'}</a>
              ) : (
                <span mix={pageLinkDisabledStyle}><Glyph name="chevronRight" width={14} height={14} style={{ transform: 'rotate(180deg)' }} /> {'Zur\u00fcck'}</span>
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

    if (editRow || creating) {
      return (
        <div mix={pageStyle}>
          <h2 mix={titleStyle}>Offering Configs</h2>
          <div mix={twoColumnStyle}>
            {gridSection}
            <div style="position:sticky;top:1.5rem">
              {editRow ? (
                <EditPanel
                  row={editRow}
                  resources={resources}
                  offset={String(offset)}
                  sort={sortColumn}
                  order={sortDirection}
                  filter={filter}
                />
              ) : (
                <CreatePanel
                  resources={resources}
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
        <h2 mix={titleStyle}>Offering Configs</h2>
        {gridSection}
      </div>
    )
  }
}

function cancelUrl(offset: string, sort: string, order: string, filter?: string): string {
  let qs = gridStateToParams({ offset, sort, order, filter: filter ?? '' }).toString()
  return '/admin/offering-configs' + (qs ? '?' + qs : '')
}

interface EditPanelProps {
  row: OfferingConfigRow
  resources: ResourceOption[]
  offset?: string
  sort?: string
  order?: string
  filter?: string
}

function EditPanel(handle: Handle<EditPanelProps>) {
  return () => {
    let { row, resources, offset = '', sort = '', order = '', filter = '' } = handle.props
    let rules: Record<string, [number, number]> = row.rules ?? {}
    return (
      <div mix={animateEntrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 })}>
        <RestfulForm method="PUT" action={`/admin/offering-configs/${row.id}`}>
          <GridStateHiddenInputs state={{ offset, sort, order, filter }} />

          <div mix={panelStyle}>
            <div mix={panelHeaderStyle}>
              <span mix={panelTitleStyle}>Konfiguration bearbeiten</span>
            </div>

            <div mix={panelBodyStyle}>
              <div mix={fieldGroupStyle}>
                <label mix={labelStyle} for="oc-resource">Ressource</label>
                <select id="oc-resource" name="resource_id" mix={[input.base, input.focus, selectStyle]}>
                  {resources.map(r => (
                    <option key={r.id} value={r.id} selected={Number(r.id) === Number(row.resource_id)}>
                      {r.description}
                    </option>
                  ))}
                </select>
              </div>

              {DAYS.map((day) => {
                let rule = rules[day.key]
                let hasRule = !!rule
                let startMin = rule ? rule[0] : 480
                let endMin = rule ? rule[1] : 1020
                return (
                  <div key={day.key} mix={dayRowStyle}>
                    <input
                      type="checkbox"
                      id={`oc-${day.key}`}
                      name={`${day.key}_enabled`}
                      value="1"
                      checked={hasRule}
                      mix={dayCheckboxStyle}
                    />
                    <label for={`oc-${day.key}`} mix={css({ width: '100px', fontSize: theme.fontSize.sm, cursor: 'pointer' })}>
                      {day.label}
                    </label>
                    <select name={`${day.key}_start`} mix={timeSelectStyle}>
                      {TIME_OPTIONS.map((min) => (
                        <option key={min} value={min} selected={min === startMin}>
                          {fmt(min)}
                        </option>
                      ))}
                    </select>
                    <span mix={css({ fontSize: theme.fontSize.sm, color: theme.colors.text.muted })}>{'\u2013'}</span>
                    <select name={`${day.key}_end`} mix={timeSelectStyle}>
                      {TIME_END_OPTIONS.map((min) => (
                        <option key={min} value={min} selected={min === endMin}>
                          {fmt(min)}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })}

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

interface CreatePanelProps {
  resources: ResourceOption[]
  offset?: string
  sort?: string
  order?: string
  filter?: string
}

function CreatePanel(handle: Handle<CreatePanelProps>) {
  return () => {
    let { resources, offset = '', sort = '', order = '', filter = '' } = handle.props
    return (
      <div mix={animateEntrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 })}>
        <RestfulForm method="POST" action="/admin/offering-configs">
          <GridStateHiddenInputs state={{ offset, sort, order, filter }} />

          <div mix={panelStyle}>
            <div mix={panelHeaderStyle}>
              <span mix={panelTitleStyle}>Neue Konfiguration</span>
            </div>

            <div mix={panelBodyStyle}>
              <div mix={fieldGroupStyle}>
                <label mix={labelStyle} for="oc-resource-c">Ressource</label>
                <select id="oc-resource-c" name="resource_id" required mix={[input.base, input.focus, selectStyle]}>
                  <option value="" disabled selected>Ressource ausw\u00e4hlen</option>
                  {resources.map(r => (
                    <option key={r.id} value={r.id}>{r.description}</option>
                  ))}
                </select>
              </div>

              {DAYS.map((day) => (
                <div key={day.key} mix={dayRowStyle}>
                  <input
                    type="checkbox"
                    id={`oc-c-${day.key}`}
                    name={`${day.key}_enabled`}
                    value="1"
                    mix={dayCheckboxStyle}
                  />
                  <label for={`oc-c-${day.key}`} mix={css({ width: '100px', fontSize: theme.fontSize.sm, cursor: 'pointer' })}>
                    {day.label}
                  </label>
                  <select name={`${day.key}_start`} mix={timeSelectStyle}>
                    {TIME_OPTIONS.map((min) => (
                      <option key={min} value={min}>{fmt(min)}</option>
                    ))}
                  </select>
                  <span mix={css({ fontSize: theme.fontSize.sm, color: theme.colors.text.muted })}>{'\u2013'}</span>
                  <select name={`${day.key}_end`} mix={timeSelectStyle}>
                    {TIME_END_OPTIONS.map((min) => (
                      <option key={min} value={min}>{fmt(min)}</option>
                    ))}
                  </select>
                </div>
              ))}

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
