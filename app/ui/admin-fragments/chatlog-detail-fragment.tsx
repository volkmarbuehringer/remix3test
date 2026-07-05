import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../../ui/theme/theme.ts'
import type { ChatMessage } from '../../data/chatlog.ts'
import { decodeHtml } from '../../utils/decode-html-entities.ts'

interface ChatlogDetailFragmentProps {
  conversationId: string
  messages: ChatMessage[]
  error?: string
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
  maxHeight: '400px',
  overflowY: 'auto',
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

export function ChatlogDetailFragment(handle: Handle<ChatlogDetailFragmentProps>) {
  return () => {
    let { conversationId, messages, error } = handle.props
    let displayTitle = `Conversation #${conversationId.substring(0, 8)}…`

    return (
      <div mix={detailStyle}>
        <div mix={headerStyle}>
          <h3 mix={titleStyle}>{displayTitle}</h3>
          <span mix={css({ fontSize: theme.fontSize.xxs, color: theme.colors.text.muted })}>
            {messages.length} message{messages.length !== 1 ? 's' : ''}
          </span>
        </div>

        {error ? (
          <div mix={errorStyle}>{error}</div>
        ) : messages.length === 0 ? (
          <div mix={emptyStyle}>No messages in this conversation.</div>
        ) : (
          <div mix={messageListStyle}>
            {[...messages].reverse().map((msg, idx) => (
              <div
                key={idx}
                mix={[messageItemStyle, msg.role === 'user' ? userMessageStyle : assistantMessageStyle]}
              >
                <div mix={messageLabelStyle}>
                  {msg.role === 'user' ? 'User' : 'Assistant'}
                </div>
                <p mix={messageContentStyle}>{decodeHtml(msg.content)}</p>
                <div mix={messageMetaStyle}>
                  {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : ''}
                  {msg.elapsed ? ` · ${msg.elapsed < 1000 ? `${msg.elapsed}ms` : `${(msg.elapsed / 1000).toFixed(1)}s`}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
}
