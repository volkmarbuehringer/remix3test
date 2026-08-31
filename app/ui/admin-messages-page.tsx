import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'
import { Glyph } from '../ui/theme/glyph/glyph.tsx'
import { rotatedGlyphCss } from './mixins/icon.ts'
import { input } from './mixins/input.ts'
import { table } from './mixins/admin-table.ts'
import button from '../ui/theme/button.ts'
import { formatTimestamp } from './mixins/admin-urls.ts'

import { routes } from '../routes.ts'
import { getSelfFrameTarget } from '../utils/frame-target.ts'
import { CsrfTokenInput } from './csrf-token-input.tsx'
import { ConnectionIndicator } from '../ui/connection-indicator.browser.tsx'
import { RestfulForm } from './restful-form.tsx'
import { GridStateHiddenInputs } from './grid-state-hidden.tsx'
import { ConfirmDelete } from './confirm-delete.browser.tsx'
import { MessageExpand } from './message-expand.browser.tsx'

const ADMIN_BASE = routes.admin.messages.index.href()

interface MessageRow {
  id: number
  sender_id: number
  sender_name: string
  content: string
  created_at: number
}

interface AdminMessagesPageProps {
  messages: MessageRow[]
  offset: number
  hasMore: boolean
  pageSize: number
  prevOffset: number
  nextOffset: number
  filter?: string
}

// ── Styles ──

const headerRowStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: theme.space.sm,
  marginBottom: theme.space.md,
})

const descriptionStyle = css({
  margin: `0 0 ${theme.space.md}`,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
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

/**
 * Message preview — clamped to two lines so every row keeps a compact,
 * consistent height at any page size (e.g. 15). The full text stays in the DOM
 * (hover tooltip + click-to-expand via MessageExpand), the clamp is purely
 * visual.
 */
const contentCellStyle = css({
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  color: theme.colors.text.primary,
})

/** The content cell must not clip the expanded text (table.td sets overflow
 *  hidden + nowrap), so the wrapper lets the row grow and wraps naturally. */
const contentTdStyle = css({
  overflow: 'visible',
  whiteSpace: 'normal',
})

const expandBtnStyle = css({
  display: 'none',
  padding: 0,
  margin: `${theme.space.xs} 0 0`,
  border: 'none',
  background: 'none',
  color: theme.colors.action.primary.background,
  fontSize: theme.fontSize.xs,
  cursor: 'pointer',
  textDecoration: 'underline',
  textDecorationColor: theme.colors.border.default,
  '&:hover': { textDecorationColor: theme.colors.action.primary.background },
})

const textareaStyle = css({
  resize: 'vertical',
  minHeight: '40px',
  maxHeight: '240px',
})

/** Single row that holds the (GET) filter controls and the (POST) compose
 *  submit button. The submit button targets the compose form via its `form`
 *  attribute so the two forms stay valid and separate. */
const toolbarRowStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  flexWrap: 'wrap',
  marginBottom: theme.space.lg,
})

const filterFormStyle = css({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  flexWrap: 'wrap',
})

const colActionsWidth = css({ width: '80px' })

const pageBadgeStyle = css({
  padding: `${theme.space.xs} ${theme.space.sm}`,
  borderRadius: theme.radius.full,
  background: theme.surface.lvl2,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  whiteSpace: 'nowrap',
})

// ── Component ──

