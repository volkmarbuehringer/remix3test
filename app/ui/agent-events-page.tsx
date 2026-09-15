import type { Handle } from 'remix/ui'
import { css, Frame } from 'remix/ui'
import { theme } from './theme/theme.ts'
import { routes, frames } from '../routes.ts'
import { MAX_MESSAGE_LENGTH } from '../utils/message-limits.ts'
import { examplePlaceholder } from './agent-events-log.ts'
import { AgentEventsStream } from '../assets/streams/public/agent-events-stream.tsx'

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

const confirmGateStyle = css({
  display: 'none',
  margin: '0 1rem 0.5rem',
  padding: '0.75rem 1rem',
  border: `1px solid ${theme.colors.border.default}`,
  borderLeft: `4px solid ${theme.colors.action.primary.background}`,
  borderRadius: theme.radius.md,
  background: theme.surface.lvl1,
  boxShadow: theme.shadow.sm,
  flexDirection: 'column',
  gap: '0.5rem',
})

const statusBarStyle = css({
  background: theme.surface.lvl0,
  borderTop: `1px solid ${theme.colors.border.default}`,
  display: 'flex',
  flexDirection: 'column',
  maxHeight: '14rem',
})

const statusHeaderStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0.375rem 1rem',
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
  fontSize: '0.6875rem',
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.muted,
  textTransform: 'uppercase',
  letterSpacing: theme.letterSpacing.meta,
})

const statusBodyStyle = css({
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  padding: '0.25rem 1rem 0.5rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.125rem',
})

const clearBtnStyle = css({
  border: 'none',
  background: 'transparent',
  color: theme.colors.text.muted,
  cursor: 'pointer',
  fontSize: '0.6875rem',
  padding: '0.125rem 0.375rem',
  borderRadius: theme.radius.sm,
  '&:hover': { color: theme.colors.text.primary, background: theme.surface.lvl2 },
})

const inputBarStyle = css({
  display: 'flex',
  gap: '0.5rem',
  padding: '0.75rem 1rem',
  background: theme.surface.lvl0,
  borderTop: `1px solid ${theme.colors.border.default}`,
  alignItems: 'flex-end',
})

const composerWrapStyle = css({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  gap: '0.25rem',
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

const metaRowStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: '0.6875rem',
  color: theme.colors.text.muted,
  padding: '0 0.125rem',
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

export function AgentEventsPage(handle: Handle) {
  return () => (
    <div mix={pageStyle}>
      <div
        id="agent-events-frame-container"
        data-active-frame={frames.agentEventsPanel}
        mix={frameContainerStyle}
      >
        <Frame
          name={frames.agentEventsPanel}
          src={routes.admin.agentEvents.panel.href()}
          fallback={
            <div mix={css({ padding: '2rem', color: theme.colors.text.muted })}>
              Loading pipeline…
            </div>
          }
        />
      </div>

      <div id="ae-confirm-gate" mix={confirmGateStyle} />

      <div id="ae-status-bar" mix={statusBarStyle}>
        <div mix={statusHeaderStyle}>
          <span>Activity</span>
          <button id="ae-clear-log" type="button" mix={clearBtnStyle}>
            Clear
          </button>
        </div>
        <div id="ae-status-body" mix={statusBodyStyle} />
      </div>

      <form id="agent-events-form" mix={inputBarStyle}>
        <div mix={composerWrapStyle}>
          <textarea
            id="agent-events-input"
            name="message"
            placeholder={examplePlaceholder()}
            autoComplete="off"
            maxLength={MAX_MESSAGE_LENGTH}
            mix={inputStyle}
            rows={2}
          />
          <div mix={metaRowStyle}>
            <span id="ae-char-count">0 / {MAX_MESSAGE_LENGTH}</span>
            <span>Enter ↵ send · Shift+Enter newline</span>
          </div>
        </div>
        <button id="agent-events-submit" type="submit" mix={btnStyle}>
          Send
        </button>
      </form>

      <AgentEventsStream />
    </div>
  )
}
