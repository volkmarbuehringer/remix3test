import type { Handle } from 'remix/ui'
import { css, Frame } from 'remix/ui'
import { theme } from './theme/theme.ts'
import { routes, frames } from '../routes.ts'
import { SupportAgentStream } from '../assets/streams/public/support-agent-stream.tsx'

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

export function SupportAgentPage(handle: Handle) {
  return () => (
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

      <div id="chat-messages" mix={chatMessagesStyle} />

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
