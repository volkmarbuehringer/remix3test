import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from './theme/theme.ts'
import { TestAgentStream } from '../assets/streams/public/test-agent-stream.tsx'

interface TestAgentPageProps {
  error?: string
}

const pageStyle = css({
  maxWidth: '800px',
  width: '100%',
  margin: '0 auto',
  padding: '1rem',
})

const headingStyle = css({
  fontSize: '1.5rem',
  fontWeight: 600,
  marginBottom: '0.25rem',
})

const subtitleStyle = css({
  color: theme.colors.text.secondary,
  marginBottom: '1.5rem',
  fontSize: '0.875rem',
})

const messagesStyle = css({
  minHeight: '40vh',
  maxHeight: '60vh',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  marginBottom: '1rem',
  padding: '0.75rem',
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.lg,
  background: theme.surface.lvl0,
})

const formStyle = css({
  background: theme.surface.lvl0,
  borderRadius: theme.radius.lg,
  padding: '1rem',
})

const inputStyle = css({
  width: '100%',
  minHeight: '60px',
  padding: '0.75rem',
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  fontFamily: 'inherit',
  fontSize: '1rem',
  color: theme.colors.text.primary,
  background: theme.surface.lvl1,
  resize: 'vertical',
  outline: 'none',
  boxSizing: 'border-box',
})

const btnStyle = css({
  display: 'inline-block',
  padding: '0.6rem 1.5rem',
  marginTop: '0.75rem',
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  border: 'none',
  borderRadius: theme.radius.md,
  fontSize: '1rem',
  cursor: 'pointer',
  '&:hover': { background: theme.colors.action.primary.backgroundHover },
  '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
})

const errorBoxStyle = css({
  marginTop: '1rem',
  padding: '0.75rem',
  background: theme.colors.action.danger.background,
  color: theme.colors.action.danger.foreground,
  borderRadius: theme.radius.md,
  fontSize: '0.875rem',
})

const timelineStyle = css({
  minHeight: '40vh',
  maxHeight: '60vh',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  marginBottom: '1rem',
  padding: '0.75rem',
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.lg,
  background: theme.surface.lvl0,
})

const tlCardStyle = css({
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  overflow: 'hidden',
})

const tlCardHeaderStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.5rem 0.75rem',
  cursor: 'pointer',
  userSelect: 'none',
  fontSize: '0.875rem',
  fontWeight: 500,
  background: theme.surface.lvl1,
  '&:hover': { opacity: 0.85 },
})

const tlCardBodyStyle = css({
  padding: '0.5rem 0.75rem',
  fontSize: '0.8125rem',
  lineHeight: '1.5',
  fontFamily: 'monospace',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  color: theme.colors.text.secondary,
})

const tlCardResultStyle = css({
  padding: '0.5rem 0.75rem',
  fontSize: '0.8125rem',
  lineHeight: '1.5',
  color: theme.colors.text.primary,
  borderTop: `1px solid ${theme.colors.border.default}`,
})

const tlCardErrorStyle = css({
  padding: '0.5rem 0.75rem',
  fontSize: '0.8125rem',
  color: theme.colors.action.danger.foreground,
  background: theme.colors.action.danger.background,
  borderTop: `1px solid ${theme.colors.border.default}`,
})

const tlCardStatsStyle = css({
  padding: '0.25rem 0.75rem',
  fontSize: '0.75rem',
  color: theme.colors.text.secondary,
  background: theme.surface.lvl1,
  borderTop: `1px solid ${theme.colors.border.default}`,
})

const tlReasoningStyle = css({
  fontSize: '0.8125rem',
  lineHeight: '1.5',
  color: theme.colors.text.secondary,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  padding: '0.5rem 0.75rem',
})

const tlToggleStyle = css({
  marginLeft: 'auto',
  fontSize: '0.75rem',
  transition: 'transform 0.15s',
})

const approvalCardStyle = css({
  marginTop: '1rem',
  padding: '1rem',
  background: theme.surface.lvl1,
  border: '2px solid #f59e0b',
  borderRadius: theme.radius.lg,
})

const approvalTitleStyle = css({
  fontSize: '1rem',
  fontWeight: 600,
  marginBottom: '0.5rem',
  color: theme.colors.text.primary,
})

const approvalInfoStyle = css({
  fontSize: '0.875rem',
  color: theme.colors.text.secondary,
  whiteSpace: 'pre-wrap',
  marginBottom: '0.75rem',
  fontFamily: 'monospace',
})

const approvalBtnRowStyle = css({
  display: 'flex',
  gap: '0.75rem',
})

const approveBtnStyle = css({
  padding: '0.5rem 1.25rem',
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  border: 'none',
  borderRadius: theme.radius.md,
  fontSize: '0.9rem',
  cursor: 'pointer',
})

const hiddenStyle = css({ display: 'none' })

const bubbleBase = css({
  padding: '0.5rem 0.75rem',
  borderRadius: theme.radius.lg,
  maxWidth: '80%',
  lineHeight: '1.5',
  fontSize: '0.9375rem',
})

const userBubble = css({
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  alignSelf: 'flex-end',
  borderBottomRightRadius: '4px',
})

const assistantBubble = css({
  background: theme.surface.lvl1,
  color: theme.colors.text.primary,
  alignSelf: 'flex-start',
  borderBottomLeftRadius: '4px',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
})

const errorBubble = css({
  background: theme.colors.action.danger.background,
  color: theme.colors.action.danger.foreground,
  alignSelf: 'flex-start',
})

const declineBtnStyle = css({
  padding: '0.5rem 1.25rem',
  background: theme.colors.action.danger.background,
  color: theme.colors.action.danger.foreground,
  border: 'none',
  borderRadius: theme.radius.md,
  fontSize: '0.9rem',
  cursor: 'pointer',
})

export function TestAgentPage(handle: Handle<TestAgentPageProps>) {
  return () => {
    let { error } = handle.props

    return (
      <div mix={pageStyle}>
        <h1 mix={headingStyle}>Test Agent</h1>
        <p mix={subtitleStyle}>Streaming SSE prototype. Try "list files" or "read package.json".</p>

        <div id="test-timeline" mix={timelineStyle}></div>

        {error && <div mix={errorBoxStyle}>{error}</div>}

        <div id="test-approval" mix={[approvalCardStyle, hiddenStyle]}>
          <div mix={approvalTitleStyle}>Tool Call Requires Approval</div>
          <div id="test-approval-info" mix={approvalInfoStyle}></div>
          <div mix={approvalBtnRowStyle}>
            <button id="test-approve-btn" type="button" mix={approveBtnStyle}>
              Approve
            </button>
            <button id="test-decline-btn" type="button" mix={declineBtnStyle}>
              Decline
            </button>
          </div>
        </div>

        <div id="test-question" mix={[approvalCardStyle, hiddenStyle]}>
          <div id="test-question-text" mix={approvalTitleStyle}></div>
          <div id="test-question-options" mix={approvalInfoStyle}></div>
          <div mix={approvalBtnRowStyle}>
            <button id="test-answer-btn" type="button" mix={approveBtnStyle}>
              Answer
            </button>
          </div>
        </div>

        <form id="test-form" mix={formStyle}>
          <textarea
            id="test-input"
            name="message"
            mix={inputStyle}
            placeholder="Ask about the project files..."
          />
          <button id="test-submit" type="submit" mix={btnStyle}>
            Send
          </button>
        </form>

        <TestAgentStream />
      </div>
    )
  }
}
