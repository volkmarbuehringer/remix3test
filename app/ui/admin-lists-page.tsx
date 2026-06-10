import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../lib/theme.ts'

import { routes, frames } from '../routes.ts'
import { AdminActionButton } from '../assets/admin-action-button.tsx'
import { CsrfTokenInput } from './csrf-token-input.tsx'

interface ListRowData {
  id: number
  list: Array<{ id: string; label: string }>
  description: string
  created_at: number
  updated_at: number
}

interface AdminListsPageProps {
  lists: ListRowData[]
  offset: number
  hasMore: boolean
  filter?: string
  prevOffset: number
  nextOffset: number
}

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleDateString('de')
}

function formatPreview(items: Array<{ label: string }>): string {
  if (!Array.isArray(items) || items.length === 0) return '(leer)'
  let labels = items.map((i) => i.label)
  if (labels.length <= 5) return labels.join(', ')
  return labels.slice(0, 5).join(', ') + ` (+${labels.length - 5} weitere)`
}

// ── Styles ──

const filterBarStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  marginBottom: theme.space.md,
})

const filterInputStyle = css({
  flex: '1',
  maxWidth: '300px',
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
  '&::placeholder': { color: theme.colors.text.muted },
})

const searchBtnStyle = css({
  padding: `${theme.space.xs} ${theme.space.md}`,
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  border: 'none',
  borderRadius: theme.radius.md,
  fontSize: theme.fontSize.sm,
  cursor: 'pointer',
  '&:hover': { opacity: 0.9 },
})

const clearLinkStyle = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
  textDecoration: 'none',
  '&:hover': {
    color: theme.colors.text.primary,
    textDecoration: 'underline',
  },
})

const pageStyle = css({
  maxWidth: '900px',
})

const titleStyle = css({
  margin: 0,
  fontSize: theme.fontSize.xxl,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

const descriptionStyle = css({
  margin: `0 0 ${theme.space.lg}`,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
})

const tableWrapStyle = css({
  marginBottom: theme.space.xl,
  background: theme.surface.lvl1,
  borderRadius: theme.radius.lg,
  border: `1px solid ${theme.colors.border.default}`,
  overflow: 'hidden',
})

const tableStyle = css({
  width: '100%',
  tableLayout: 'fixed',
  borderCollapse: 'collapse',
  fontSize: theme.fontSize.sm,
})

const thStyle = css({
  textAlign: 'left',
  padding: `${theme.space.sm} ${theme.space.md}`,
  background: theme.surface.lvl2,
  color: theme.colors.text.secondary,
  fontWeight: theme.fontWeight.semibold,
  fontSize: theme.fontSize.xs,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  borderBottom: `1px solid ${theme.colors.border.default}`,
})

const tdStyle = css({
  padding: `${theme.space.sm} ${theme.space.md}`,
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
  color: theme.colors.text.primary,
  verticalAlign: 'top',
})

// ── Column width styles ──

const colIdWidth = css({ width: '50px' })
const colItemsWidth = css({ width: '60px' })
const colDescWidth = css({ width: '220px' })
const colCreatedWidth = css({ width: '165px' })
const colUpdatedWidth = css({ width: '165px' })
const colActionsWidth = css({ width: '60px' })

const idStyle = css({
  fontFamily: 'monospace',
  color: theme.colors.text.muted,
  fontSize: theme.fontSize.xs,
})

const itemCountBadgeStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '28px',
  padding: `${theme.space.xs} ${theme.space.sm}`,
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  borderRadius: theme.radius.full,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
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
  border: `1px solid ${theme.colors.border.subtle}`,
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

const emptyStateStyle = css({
  textAlign: 'center',
  padding: theme.space.xxl,
  color: theme.colors.text.muted,
})

const paginationStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: theme.space.md,
  background: theme.surface.lvl0,
  borderRadius: theme.radius.md,
  border: `1px solid ${theme.colors.border.default}`,
})

const paginationInfoStyle = css({
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.muted,
})

const pageLinkStyle = css({
  padding: `${theme.space.sm} ${theme.space.md}`,
  background: theme.surface.lvl2,
  color: theme.colors.text.secondary,
  borderRadius: theme.radius.md,
  fontSize: theme.fontSize.sm,
  textDecoration: 'none',
  '&:hover': {
    background: theme.surface.lvl3,
    color: theme.colors.text.primary,
  },
})

// ── Page component ──

function buildPaginationUrl(newOffset: number, filter?: string): string {
  let params = new URLSearchParams()
  params.set('offset', String(newOffset))
  if (filter) params.set('filter', filter)
  return routes.admin.lists.index.href() + '?' + params.toString()
}

