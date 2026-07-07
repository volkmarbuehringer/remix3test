import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from './theme/theme.ts'
import { routes } from '../routes.ts'
import { CsrfTokenInput } from './csrf-token-input.tsx'
import type { ChatMessage } from '../types/chatlog.ts'

const MAX_MESSAGE_LENGTH = 5000

interface CustomerChatPageProps {
  messages: ChatMessage[]
  threadId?: string
  error?: string
}

const containerStyle = css({
  maxWidth: '800px',
  margin: '0 auto',
  padding: '1rem',
})

const headingStyle = css({
  fontSize: '1.5rem',
  fontWeight: 600,
  marginBottom: '0.5rem',
})

const subtitleStyle = css({
  color: theme.colors.text.secondary,
  marginBottom: '1.5rem',
})

const chatAreaStyle = css({
  minHeight: '40vh',
  maxHeight: '60vh',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  marginBottom: '1rem',
  padding: '0.75rem',
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.lg,
  background: theme.surface.lvl0,
})

const formStyle = css({
  background: theme.surface.lvl0,
  borderRadius: theme.radius.lg,
  padding: '1rem',
})

const labelStyle = css({
  display: 'block',
  fontSize: '1rem',
  fontWeight: 600,
  marginBottom: '0.5rem',
  color: theme.colors.text.primary,
})

const textareaStyle = css({
  width: '100%',
  minHeight: '50px',
  padding: '0.75rem',
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  fontFamily: 'inherit',
  fontSize: '1rem',
  color: theme.colors.text.primary,
  background: theme.surface.lvl1,
  resize: 'vertical',
  outline: 'none',
  boxSizing: 'border-box',
})

const buttonStyle = css({
  padding: '0.6rem 1.5rem',
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  border: 'none',
  borderRadius: theme.radius.md,
  fontSize: '1rem',
  cursor: 'pointer',
})

const threadIdStyle = css({
  marginTop: '0.75rem',
  fontSize: '0.75rem',
  color: theme.colors.text.muted,
})

const errorBoxStyle = css({
  marginTop: '1rem',
  padding: '0.75rem',
  background: theme.colors.action.danger.background,
  color: theme.colors.action.danger.foreground,
  borderRadius: theme.radius.md,
  fontSize: '0.875rem',
})

export function CustomerChatPage(handle: Handle<CustomerChatPageProps>) {
  return () => {
    let { messages, threadId, error } = handle.props
    return (
      <div mix={containerStyle}>
        <h2 mix={headingStyle}>Beratung</h2>
        <p mix={subtitleStyle}>
          Beschreibe dein Anliegen — ich finde die passende Ressource für dich.
        </p>

        <div id="chat-messages" mix={chatAreaStyle}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                padding: '0.75rem',
                borderRadius: theme.radius.lg,
                maxWidth: '75%',
                background:
                  msg.role === 'user'
                    ? theme.colors.action.primary.background
                    : theme.surface.lvl1,
                color:
                  msg.role === 'user'
                    ? theme.colors.action.primary.foreground
                    : theme.colors.text.primary,
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                borderBottomLeftRadius: msg.role === 'user' ? theme.radius.lg : '4px',
                borderBottomRightRadius: msg.role === 'user' ? '4px' : theme.radius.lg,
              }}
            >
              <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {msg.content}
              </p>
              <div
                style={{
                  fontSize: theme.fontSize.xxs,
                  color: theme.colors.text.muted,
                  marginTop: '0.25rem',
                }}
              >
                {msg.role === 'user' ? 'Du' : 'Berater'}
                {msg.timestamp
                  ? ' · ' +
                    new Date(msg.timestamp).toLocaleTimeString('de-DE', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : ''}
              </div>
            </div>
          ))}
          <div id="chat-end" />
        </div>

        <form
          method="POST"
          action={routes.chat.action.href()}
          autoComplete="off"
          mix={formStyle}
        >
          <CsrfTokenInput />
          {threadId && <input type="hidden" name="threadId" value={threadId} />}
          <label htmlFor="msg" mix={labelStyle}>
            Dein Anliegen
          </label>
          <textarea
            id="msg"
            name="message"
            rows={3}
            required
            maxLength={MAX_MESSAGE_LENGTH}
            mix={textareaStyle}
          />
          <div style={{ marginTop: '0.75rem' }}>
            <button type="submit" mix={buttonStyle}>
              Senden
            </button>
          </div>
        </form>

        {threadId && <p mix={threadIdStyle}>Konversation-ID: {threadId}</p>}

        {error && <div mix={errorBoxStyle}>{error}</div>}
      </div>
    )
  }
}
