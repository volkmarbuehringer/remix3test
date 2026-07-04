import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../../ui/theme/theme.ts'

interface StepResult {
  name: string
  status: string
  duration: string
}

interface AgentResult {
  prompt: string
  response: string
  executionTime: string
  steps: StepResult[]
}

interface AgentResultFragmentProps {
  result: AgentResult
}

const resultStyle = css({
  background: theme.surface.lvl0,
  borderRadius: theme.radius.lg,
  padding: '1.5rem',
  border: `1px solid ${theme.colors.border.default}`,
  boxShadow: theme.shadow.sm,
})

const titleStyle = css({
  fontSize: '1.125rem',
  fontWeight: 600,
  margin: '0 0 1rem',
  color: theme.colors.text.primary,
})

const metaStyle = css({
  display: 'flex',
  gap: theme.space.md,
  marginBottom: theme.space.md,
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
})

const promptStyle = css({
  background: theme.surface.lvl1,
  borderRadius: theme.radius.md,
  padding: theme.space.md,
  marginBottom: theme.space.md,
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.secondary,
  border: `1px solid ${theme.colors.border.subtle}`,
})

const responseStyle = css({
  fontSize: theme.fontSize.md,
  color: theme.colors.text.primary,
  lineHeight: theme.lineHeight.relaxed,
  marginBottom: theme.space.lg,
})

const stepsHeaderStyle = css({
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.muted,
  marginBottom: theme.space.sm,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
})

const stepsListStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
})

const stepRowStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  padding: `${theme.space.xs} ${theme.space.sm}`,
  background: theme.surface.lvl1,
  borderRadius: theme.radius.md,
  fontSize: theme.fontSize.sm,
})

const stepNameStyle = css({
  color: theme.colors.text.primary,
  flex: 1,
})

const stepStatusStyle = css({
  color: theme.colors.action.primary.background,
  fontSize: theme.fontSize.xs,
})

const stepDurationStyle = css({
  color: theme.colors.text.muted,
  fontSize: theme.fontSize.xs,
  fontVariantNumeric: 'tabular-nums',
})

export function AgentResultFragment(handle: Handle<AgentResultFragmentProps>) {
  return () => {
    let { result } = handle.props
    return (
    <div mix={resultStyle}>
      <h3 mix={titleStyle}>Agent Result</h3>

      <div mix={metaStyle}>
        <span>⏱ {result.executionTime}</span>
      </div>

      <div mix={promptStyle}>
        <strong>Prompt: </strong>
        {result.prompt}
      </div>

      <div mix={responseStyle}>{result.response}</div>

      <div mix={stepsHeaderStyle}>Execution Steps</div>
      <div mix={stepsListStyle}>
        {result.steps.map((step, i) => (
          <div key={i} mix={stepRowStyle}>
            <span mix={stepNameStyle}>{step.name}</span>
            <span mix={stepStatusStyle}>✓</span>
            <span mix={stepDurationStyle}>{step.duration}</span>
          </div>
        ))}
      </div>
    </div>
  )
  }
}
