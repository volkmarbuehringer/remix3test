import type { Handle } from 'remix/ui'
import { css, Frame } from 'remix/ui'
import { theme } from './theme/theme.ts'
import { routes, frames } from '../routes.ts'
import { SupportAgentStream } from '../assets/streams/public/support-agent-stream.tsx'
import type { ChatMessage } from '../types/chatlog.ts'

const pageStyle = css({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
})

const frameContainerStyle = css({
  flex: 1,
  minHeight: 0,
})

const chatMessagesStyle = css({
  padding: '0.5rem 1rem',
  fontSize: '0.8125rem',
  color: theme.colors.text.secondary,
  background: theme.surface.lvl0,
  borderTop: `1px solid ${theme.colors.border.default}`,
  minHeight: '4.5rem',
  maxHeight: '40vh',
  overflowY: 'auto',
  whiteSpace: 'normal',
  wordBreak: 'break-word',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
})

const inputBarStyle = css({
  display: 'flex',
  gap: '0.5rem',
  padding: '0.75rem 1rem',
  background: theme.surface.lvl0,
  borderTop: `1px solid ${theme.colors.border.default}`,
  alignItems: 'center',
})

const textareaStyle = css({
  flex: 1,
  padding: '0.6rem 0.75rem',
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  fontFamily: 'inherit',
  fontSize: '0.9375rem',
  color: theme.colors.text.primary,
  background: theme.surface.lvl1,
  outline: 'none',
  boxSizing: 'border-box',
  resize: 'none',
  lineHeight: '1.4',
  minHeight: '3.6rem',
  maxHeight: '10rem',
  overflowY: 'auto',
})

const btnStyle = css({
  padding: '0.6rem 1.25rem',
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  border: 'none',
  borderRadius: theme.radius.md,
  fontSize: '0.9375rem',
  cursor: 'pointer',
  flexShrink: 0,
  '&:hover': { background: theme.colors.action.primary.backgroundHover },
  '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
})

const hintStyle = css({
  padding: '0.375rem 1rem',
  fontSize: '0.75rem',
  color: theme.colors.text.muted,
  background: theme.surface.lvl0,
  borderTop: `1px solid ${theme.colors.border.subtle}`,
  lineHeight: '1.4',
})

interface SupportAgentPageProps {
  /** Thread whose transcript is open, when resumed from the chatlog. */
  threadId?: string | undefined
  /** Server-rendered transcript of the resumed thread. */
  messages?: ChatMessage[]
}

/** Bubbles for the server-rendered transcript, matching the streamed ones. */
function bubbleCss(role: 'user' | 'assistant'): Record<string, string | number | undefined> {
  let isUser = role === 'user'
  return {
    padding: '0.5rem 0.75rem',
    borderRadius: '8px',
    maxWidth: '75%',
    lineHeight: '1.4',
    fontSize: '0.875rem',
    background: isUser ? theme.colors.action.primary.background : theme.surface.lvl1,
    color: isUser ? theme.colors.action.primary.foreground : theme.colors.text.primary,
    alignSelf: isUser ? 'flex-end' : 'flex-start',
    border: isUser ? undefined : `1px solid ${theme.colors.border.subtle}`,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }
}

export function SupportAgentPage(handle: Handle<SupportAgentPageProps>) {
  return () => {
    let { threadId, messages = [] } = handle.props
    return (
      <div mix={pageStyle}>
        <div
          id="support-agent-frame-container"
          data-active-frame={frames.supportAgentPanel}
          mix={frameContainerStyle}
        >
          <Frame
            name={frames.supportAgentPanel}
            src={routes.admin.supportAgent.panel.href()}
            fallback={
              <div mix={css({ padding: '2rem', color: theme.colors.text.muted })}>
                Frage zu Benutzern, Terminen und Systemdaten...
              </div>
            }
          />
        </div>

        <div
          id="chat-messages"
          {...(threadId ? { 'data-thread-id': threadId } : {})}
          mix={chatMessagesStyle}
        >
          {messages.map((message, index) => (
            <div key={index} style={bubbleCss(message.role)}>
              {message.content}
            </div>
          ))}
        </div>

        <div mix={hintStyle}>
          Beantwortet Fragen zu Benutzern, Terminen, Ressourcen, Angeboten, Wetter und Statistiken —
          nur Lesen, keine Kontoänderungen.
        </div>

        <form id="support-agent-form" mix={inputBarStyle}>
          <textarea
            id="support-agent-input"
            name="message"
            rows={3}
            placeholder="Frage zu Benutzern, Terminen und Systemdaten..."
            mix={textareaStyle}
          />
          <button id="support-agent-submit" type="submit" mix={btnStyle}>
            Senden
          </button>
        </form>

        <SupportAgentStream />
      </div>
    )
  }
}
