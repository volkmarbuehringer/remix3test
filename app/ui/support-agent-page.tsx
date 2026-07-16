import type { Handle } from 'remix/ui'
import { css, Frame } from 'remix/ui'
import { theme } from './theme/theme.ts'
import { routes } from '../routes.ts'
import { SupportAgentStream } from '../assets/support-agent-stream.tsx'

const pageStyle = css({
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  overflow: 'hidden',
})

const frameContainerStyle = css({
  flex: 1,
  minHeight: 0,
  position: 'relative',
})

const frameWrapperStyle = css({
  position: 'absolute',
  inset: 0,
  display: 'none',
})

const frameVisibleStyle = css({
  display: 'block',
})

const agentBarStyle = css({
  padding: '0.5rem 1rem',
  fontSize: '0.8125rem',
  color: theme.colors.text.secondary,
  background: theme.surface.lvl0,
  borderTop: `1px solid ${theme.colors.border.default}`,
  maxHeight: '12rem',
  overflowY: 'auto',
  whiteSpace: 'normal',
  wordBreak: 'break-word',
  display: 'flex',
  flexDirection: 'column',
})

const inputBarStyle = css({
  display: 'flex',
  gap: '0.5rem',
  padding: '0.75rem 1rem',
  background: theme.surface.lvl0,
  borderTop: `1px solid ${theme.colors.border.default}`,
  alignItems: 'center',
})

const inputStyle = css({
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

interface SupportAgentPageProps {
  threadId?: string
}

export function SupportAgentPage(handle: Handle<SupportAgentPageProps>) {
  return () => (
    <div mix={pageStyle}>
      <div
        id="support-agent-frame-container"
        data-active-frame="support-content"
        mix={frameContainerStyle}
      >
        <div id="frame-support-content" mix={[frameWrapperStyle, frameVisibleStyle]}>
          <Frame
            name="support-content"
            src={routes.mastra.chat.index.href(
              handle.props.threadId ? { threadId: handle.props.threadId } : {},
            )}
            fallback={
              <div mix={css({ padding: '2rem', color: theme.colors.text.muted })}>
                Lade Chats...
              </div>
            }
          />
        </div>
        <div id="frame-admin-content" mix={frameWrapperStyle}>
          <Frame
            name="admin-content"
            src={routes.mastra.chat.index.href()}
            fallback={
              <div mix={css({ padding: '2rem', color: theme.colors.text.muted })}>Laden...</div>
            }
          />
        </div>
      </div>

      <div id="agent-bar" mix={agentBarStyle}>
        Ich bin der Support-Agent. Wie kann ich helfen?
      </div>

      <form id="support-agent-form" mix={inputBarStyle}>
        <input
          id="support-agent-input"
          type="text"
          name="message"
          placeholder="Frage zu Benutzern, Terminen und Systemdaten..."
          autoComplete="off"
          mix={inputStyle}
        />
        <button id="support-agent-submit" type="submit" mix={btnStyle}>
          Senden
        </button>
      </form>

      <SupportAgentStream />
    </div>
  )
}
