import type { Handle } from 'remix/component'

import { routes } from '../../routes.ts'
import { theme } from '../theme/theme.ts'
import { tryGetCsrfToken } from '../csrf-token-input.tsx'
import { describeToolApproval } from './approval-copy.ts'

export interface ChatApprovalFormProps {
  runId: string
  toolCallId?: string | null | undefined
  threadId?: string | null | undefined
  args?: Record<string, unknown> | null | undefined
  /** Overrides the copy derived from `args` (used by the live stream). */
  title?: string | undefined
  description?: string | undefined
}

const formStyle = {
  padding: '1rem',
  border: `2px solid ${theme.colors.action.danger.border}`,
  borderRadius: '12px',
  background: theme.surface.lvl0,
  alignSelf: 'flex-start',
  width: '100%',
} as const

const titleStyle = {
  fontWeight: 600,
  fontSize: '1rem',
  marginBottom: '0.75rem',
  color: theme.colors.action.danger.background,
} as const

const descriptionStyle = {
  fontSize: '0.875rem',
  color: theme.colors.text.secondary,
  marginBottom: '0.75rem',
  whiteSpace: 'pre-wrap',
} as const

const actionsStyle = { display: 'flex', gap: '0.75rem' } as const

const approveStyle = {
  padding: '0.5rem 1.25rem',
  background: theme.colors.action.danger.background,
  color: theme.colors.action.danger.foreground,
  border: 'none',
  borderRadius: '6px',
  fontSize: '0.9rem',
  cursor: 'pointer',
} as const

const declineStyle = {
  padding: '0.5rem 1.25rem',
  background: theme.surface.lvl1,
  color: 'inherit',
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: '6px',
  fontSize: '0.9rem',
  cursor: 'pointer',
} as const

/**
 * The no-JS approval control for a suspended customer tool call.
 *
 * Rendered server-side on GET /chat when the pending-gate store reports a
 * suspended `tool_decision`, so the decision can be made with a plain
 * `<form method="post">` (vendor guide 09). The stream client intercepts submit
 * and switches to the SSE transport; each button carries a `formaction` so the
 * one form can approve or decline.
 */
export function ChatApprovalForm(handle: Handle<ChatApprovalFormProps>) {
  return () => {
    let { runId, toolCallId, threadId, args } = handle.props
    let copy = describeToolApproval(args)
    let title = handle.props.title ?? copy.title
    let description = handle.props.description ?? copy.description
    let token = tryGetCsrfToken()

    return (
      <form
        id="chat-approval"
        class="chat-decision-form"
        method="post"
        action={routes.chat.approve.href()}
        data-run-id={runId}
        style={formStyle}
      >
        {token ? <input type="hidden" name="_csrf" value={token} /> : null}
        <input type="hidden" name="runId" value={runId} />
        {toolCallId ? <input type="hidden" name="toolCallId" value={toolCallId} /> : null}
        {threadId ? <input type="hidden" name="threadId" value={threadId} /> : null}
        <div style={titleStyle}>{title}</div>
        {description ? <div style={descriptionStyle}>{description}</div> : null}
        <div style={actionsStyle}>
          <button
            type="submit"
            name="decision"
            value="approve"
            class="approve-btn"
            formaction={routes.chat.approve.href()}
            style={approveStyle}
          >
            [X] Bestätigen
          </button>
          <button
            type="submit"
            name="decision"
            value="decline"
            class="decline-btn"
            formaction={routes.chat.decline.href()}
            style={declineStyle}
          >
            [/] Ablehnen
          </button>
        </div>
      </form>
    )
  }
}
