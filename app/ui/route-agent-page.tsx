import type { Handle } from 'remix/ui'
import { css, Frame } from 'remix/ui'
import { theme } from './theme/theme.ts'
import { routes } from '../routes.ts'
import { RouteAgentStream } from '../assets/route-agent-stream.tsx'

const pageStyle = css({
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  overflow: 'hidden',
})

const frameContainerStyle = css({
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
})

const agentBarStyle = css({
  padding: '0.5rem 1rem',
  fontSize: '0.8125rem',
  color: theme.colors.text.secondary,
  background: theme.surface.lvl0,
  borderTop: `1px solid ${theme.colors.border.default}`,
  maxHeight: '3rem',
  overflowY: 'auto',
  whiteSpace: 'normal',
  wordBreak: 'break-word',
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

export function RouteAgentPage(handle: Handle) {
  return () => (
    <div mix={pageStyle}>
      <div id="route-agent-frame-container" mix={frameContainerStyle}>
        <Frame
          name="lists-content"
          src={routes.routeAgent.panel.href()}
          fallback={<div mix={css({ padding: '2rem', color: theme.colors.text.muted })}>Loading...</div>}
        />
      </div>

      <div id="agent-bar" mix={agentBarStyle}>Ask the agent to navigate...</div>

      <form id="route-agent-form" mix={inputBarStyle}>
        <input
          id="route-agent-input"
          type="text"
          name="message"
          placeholder="Ask the agent to show something... (e.g. 'show me the lists')"
          autoComplete="off"
          mix={inputStyle}
        />
        <button id="route-agent-submit" type="submit" mix={btnStyle}>
          Send
        </button>
      </form>

      <RouteAgentStream />
    </div>
  )
}
