import type { Handle } from 'remix/ui'
import { css, Frame } from 'remix/ui'
import { theme } from './theme/theme.ts'
import { routes, frames } from '../routes.ts'
import { MAX_MESSAGE_LENGTH } from '../utils/message-limits.ts'
import { examplePlaceholder } from './agent-events-log.ts'
import { AgentEventsStream } from '../assets/streams/public/agent-events-stream.tsx'
import { AgentChatShell, ChatComposer } from './agent-chat/shell.tsx'

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

export function AgentEventsPage(handle: Handle) {
  return () => (
    <AgentChatShell
      variant="fullHeight"
      composer={
        <ChatComposer
          variant="inline"
          formId="agent-events-form"
          textareaId="agent-events-input"
          textarea={{
            name: 'message',
            rows: 2,
            placeholder: examplePlaceholder(),
            autoComplete: 'off',
            maxLength: MAX_MESSAGE_LENGTH,
          }}
          submitId="agent-events-submit"
          submitLabel="Send"
          align="flex-end"
          wrapTextarea
          counter={{ id: 'ae-char-count', initial: `0 / ${MAX_MESSAGE_LENGTH}` }}
          meta="Enter ↵ send · Shift+Enter newline"
        />
      }
      stream={<AgentEventsStream />}
    >
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
    </AgentChatShell>
  )
}
