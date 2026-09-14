import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'
import { Glyph } from '../ui/theme/glyph/glyph.tsx'

const listStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  listStyle: 'none',
  padding: 0,
  margin: 0,
  marginBottom: theme.space.md,
})

const itemStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  flex: 1,
  minWidth: 0,
})

const connectorStyle = css({
  flex: 1,
  height: '1px',
  minWidth: '8px',
  background: theme.colors.border.default,
})

const badgeBase = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: '24px',
  height: '24px',
  borderRadius: theme.radius.full,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  border: '1px solid transparent',
})

const badgeActive = css({
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  borderColor: theme.colors.action.primary.border,
})

const badgeDone = css({
  background: theme.colors.success.background,
  color: theme.colors.success.foreground,
  borderColor: theme.colors.success.border,
})

const badgeTodo = css({
  background: theme.surface.lvl2,
  color: theme.colors.text.muted,
  borderColor: theme.colors.border.default,
})

const textStyle = css({
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
})

const labelBase = css({
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
})

const labelActive = css({
  color: theme.colors.text.primary,
})

const labelDone = css({
  color: theme.colors.text.primary,
})

const labelTodo = css({
  color: theme.colors.text.muted,
})

const metaStyle = css({
  fontSize: theme.fontSize.xxs,
  color: theme.colors.text.muted,
  whiteSpace: 'nowrap',
})

const linkStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.space.sm,
  minWidth: 0,
  padding: '2px 4px',
  margin: '0 -4px',
  borderRadius: theme.radius.md,
  textDecoration: 'none',
  color: 'inherit',
  '&:hover': { background: theme.surface.lvl2 },
})

const changeStyle = css({
  fontSize: theme.fontSize.xxs,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.link,
  whiteSpace: 'nowrap',
})

const staticStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.space.sm,
  minWidth: 0,
})

interface WizardStepsProps {
  current: 1 | 2
  backHref?: string | undefined
}

export function WizardSteps(handle: Handle<WizardStepsProps>) {
  return () => {
    let { current, backHref } = handle.props
    let steps = [
      { number: 1, label: 'Ressource', meta: 'Schritt 1 von 2' },
      { number: 2, label: 'Zeit & Titel', meta: 'Schritt 2 von 2' },
    ] as const

    return (
      <nav aria-label="Buchungsfortschritt">
        <ol mix={listStyle}>
          {steps.map((step, index) => {
            let isDone = step.number < current
            let isActive = step.number === current
            let badge = isDone ? badgeDone : isActive ? badgeActive : badgeTodo
            let label = isDone ? labelDone : isActive ? labelActive : labelTodo
            let canGoBack = isDone && backHref != null
            let inner = (
              <>
                <span mix={[badgeBase, badge]} aria-hidden="true">
                  {isDone ? <Glyph name="check" width={12} height={12} /> : step.number}
                </span>
                <span mix={textStyle}>
                  <span mix={[labelBase, label]}>{step.label}</span>
                  {canGoBack ? (
                    <span mix={changeStyle}>Ändern</span>
                  ) : (
                    <span mix={metaStyle}>{step.meta}</span>
                  )}
                </span>
              </>
            )
            return (
              <li mix={itemStyle} aria-current={isActive ? 'step' : undefined}>
                {isDone && backHref != null ? (
                  <a
                    href={backHref}
                    mix={linkStyle}
                    title="Zur Ressourcenauswahl"
                    aria-label={`${step.meta}: ${step.label} ändern`}
                  >
                    {inner}
                  </a>
                ) : (
                  <span mix={staticStyle}>{inner}</span>
                )}
                {index < steps.length - 1 ? <span mix={connectorStyle} aria-hidden="true" /> : null}
              </li>
            )
          })}
        </ol>
      </nav>
    )
  }
}
