import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from './theme/theme.ts'
import type { ChatMessage } from '../types/chatlog.ts'

interface MastraChatPageProps {
  messages: ChatMessage[]
  threadId?: string
  error?: string
}

const pageStyle = css({ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 })

const conversationStyle = css({
  flex: 1,
  minHeight: '50vh',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.md,
})

const messageBubbleStyle = css({
  padding: theme.space.md,
  borderRadius: theme.radius.lg,
  maxWidth: '75%',
})

const userBubbleStyle = css({
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  alignSelf: 'flex-end',
  borderBottomRightRadius: '4px',
})

const assistantBubbleStyle = css({
  background: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.subtle}`,
  alignSelf: 'flex-start',
  borderBottomLeftRadius: '4px',
})

const messageContentStyle = css({
  whiteSpace: 'pre-wrap',
  lineHeight: '1.5',
  fontSize: theme.fontSize.md,
  margin: 0,
})

const messageMetaStyle = css({
  fontSize: theme.fontSize.xxs,
  color: theme.colors.text.muted,
  marginTop: theme.space.xs,
})

const errorBoxStyle = css({
  marginTop: theme.space.xl,
  padding: theme.space.md,
  background: theme.colors.action.danger.background,
  color: theme.colors.action.danger.foreground,
  borderRadius: theme.radius.md,
  fontSize: theme.fontSize.sm,
})

const threadIdStyle = css({
  marginTop: theme.space.md,
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.muted,
})

export function MastraChatPage(handle: Handle<MastraChatPageProps>) {
  return () => {
    let { messages, threadId, error } = handle.props
    return (
      <div mix={pageStyle}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem', flexShrink: 0 }}>
          Support-Agent
        </h2>
        <p style={{ color: theme.colors.text.secondary, marginBottom: '1.5rem', flexShrink: 0 }}>
          Frage zu Benutzern, Terminen und Systemdaten.
        </p>

        <div id="chat-messages" mix={conversationStyle}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              mix={[
                messageBubbleStyle,
                msg.role === 'user' ? userBubbleStyle : assistantBubbleStyle,
              ]}
            >
              <p mix={messageContentStyle}>{msg.content}</p>
              <div mix={messageMetaStyle}>
                {msg.role === 'user' ? 'Du' : 'Assistent'}
                {msg.timestamp
                  ? ` · ${new Date(msg.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
                  : ''}
              </div>
            </div>
          ))}
          <div id="chat-end" />
        </div>

        {threadId && <p mix={threadIdStyle}>Konversation-ID: {threadId}</p>}

        {error && <div mix={errorBoxStyle}>{error}</div>}
      </div>
    )
  }
}