export function AdminMessagesPage(handle: Handle<AdminMessagesPageProps>) {
  return () => {
    let { messages, offset, hasMore, pageSize, prevOffset, nextOffset, filter } = handle.props
    let pageStart = messages.length > 0 ? offset + 1 : 0
    let pageEnd = offset + messages.length
    let currentPage = pageSize > 0 ? Math.floor(offset / pageSize) + 1 : 0

    let pageUrl = (newOffset: number): string => {
      let params = new URLSearchParams()
      if (newOffset > 0) params.set('offset', String(newOffset))
      if (filter) params.set('filter', filter)
      let qs = params.toString()
      return ADMIN_BASE + (qs ? '?' + qs : '')
    }

    return (
      <div mix={table.page}>
        <ConfirmDelete />
        <MessageExpand />
        <div mix={headerRowStyle}>
          <h2 mix={table.title}>Nachrichten</h2>
          <ConnectionIndicator url={routes.admin.messages.subscribe.href()} />
        </div>
        <p mix={descriptionStyle}>
          Öffentliche Nachrichten verwalten. Nur Admins können Nachrichten senden und löschen.
        </p>

        {/* Compose panel */}
        <form
          method="POST"
          id="messages-compose-form"
          action={routes.admin.messages.action.href()}
          data-rmx-target={getSelfFrameTarget()}
          mix={css({ marginBottom: theme.space.sm })}
        >
          <CsrfTokenInput />
          <div mix={table.panel}>
            <div mix={table.panelBody}>
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="messages-content">
                  Nachricht
                </label>
                <textarea
                  id="messages-content"
                  name="content"
                  required
                  maxLength={1000}
                  placeholder="Nachricht schreiben…"
                  mix={[input.base, input.focus, textareaStyle]}
                />
              </div>
            </div>
          </div>
        </form>

        {/* Toolbar: filter (GET) + compose submit (POST, via form attribute) */}
        <div mix={toolbarRowStyle}>
          <form
            method="GET"
            action={routes.admin.messages.index.href()}
            data-rmx-target={getSelfFrameTarget()}
            data-rmx-history="replace"
            mix={filterFormStyle}
          >
            <input
              type="text"
              name="filter"
              placeholder="Nach Inhalt oder Absender suchen…"
              defaultValue={filter ?? ''}
              aria-label="Nach Inhalt oder Absender suchen"
              mix={table.filterInput}
            />
            <input type="hidden" name="offset" value={String(offset)} />
            <button type="submit" mix={table.searchBtn}>
              <Glyph name="search" width={14} height={14} /> Suchen
            </button>
            {filter && (
              <a
                href={routes.admin.messages.index.href()}
                data-rmx-target={getSelfFrameTarget()}
                mix={table.clearLink}
              >
                Zurücksetzen
              </a>
            )}
          </form>
          <button type="submit" form="messages-compose-form" mix={button({ tone: 'primary' })}>
            <Glyph name="send" width={14} height={14} /> Nachricht senden
          </button>
        </div>

        {/* Messages grid */}
        <div mix={table.wrap} role="log" aria-live="polite" data-messages-table="true">
          {messages.length === 0 ? (
            <div mix={table.empty}>
              {filter
                ? 'Keine Nachrichten für diese Suche gefunden.'
                : 'Noch keine Nachrichten. Sende die erste!'}
            </div>
          ) : (
            <table mix={table.table}>
              <colgroup>
                <col mix={css({ width: '150px' })} />
                <col />
                <col mix={css({ width: '130px' })} />
                <col mix={colActionsWidth} />
              </colgroup>
              <thead>
                <tr>
                  <th mix={table.th}>Absender</th>
                  <th mix={table.th}>Nachricht</th>
                  <th mix={table.th}>Erstellt</th>
                  <th mix={table.th}>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((msg) => (
                  <tr key={msg.id} mix={table.row}>
                    <td mix={table.td} title={msg.sender_name}>
                      {msg.sender_name}
                    </td>
                    <td
                      mix={[table.td, contentTdStyle]}
                      title={msg.content}
                      data-message-cell={msg.id}
                    >
                      <span mix={contentCellStyle} data-message-text id={`message-${msg.id}`}>
                        {msg.content}
                      </span>
                      <button
                        type="button"
                        mix={expandBtnStyle}
                        data-expand-msg={msg.id}
                        data-label-more="Mehr"
                        data-label-less="Weniger"
                        aria-expanded="false"
                        aria-controls={`message-${msg.id}`}
                      >
                        Mehr
                      </button>
                    </td>
                    <td mix={table.td} title={formatTimestamp(msg.created_at)}>
                      {formatTimestamp(msg.created_at)}
                    </td>
                    <td mix={table.actionCell}>
                      <div mix={rowActionsStyle}>
                        <RestfulForm
                          method="POST"
                          action={routes.admin.messages.destroy.href({ id: msg.id })}
                          data-delete-form={msg.id}
                          data-confirm={`Nachricht von ${msg.sender_name} löschen?`}
                          data-rmx-target={getSelfFrameTarget()}
                          mix={css({ margin: 0, padding: 0 })}
                        >
                          <GridStateHiddenInputs
                            state={{
                              offset: String(offset),
                              sort: '',
                              order: '',
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

        {/* Pagination */}
        {(offset > 0 || hasMore) && (
          <div mix={table.pagination}>
            <span mix={css({ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' })}>
              {messages.length > 0 ? (
                <span mix={table.paginationInfo}>
                  Zeige {pageStart}–{pageEnd}
                </span>
              ) : null}
              {currentPage > 0 ? (
                <span mix={pageBadgeStyle} aria-label={`Seite ${currentPage}`}>
                  Seite {currentPage}
                </span>
              ) : null}
            </span>
            <div mix={table.flexGapSm}>
              {offset > 0 ? (
                <a
                  href={pageUrl(prevOffset)}
                  data-rmx-target={getSelfFrameTarget()}
                  mix={table.pageLink}
                >
                  <Glyph name="chevronRight" width={14} height={14} mix={rotatedGlyphCss} /> Zurück
                </a>
              ) : null}
              {hasMore ? (
                <a
                  href={pageUrl(nextOffset)}
                  data-rmx-target={getSelfFrameTarget()}
                  mix={table.pageLink}
                >
                  Weiter <Glyph name="chevronRight" width={14} height={14} />
                </a>
              ) : null}
            </div>
          </div>
        )}
      </div>
    )
  }
}