export function AdminListsPage(handle: Handle<AdminListsPageProps>) {
  return () => {
    let { lists, offset, hasMore, filter, prevOffset, nextOffset } = handle.props
    let pageStart = lists.length > 0 ? offset + 1 : 0
    let pageEnd = offset + lists.length

    return (
      <div mix={pageStyle}>
        <h2 mix={titleStyle}>Gespeicherte Listen</h2>
        <p mix={descriptionStyle}>
          Alle von Benutzern gespeicherten Listen. Jede Zeile repräsentiert einen Speichervorgang.
        </p>

        {/* Filter bar */}
        <form method="GET" action={routes.admin.lists.index.href()} rmx-target={frames.adminContent} mix={filterBarStyle}>
          <input
            type="text"
            name="filter"
            placeholder="Nach Element oder Beschreibung suchen…"
            defaultValue={filter ?? ''}
            mix={filterInputStyle}
          />
          <button type="submit" mix={searchBtnStyle}>
            Suchen
          </button>
          {filter && (
            <a href={routes.admin.lists.index.href()} rmx-target={frames.adminContent} mix={clearLinkStyle}>
              Zurücksetzen
            </a>
          )}
        </form>

        <div mix={tableWrapStyle}>
          {lists.length === 0 ? (
            <div mix={emptyStateStyle}>
              {filter
                ? 'Keine Listen für diese Suche gefunden.'
                : 'Noch keine Listen gespeichert.'}
            </div>
          ) : (
            <table mix={tableStyle}>
              <thead>
                <tr>
                  <th mix={[thStyle, colIdWidth]}>ID</th>
                  <th mix={[thStyle, colItemsWidth]}>Elemente</th>
                  <th mix={thStyle}>Vorschau</th>
                  <th mix={[thStyle, colDescWidth]}>Beschreibung</th>
                  <th mix={[thStyle, colCreatedWidth]}>Erstellt</th>
                  <th mix={[thStyle, colUpdatedWidth]}>Aktualisiert</th>
                  <th mix={[thStyle, colActionsWidth]}>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {lists.map((row) => {
                  let items = Array.isArray(row.list) ? row.list : []
                  return (
                    <tr key={row.id}>
                      <td mix={[tdStyle, colIdWidth]}>
                        <span mix={idStyle}>{row.id}</span>
                      </td>
                      <td mix={[tdStyle, colItemsWidth]}>
                        <span mix={itemCountBadgeStyle}>{items.length}</span>
                      </td>
                      <td mix={tdStyle}>
                        <div mix={previewTextStyle}>{formatPreview(items)}</div>
                        {items.length > 0 && (
                          <details>
                            <summary mix={summaryStyle}>Alle {items.length} Elemente anzeigen</summary>
                            <div mix={detailsStyle}>
                              {items.map((item, idx) => (
                                <div key={item.id}>
                                  <span mix={css({ color: theme.colors.text.muted, marginRight: '4px' })}>{idx + 1}.</span>
                                  {item.label}
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </td>
                      <td mix={[tdStyle, colDescWidth]}>
                        {row.description
                          ? <a href={`/lists?load=${row.id}`} target="_top" mix={descLinkStyle} title={row.description}>{row.description}</a>
                          : <span mix={descEmptyStyle}>(keine Beschreibung)</span>
                        }
                      </td>
                      <td mix={[tdStyle, colCreatedWidth]}>{formatTimestamp(row.created_at)}</td>
                      <td mix={[tdStyle, colUpdatedWidth]}>{formatTimestamp(row.updated_at)}</td>
                      <td mix={[tdStyle, colActionsWidth]}>
                        <div mix={css({ display: 'flex', gap: theme.space.xs, alignItems: 'center' })}>
                          <form
                            method="POST"
                            action={routes.admin.lists.destroy.href({ id: row.id })}
                            mix={css({ margin: 0, padding: 0 })}
                          >
                            <CsrfTokenInput />
                            <AdminActionButton
                              action={routes.admin.lists.destroy.href({ id: row.id })}
                              method="POST"
                              label="Löschen"
                              pendingLabel="Wird gelöscht…"
                              confirmMsg={`Liste #${row.id} (${items.length} Elemente) löschen?`}
                              compact
                            />
                          </form>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {(offset > 0 || hasMore) && (
          <div mix={paginationStyle}>
            {lists.length > 0 && (
              <span mix={paginationInfoStyle}>
                Zeige {pageStart}–{pageEnd}
              </span>
            )}
            <div mix={css({ display: 'flex', gap: '0.5rem' })}>
              {offset > 0 && (
                <a
                  href={buildPaginationUrl(prevOffset, filter)}
                  rmx-target={frames.adminContent}
                  mix={pageLinkStyle}
                >
                  ← Neuere
                </a>
              )}
              {hasMore && (
                <a
                  href={buildPaginationUrl(nextOffset, filter)}
                  rmx-target={frames.adminContent}
                  mix={pageLinkStyle}
                >
                  Ältere →
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }
}
