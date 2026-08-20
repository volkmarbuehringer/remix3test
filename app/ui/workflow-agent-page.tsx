import type { Handle } from 'remix/ui'
import { css, Frame } from 'remix/ui'
import { theme } from './theme/theme.ts'
import { routes, frames } from '../routes.ts'
import { WorkflowAgentStream } from '../assets/streams/public/workflow-agent-stream.tsx'

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

const statusBarStyle = css({
  padding: '0.5rem 1rem',
  fontSize: '0.8125rem',
  color: theme.colors.text.secondary,
  background: theme.surface.lvl0,
  borderTop: `1px solid ${theme.colors.border.default}`,
  maxHeight: '14rem',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
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
  resize: 'none',
  minHeight: '3.6rem',
  maxHeight: '10rem',
  overflowY: 'auto',
  lineHeight: '1.4',
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
        data-active-frame={frames.workflowAgentPanel}
        mix={frameContainerStyle}
      >
        <Frame
          name={frames.workflowAgentPanel}
          src={routes.admin.workflowAgent.panel.href()}
          fallback={
            <div mix={css({ padding: '2rem', color: theme.colors.text.muted })}>
              Ask the agent to manage a user account...
            </div>
          }
        />
      </div>

      <div id="wf-status-bar" mix={statusBarStyle}>
        <div
          style={{
            padding: '0.25rem 0',
            fontSize: '0.8125rem',
            color: theme.colors.text.muted,
            fontStyle: 'italic',
          }}
        >
          Ask the agent to manage a user account...
        </div>
      </div>

      <form id="workflow-agent-form" mix={inputBarStyle}>
        <textarea
          id="workflow-agent-input"
          name="message"
          placeholder="e.g. 'cancel user 42' or 'lock user 5'"
          autoComplete="off"
          mix={inputStyle}
          rows={2}
        />
        <button id="workflow-agent-submit" type="submit" mix={btnStyle}>
          Send
        </button>
      </form>

      <WorkflowAgentStream />
    </div>
  )
}
