import type { Handle } from 'remix/ui'
import { css, Frame } from 'remix/ui'
import { theme } from './theme/theme.ts'
import { routes } from '../routes.ts'
import { WorkflowAgentStream } from '../assets/streams/workflow-agent-stream.browser.tsx'

const pageStyle = css({
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  overflow: 'hidden',
})

const frameContainerStyle = css({
  flex: 1,
  minHeight: 0,
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

export function WorkflowAgentPage(handle: Handle) {
  return () => (
    <div mix={pageStyle}>
      <div
        id="workflow-agent-frame-container"
        data-active-frame="admin-content"
        mix={frameContainerStyle}
      >
        <Frame
          name="admin-content"
          src={routes.workflowAgent.panel.href()}
          fallback={
            <div mix={css({ padding: '2rem', color: theme.colors.text.muted })}>
              Ask the agent to manage a user account...
            </div>
          }
        />
      </div>

      <div id="agent-bar" mix={agentBarStyle}>
        Ask the agent to manage a user account...
      </div>

      <form id="workflow-agent-form" mix={inputBarStyle}>
        <input
          id="workflow-agent-input"
          type="text"
          name="message"
          placeholder="e.g. 'cancel user 42' or 'lock user 5'"
          autoComplete="off"
          mix={inputStyle}
        />
        <button id="workflow-agent-submit" type="submit" mix={btnStyle}>
          Send
        </button>
      </form>

      <WorkflowAgentStream />
    </div>
  )
}
