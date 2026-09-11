import type { Handle } from 'remix/ui'
import { css, Fragment } from 'remix/ui'
import { theme } from '../../ui/theme/theme.ts'
import type { ChatMessage } from '../../types/chatlog.ts'
import { decodeHtml } from '../../utils/decode-html-entities.ts'
import { routes } from '../../routes.ts'

interface ChatlogDetailFragmentProps {
  conversationId: string
  messages: ChatMessage[]
  error?: string
  /** Where the dismiss control points when JS is unavailable. */
  closeHref?: string
  /** Id of the list row to return focus to when the pane is dismissed. */
  returnId?: string
}

const detailStyle = css({
  background: theme.surface.lvl0,
  borderRadius: theme.radius.lg,
  padding: '1.25rem',
  border: `1px solid ${theme.colors.border.default}`,
  boxShadow: theme.shadow.sm,
})

const headerStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: theme.space.md,
  paddingBottom: theme.space.sm,
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
})

const titleStyle = css({
  fontSize: theme.fontSize.md,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
  margin: 0,
})

const errorStyle = css({
  color: theme.colors.action.danger.background,
  fontSize: theme.fontSize.sm,
  padding: theme.space.md,
  background: theme.surface.lvl1,
  borderRadius: theme.radius.md,
})

const messageListStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
  maxHeight: '60vh',
  overflowY: 'auto',
})

const dayHeaderStyle = css({
  alignSelf: 'stretch',
  textAlign: 'center',
  fontSize: theme.fontSize.xxs,
  color: theme.colors.text.muted,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  margin: '4px 0',
})

const closeLinkStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  alignSelf: 'flex-start',
  marginBottom: theme.space.xs,
  padding: 0,
  border: 'none',
  background: 'none',
  color: theme.colors.text.secondary,
  font: 'inherit',
  fontSize: theme.fontSize.xs,
  textDecoration: 'none',
  cursor: 'pointer',
  '&:hover': {
    color: theme.colors.action.primary.background,
    textDecoration: 'underline',
  },
})

const messageItemStyle = css({
  padding: theme.space.sm,
  borderRadius: theme.radius.md,
})

const userMessageStyle = css({
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  alignSelf: 'flex-end',
})

const assistantMessageStyle = css({
  background: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.subtle}`,
})

const messageLabelStyle = css({
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  marginBottom: '4px',
  opacity: 0.8,
})

const messageContentStyle = css({
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
  margin: 0,
  whiteSpace: 'pre-wrap',
})

const messageMetaStyle = css({
  fontSize: theme.fontSize.xxs,
  marginTop: '4px',
  opacity: 0.6,
})

const emptyStyle = css({
  color: theme.colors.text.muted,
  fontSize: theme.fontSize.sm,
  textAlign: 'center',
  padding: theme.space.xl,
})

/** Derives a human-readable title from the conversation's opening question. */
function conversationTitle(messages: ChatMessage[]): string {
  let firstUser = messages.find((m) => m.role === 'user')
  if (!firstUser) return 'Konversation'
  let text = decodeHtml(firstUser.content).replace(/\s+/g, ' ').trim()
  if (!text) return 'Konversation'
  return text.length > 64 ? text.slice(0, 64) + '…' : text
}

/** `11.09.2026` — used for the per-day separators in the transcript. */
function formatDay(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** `14:32` — the time shown under every message. */
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isSameDay(a: number, b: number): boolean {
  let first = new Date(a)
  let second = new Date(b)
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  )
}

export function ChatlogDetailFragment(handle: Handle<ChatlogDetailFragmentProps>) {
  return () => {
    let { messages, error, closeHref, returnId } = handle.props
    let displayTitle = conversationTitle(messages)
    let hasError = Boolean(error)
    // The pane renders the transcript oldest-first, so a conversation reads the
    // way it happened. Messages arrive in that order already; a day separator is
    // inserted whenever the calendar day changes.
    let showEmpty = !hasError && messages.length === 0

    return (
      <div
        mix={detailStyle}
        data-chatlog-detail="true"
        data-chatlog-missing={hasError || showEmpty ? 'true' : 'false'}
      >
        <a
          href={closeHref ?? routes.admin.chatlog.index.href()}
          data-chatlog-close="true"
          data-chatlog-return={returnId ?? ''}
          mix={closeLinkStyle}
        >
          ← Schließen
        </a>
        <div mix={headerStyle}>
          <h3 mix={titleStyle}>{displayTitle}</h3>
          <span mix={css({ fontSize: theme.fontSize.xxs, color: theme.colors.text.muted })}>
            {messages.length === 1 ? '1 Nachricht' : `${messages.length} Nachrichten`}
          </span>
        </div>

        {hasError ? (
          <div mix={errorStyle}>{error}</div>
        ) : showEmpty ? (
          <div mix={emptyStyle}>Diese Konversation enthält keine Nachrichten.</div>
        ) : (
          <div mix={messageListStyle}>
            {messages.map((msg, idx) => {
              let previous = idx > 0 ? messages[idx - 1] : undefined
              let showDay =
                msg.timestamp > 0 &&
                (previous === undefined || !isSameDay(previous.timestamp, msg.timestamp))
              return (
                <Fragment key={idx}>
                  {showDay ? <div mix={dayHeaderStyle}>{formatDay(msg.timestamp)}</div> : null}
                  <div
                    mix={[
                      messageItemStyle,
                      msg.role === 'user' ? userMessageStyle : assistantMessageStyle,
                    ]}
                  >
                    <div mix={messageLabelStyle}>
                      {msg.role === 'user' ? 'Nutzer' : 'Assistent'}
                    </div>
                    <p mix={messageContentStyle}>{decodeHtml(msg.content)}</p>
                    <div mix={messageMetaStyle}>
                      {msg.timestamp ? formatTime(msg.timestamp) : ''}
                    </div>
                  </div>
                </Fragment>
              )
            })}
          </div>
        )}
      </div>
    )
  }
}
