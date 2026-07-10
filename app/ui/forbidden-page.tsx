import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'

export interface ForbiddenPageProps {
  /** Optional message to display below the title. Defaults to a generic message. */
  message?: string
}

/**
 * A reusable 403 Forbidden page component.
 * Uses css() mixins and theme tokens for all styling — no inline styles or className.
 */
export function ForbiddenPage(handle: Handle<ForbiddenPageProps>) {
  return () => {
    let message = handle.props.message ?? "You don't have admin access to this section."
    return (
      <div mix={pageCss}>
        <div mix={cardCss}>
          <h1 mix={titleCss}>403</h1>
          <p mix={messageCss}>{message}</p>
          <a href="/" mix={linkCss}>
            Back to Home
          </a>
        </div>
      </div>
    )
  }
}

const pageCss = css({
  fontFamily: theme.fontFamily.sans,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '100vh',
  margin: 0,
  backgroundColor: theme.surface.lvl0,
  color: theme.colors.text.primary,
})

const cardCss = css({
  textAlign: 'center',
  padding: theme.space.xxl,
  maxWidth: '480px',
})

const titleCss = css({
  fontSize: theme.fontSize.xxl,
  fontWeight: theme.fontWeight.bold,
  margin: 0,
  color: theme.colors.action.danger.background,
})

const messageCss = css({
  fontSize: theme.fontSize.lg,
  color: theme.colors.text.secondary,
  margin: `${theme.space.sm} 0 ${theme.space.lg}`,
})

const linkCss = css({
  color: theme.colors.text.link,
  textDecoration: 'underline',
  fontSize: theme.fontSize.md,
  '&:hover': {
    opacity: 0.8,
  },
})
