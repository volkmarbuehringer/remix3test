import type { Handle, RemixNode } from 'remix/ui'
import { css } from 'remix/ui'
import button from '../ui/theme/button.ts'
import { theme } from '../ui/theme/theme.ts'

import { CsrfTokenInput } from './csrf-token-input.tsx'
import { PasswordToggle } from '../ui/password-toggle.browser.tsx'

export type AuthFormErrors = {
  form?: string
  [field: string]: string | undefined
}

// ── AuthShell ──

type AuthShellProps = {
  children?: RemixNode
  description: string
  eyebrow: string
  header?: RemixNode
  title: string
}

export function AuthShell(handle: Handle<AuthShellProps>) {
  return () => {
    let { children, description, eyebrow, header, title } = handle.props

    return (
      <section mix={pageContainer}>
        <div mix={cardContainer}>
          {header}
          <p mix={eyebrowText}>{eyebrow}</p>
          <h1 mix={titleText}>{title}</h1>
          <p mix={bodyText}>{description}</p>
          {children}
        </div>
      </section>
    )
  }
}

// ── AuthForm ──

type AuthFormProps = {
  action: string
  children: RemixNode
  error?: string
  footer?: RemixNode
  submitLabel: string
}

export function AuthForm(handle: Handle<AuthFormProps>) {
  return () => {
    let { action, children, error, footer, submitLabel } = handle.props

    return (
      <form action={action} method="POST" mix={formContainer}>
        <CsrfTokenInput />
        <PasswordToggle />
        {error ? (
          <p role="alert" mix={errorBanner}>
            {error}
          </p>
        ) : null}
        {children}
        <button type="submit" mix={[button({ tone: 'primary' }), submitButton]}>
          {submitLabel}
        </button>
        {footer ? <div mix={footerContainer}>{footer}</div> : null}
      </form>
    )
  }
}

// ── Styles ──

const pageContainer = css({
  display: 'grid',
  minHeight: 'calc(100vh - 80px)',
  placeItems: 'center',
  padding: theme.space.xl,
})

const cardContainer = css({
  width: 'min(100%, 420px)',
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.xl,
  backgroundColor: theme.surface.lvl0,
  boxShadow: theme.shadow.lg,
  padding: theme.space.xl,
})

const eyebrowText = css({
  color: theme.colors.text.muted,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  letterSpacing: theme.letterSpacing.wide,
  margin: '0 0 0.5rem',
  textTransform: 'uppercase',
})

const titleText = css({
  color: theme.colors.text.primary,
  fontSize: theme.fontSize.xxl,
  letterSpacing: theme.letterSpacing.tight,
  lineHeight: theme.lineHeight.tight,
  margin: 0,
})

const bodyText = css({
  color: theme.colors.text.secondary,
  lineHeight: theme.lineHeight.relaxed,
  margin: `${theme.space.sm} 0 ${theme.space.lg}`,
})

const formContainer = css({
  display: 'grid',
  gap: theme.space.md,
})

const errorBanner = css({
  backgroundColor: theme.colors.action.danger.background,
  border: `1px solid ${theme.colors.action.danger.border}`,
  borderRadius: theme.radius.md,
  color: theme.colors.action.danger.foreground,
  margin: 0,
  padding: theme.space.md,
})

const submitButton = css({
  width: '100%',
  minHeight: theme.control.height.lg,
})

const footerContainer = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.md,
})

export const fieldLabelCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.medium,
})

export const fieldErrorCss = css({
  color: theme.colors.action.danger.background,
  fontSize: theme.fontSize.xs,
})

export const inputWrapperCss = css({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
})

export const inputHasToggleCss = css({
  paddingRight: '2.25rem',
})

export const toggleButtonCss = css({
  position: 'absolute',
  right: '0.25rem',
  top: '50%',
  transform: 'translateY(-50%)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '2rem',
  height: '2rem',
  padding: 0,
  border: 'none',
  borderRadius: theme.radius.sm,
  background: 'transparent',
  color: theme.colors.text.muted,
  cursor: 'pointer',
  '&:hover': {
    color: theme.colors.text.primary,
    background: theme.surface.lvl1,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.colors.action.primary.background}`,
    outlineOffset: -2,
  },
})
