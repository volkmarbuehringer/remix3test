import type { Handle } from 'remix/component'

import { routes } from '../../routes.ts'
import { theme } from '../theme/theme.ts'
import { tryGetCsrfToken } from '../csrf-token-input.tsx'

export interface SupportQuestionFormProps {
  runId: string
  toolCallId?: string | null | undefined
  threadId?: string | null | undefined
  question: string
  options?: { label: string; description?: string }[] | null | undefined
  selectionMode: string
}

const formStyle = {
  padding: '0.75rem',
  border: `2px solid ${theme.colors.warning.border}`,
  borderRadius: '12px',
  background: theme.surface.lvl0,
  alignSelf: 'flex-start',
  width: '100%',
  marginTop: '0.5rem',
} as const

const titleStyle = {
  fontWeight: 600,
  fontSize: '0.875rem',
  marginBottom: '0.75rem',
  color: theme.colors.warning.foreground,
} as const

const optionStyle = { display: 'block', margin: '4px 0', cursor: 'pointer' } as const
const optionDescriptionStyle = { opacity: 0.6, fontSize: '0.85em' } as const

const freeTextStyle = {
  width: '100%',
  padding: '6px 10px',
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: '4px',
  fontSize: '0.8125rem',
  boxSizing: 'border-box',
  background: theme.surface.lvl0,
  color: theme.colors.text.primary,
} as const

const actionsStyle = { marginTop: '0.75rem' } as const

const answerStyle = {
  padding: '4px 14px',
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  border: 'none',
  borderRadius: '4px',
  fontSize: '0.8125rem',
  cursor: 'pointer',
} as const

/**
 * The no-JS answer control for a suspended support-agent ask_user question.
 *
 * Rendered server-side on the support-agent index when the pending-gate store
 * reports a suspended question, so the answer can be submitted with a plain
 * form method="post" (vendor guide 09). The stream client intercepts submit and
 * switches to the SSE transport. A multi_select posts the answer field
 * repeatedly, which the answer action normalizes into a JSON array. Keep the
 * ids, classes and field names in sync with supportQuestionCard (the streamed
 * card).
 */
export function SupportQuestionForm(handle: Handle<SupportQuestionFormProps>) {
  return () => {
    let { runId, toolCallId, threadId, question, options, selectionMode } = handle.props
    let token = tryGetCsrfToken()
    let multi = selectionMode === 'multi_select'

    return (
      <form
        id="support-agent-question"
        class="support-agent-question-form"
        method="post"
        action={routes.admin.supportAgent.answer.href()}
        data-run-id={runId}
        style={formStyle}
      >
        {token ? <input type="hidden" name="_csrf" value={token} /> : null}
        <input type="hidden" name="runId" value={runId} />
        {toolCallId ? <input type="hidden" name="toolCallId" value={toolCallId} /> : null}
        {threadId ? <input type="hidden" name="threadId" value={threadId} /> : null}
        <input type="hidden" name="selectionMode" value={selectionMode} />
        <div style={titleStyle}>{question}</div>
        {options && options.length > 0 ? (
          <div id="q-options">
            {options.map((option, index) => (
              <label style={optionStyle}>
                <input
                  type={multi ? 'checkbox' : 'radio'}
                  class="q-option"
                  name="answer"
                  value={option.label}
                  checked={!multi && index === 0}
                />{' '}
                {option.label}
                {option.description ? (
                  <span style={optionDescriptionStyle}> — {option.description}</span>
                ) : null}
              </label>
            ))}
          </div>
        ) : (
          <input
            id="q-free-text"
            name="answer"
            type="text"
            placeholder="Antwort eingeben..."
            style={freeTextStyle}
          />
        )}
        <div style={actionsStyle}>
          <button type="submit" class="q-answer-btn" style={answerStyle}>
            Antworten
          </button>
        </div>
      </form>
    )
  }
}
