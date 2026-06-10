import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../lib/theme.ts'

import { routes, frames } from '../routes.ts'
import { CsrfTokenInput } from './csrf-token-input.tsx'
import { AdminActionButton } from '../assets/admin-action-button.tsx'
import { ConnectionIndicator } from '../assets/connection-indicator.tsx'

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
  prevOffset: number
  nextOffset: number
}

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString('de-DE')
}

// ── Styles ──

const pageStyle = css({
  maxWidth: '800px',
})

const headerStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.space.lg,
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

const messagesListStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
  marginBottom: theme.space.xl,
  maxHeight: '60vh',
  overflowY: 'auto',
  padding: theme.space.md,
  background: theme.surface.lvl1,
  borderRadius: theme.radius.lg,
  border: `1px solid ${theme.colors.border.default}`,
})

const messageItemStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
  padding: theme.space.sm,
  background: theme.surface.lvl0,
  borderRadius: theme.radius.md,
  borderLeft: `3px solid ${theme.colors.action.primary.background}`,
  position: 'relative',
})

const messageHeaderStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
})

const senderNameStyle = css({
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.action.primary.background,
  fontSize: theme.fontSize.sm,
})

const timestampStyle = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
})

const messageContentStyle = css({
  fontSize: theme.fontSize.lg,
  color: theme.colors.text.primary,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
})

const messageActionsStyle = css({
  position: 'absolute',
  top: theme.space.sm,
  right: theme.space.sm,
})

const emptyStateStyle = css({
  textAlign: 'center',
  padding: theme.space.xxl,
  color: theme.colors.text.muted,
})

const formStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.md,
  padding: theme.space.lg,
  background: theme.surface.lvl0,
  borderRadius: theme.radius.lg,
  border: `1px solid ${theme.colors.border.default}`,
})

const textareaStyle = css({
  width: '100%',
  padding: theme.space.md,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  fontSize: theme.fontSize.lg,
  fontFamily: 'inherit',
  resize: 'vertical',
  minHeight: '80px',
  maxHeight: '200px',
  color: theme.colors.text.primary,
  background: theme.surface.lvl1,
  outline: 'none',
  '&:focus': {
    borderColor: theme.colors.action.primary.background,
    boxShadow: `0 0 0 3px ${theme.colors.focus.ring}`,
  },
})

const paginationStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: theme.space.md,
  background: theme.surface.lvl0,
  borderRadius: theme.radius.md,
  border: `1px solid ${theme.colors.border.default}`,
  '@media (max-width: 480px)': {
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.space.sm,
  },
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

export function AdminMessagesPage(handle: Handle<AdminMessagesPageProps>) {
  return () => {
    let { messages, offset, hasMore, prevOffset, nextOffset } = handle.props
    let pageStart = messages.length > 0 ? offset + 1 : 0
    let pageEnd = offset + messages.length

    return (
      <div mix={pageStyle}>
        <div mix={headerStyle}>
          <h2 mix={titleStyle}>Nachrichten</h2>
          <ConnectionIndicator url={routes.admin.messages.subscribe.href()} />
        </div>
        <p mix={descriptionStyle}>
          Öffentliche Nachrichten verwalten. Nur Admins können Nachrichten senden und löschen.
        </p>

        {/* Messages list */}
        <div id="messages-container" role="log" aria-live="polite" mix={messagesListStyle}>
          {messages.length === 0 ? (
            <div mix={emptyStateStyle}>
              Noch keine Nachrichten. Sende die erste!
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} mix={messageItemStyle}>
                <div mix={messageHeaderStyle}>
                  <span mix={senderNameStyle}>{msg.sender_name}</span>
                  <span mix={timestampStyle}>{formatTimestamp(msg.created_at)}</span>
                </div>
                <div mix={messageContentStyle}>{msg.content}</div>
                <div mix={messageActionsStyle}>
                  <form
                    method="POST"
                    action={routes.admin.messages.destroy.href({ id: msg.id })}
                  >
                    <CsrfTokenInput />
                    <AdminActionButton
                      action={routes.admin.messages.destroy.href({ id: msg.id })}
                      method="POST"
                      label="Löschen"
                      pendingLabel="Wird gelöscht…"
                      confirmMsg={`Nachricht von ${msg.sender_name} löschen?`}
                    />
                  </form>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {(offset > 0 || hasMore) && (
          <div mix={paginationStyle}>
            {messages.length > 0 && (
              <span mix={paginationInfoStyle}>
                Zeige {pageStart}–{pageEnd}
              </span>
            )}
            <div mix={css({ display: 'flex', gap: '0.5rem' })}>
              {offset > 0 && (
                <a
                  href={`${routes.admin.messages.index.href()}?offset=${prevOffset}`}
                  rmx-target={frames.adminContent}
                  mix={pageLinkStyle}
                >
                  ← Neuere
                </a>
              )}
              {hasMore && (
                <a
                  href={`${routes.admin.messages.index.href()}?offset=${nextOffset}`}
                  rmx-target={frames.adminContent}
                  mix={pageLinkStyle}
                >
                  Ältere →
                </a>
              )}
            </div>
          </div>
        )}

        {/* Send message form */}
        <form method="POST" action={routes.admin.messages.action.href()} mix={formStyle}>
          <CsrfTokenInput />
          <textarea
            name="content"
            required
            maxLength={1000}
            placeholder="Nachricht schreiben…"
            mix={textareaStyle}
          />
          <button
            type="submit"
            mix={css({
              alignSelf: 'flex-end',
              padding: `${theme.space.sm} ${theme.space.lg}`,
              background: theme.colors.action.primary.background,
              color: theme.colors.action.primary.foreground,
              border: 'none',
              borderRadius: theme.radius.md,
              fontSize: theme.fontSize.md,
              fontWeight: theme.fontWeight.semibold,
              cursor: 'pointer',
              '&:hover': { background: theme.colors.action.primary.backgroundHover },
            })}
          >
            Nachricht senden
          </button>
        </form>
      </div>
    )
  }
}
