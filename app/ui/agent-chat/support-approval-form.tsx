import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import { routes } from '../../routes.ts'
import { theme } from '../theme/theme.ts'
import { tryGetCsrfToken } from '../csrf-token-input.tsx'

export interface SupportApprovalFormProps {
  runId: string
  toolCallId?: string | null | undefined
  threadId?: string | null | undefined
  toolName?: string | null | undefined
}

const formStyle = css({
  padding: '0.75rem',
  border: `2px solid ${theme.colors.action.danger.border}`,
  borderRadius: '12px',
  background: theme.surface.lvl0,
  alignSelf: 'flex-start',
  width: '100%',
})

const titleStyle = css({
  fontWeight: 600,
  fontSize: '0.875rem',
  marginBottom: '0.75rem',
  color: theme.colors.action.danger.background,
})

const actionsStyle = css({ display: 'flex', gap: '0.5rem' })

const approveStyle = css({
  padding: '4px 14px',
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  border: 'none',
  borderRadius: '4px',
  fontSize: '0.8125rem',
  cursor: 'pointer',
})

const declineStyle = css({
  padding: '4px 14px',
  background: theme.surface.lvl1,
  color: theme.colors.text.primary,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: '4px',
  fontSize: '0.8125rem',
  cursor: 'pointer',
})

/**
 * The no-JS approval control for a suspended support-agent tool call.
 *
 * Rendered server-side on the support-agent index when the pending-gate store
 * reports a suspended tool_decision, so the decision can be made with a plain
 * form method="post" (vendor guide 09). The stream client intercepts submit and
 * switches to the SSE transport. The single action route distinguishes the
 * decision by the submitter's name/value. Keep the ids, classes and field names
 * in sync with supportApprovalCard (the streamed card).
 */
export function SupportApprovalForm(handle: Handle<SupportApprovalFormProps>) {
  return () => {
    let { runId, toolCallId, threadId, toolName } = handle.props
    let token = tryGetCsrfToken()

    return (
      <form
        id="support-agent-approval"
        class="support-agent-decision-form"
        method="post"
        action={routes.admin.supportAgent.toolDecision.href()}
        data-run-id={runId}
        mix={formStyle}
      >
        {token ? <input type="hidden" name="_csrf" value={token} /> : null}
        <input type="hidden" name="runId" value={runId} />
        {toolCallId ? <input type="hidden" name="toolCallId" value={toolCallId} /> : null}
        {threadId ? <input type="hidden" name="threadId" value={threadId} /> : null}
        <div mix={titleStyle}>Tool erfordert Bestätigung: {toolName || 'unbekannt'}</div>
        <div mix={actionsStyle}>
          <button
            type="submit"
            name="decision"
            value="approve"
            class="approve-btn"
            mix={approveStyle}
          >
            ✔ Zulassen
          </button>
          <button
            type="submit"
            name="decision"
            value="decline"
            class="decline-btn"
            mix={declineStyle}
          >
            ✖ Ablehnen
          </button>
        </div>
      </form>
    )
  }
}
