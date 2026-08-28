import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from './theme/theme.ts'
import { routes } from '../routes.ts'
import { CustomerChatStream } from '../assets/streams/public/customer-chat-stream.tsx'

const MAX_MESSAGE_LENGTH = 5000

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

export function CustomerChatPage(handle: Handle) {
  return () => (
    <div mix={containerStyle}>
      <h2 mix={headingStyle}>Beratung</h2>
      <p mix={subtitleStyle}>
        Beschreibe dein Anliegen — ich finde die passende Ressource für dich.
      </p>

      <div id="chat-messages" mix={chatAreaStyle}>
        <div id="chat-end" />
      </div>

      <form
        id="chat-form"
        method="POST"
        action={routes.chat.action.href()}
        autoComplete="off"
        mix={formStyle}
      >
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
          <button id="chat-submit" type="submit" mix={buttonStyle}>
            Senden
          </button>
        </div>
      </form>

      <CustomerChatStream />
    </div>
  )
}
