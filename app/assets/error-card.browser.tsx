import type { Handle, RemixNode } from 'remix/ui'
import { createRoot, css, on } from 'remix/ui'
import { animateEntrance, spring } from 'remix/ui/animation'
import { theme } from '../ui/theme/theme.ts'

type ErrorCardProps = {
  eyebrow: string
  title: string
  message: string
  action?: RemixNode
  animated?: boolean
}

function ErrorCard(handle: Handle<ErrorCardProps>) {
  return () => {
    let { eyebrow, title, message, action, animated } = handle.props
    return (
      <div mix={animated ? [cardCss, animateGentlyIn] : cardCss}>
        <p mix={eyebrowCss}>{eyebrow}</p>
        <h1 mix={titleCss}>{title}</h1>
        <p mix={messageCss}>{message}</p>
        {action}
      </div>
    )
  }
}

const pageCss = css({
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  padding: '32px',
  background: theme.surface.lvl0,
  color: theme.colors.text.primary,
})

const cardCss = css({
  width: '100%',
  maxWidth: '560px',
  padding: '40px 36px',
  background: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: '20px',
  boxShadow: '0 20px 45px rgba(15, 23, 42, 0.08)',
})

const animateGentlyIn = animateEntrance({
  opacity: 0,
  transform: 'translateY(-14px) scale(0.97)',
  ...spring('smooth'),
})

const eyebrowCss = css({
  margin: '0 0 12px',
  fontSize: '12px',
  fontWeight: '600',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: theme.colors.text.muted,
})

const titleCss = css({
  margin: '0 0 12px',
  fontSize: '32px',
  lineHeight: '1.1',
  fontWeight: '700',
})

const messageCss = css({
  margin: '0',
  fontSize: '16px',
  lineHeight: '1.6',
  color: theme.colors.text.secondary,
})

const reloadButtonCss = css({
  marginTop: '24px',
  padding: '12px 18px',
  border: 'none',
  borderRadius: '999px',
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  fontSize: '14px',
  fontWeight: '600',
  lineHeight: '1',
  cursor: 'pointer',
  '&:hover': {
    background: theme.colors.action.primary.backgroundHover,
  },
})

const actionLinkCss = css({
  display: 'inline-flex',
  marginTop: '24px',
  padding: '12px 18px',
  borderRadius: '999px',
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  fontSize: '14px',
  fontWeight: '600',
  lineHeight: '1',
  textDecoration: 'none',
  '&:hover': {
    background: theme.colors.action.primary.backgroundHover,
  },
})

export { ErrorCard, actionLinkCss }

export function renderFatalError(message: string) {
  createRoot(document.body).render(
    <div mix={pageCss}>
      <ErrorCard
        eyebrow="Unexpected Error"
        title="Something went wrong"
        message={message}
        animated
        action={
          <button
            mix={[
              reloadButtonCss,
              on('click', () => {
                window.location.reload()
              }),
            ]}
          >
            Reload the page
          </button>
        }
      />
    </div>,
  )
}
