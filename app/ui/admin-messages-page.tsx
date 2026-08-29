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
  margin: `0 0 ${theme.space.lg}`,
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

/** Message content is the primary data — let it wrap instead of truncating. */
const contentCellStyle = css({
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  overflow: 'hidden',
  color: theme.colors.text.primary,
})

const textareaStyle = css({
  resize: 'vertical',
  minHeight: '80px',
  maxHeight: '240px',
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
    let { messages, offset, hasMore, pageSize, prevOffset, nextOffset } = handle.props
    let pageStart = messages.length > 0 ? offset + 1 : 0
    let pageEnd = offset + messages.length
    let currentPage = pageSize > 0 ? Math.floor(offset / pageSize) + 1 : 0

    return (
      <div mix={table.page}>
        <ConfirmDelete />
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
          action={routes.admin.messages.action.href()}
          data-rmx-target={getSelfFrameTarget()}
          mix={css({ marginBottom: theme.space.lg })}
        >
          <CsrfTokenInput />
          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <Glyph name="send" width={14} height={14} />
              <span mix={table.panelTitle}>Neue Nachricht senden</span>
            </div>
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
              <div mix={table.actions}>
                <button type="submit" mix={[button({ tone: 'primary' }), table.spacer]}>
                  <Glyph name="send" width={14} height={14} /> Nachricht senden
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Messages grid */}
        <div mix={table.wrap} role="log" aria-live="polite" data-messages-table="true">
          {messages.length === 0 ? (
            <div mix={table.empty}>Noch keine Nachrichten. Sende die erste!</div>
          ) : (
            <table mix={table.table}>
              <colgroup>
                <col mix={css({ width: '170px' })} />
                <col />
                <col mix={css({ width: '140px' })} />
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
                    <td mix={[table.td, contentCellStyle]} title={msg.content}>
                      {msg.content}
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
                            state={{ offset: String(offset), sort: '', order: '', filter: '' }}
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
                  href={`${ADMIN_BASE}?offset=${prevOffset}`}
                  data-rmx-target={getSelfFrameTarget()}
                  mix={table.pageLink}
                >
                  <Glyph name="chevronRight" width={14} height={14} mix={rotatedGlyphCss} /> Zurück
                </a>
              ) : null}
              {hasMore ? (
                <a
                  href={`${ADMIN_BASE}?offset=${nextOffset}`}
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
