import { css } from 'remix/ui'
import type { Handle, RemixNode } from 'remix/ui'
import { theme } from '../lib/theme.ts'

interface PageSectionProps {
  children: RemixNode
  description?: string
  title?: string
}

export function PageSection(handle: Handle<PageSectionProps>) {
  return () => {
    let { children, description, title } = handle.props
    return (
      <section mix={sectionCss}>
        {title || description ? (
          <div mix={sectionHeaderCss}>
            {title ? <h2 mix={sectionTitleCss}>{title}</h2> : null}
            {description ? <p mix={sectionDescriptionCss}>{description}</p> : null}
          </div>
        ) : null}
        {children}
      </section>
    )
  }
}

interface ShowcaseLinkCardProps {
  description: string
  eyebrow: string
  href: string
  title: string
}

export function ShowcaseLinkCard(handle: Handle<ShowcaseLinkCardProps>) {
  return () => {
    let { description, eyebrow, href, title } = handle.props
    return (
      <a href={href} mix={[panelCss, linkCardCss]}>
        <div mix={linkCardHeaderCss}>
          <p mix={eyebrowTextCss}>{eyebrow}</p>
          <h3 mix={panelTitleTextCss}>{title}</h3>
          <p mix={panelDescriptionTextCss}>{description}</p>
        </div>
      </a>
    )
  }
}

// ── Shared CSS primitives ──

export const panelCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.md,
  padding: theme.space.lg,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.lg,
  backgroundColor: theme.surface.lvl0,
  boxShadow: theme.shadow.xs,
})

export const panelInsetCss = css({
  backgroundColor: theme.surface.lvl1,
})

export const pageStackCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xxl,
})

export const exampleGridCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.lg,
})

export const bodyTextCss = css({
  margin: 0,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
})

const eyebrowTextCss = css({
  margin: 0,
  fontSize: theme.fontSize.xxxs,
  fontWeight: theme.fontWeight.semibold,
  letterSpacing: theme.letterSpacing.meta,
  textTransform: 'uppercase',
  color: theme.colors.text.muted,
})

const panelTitleTextCss = css({
  margin: 0,
  fontSize: theme.fontSize.lg,
  lineHeight: theme.lineHeight.tight,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

const panelDescriptionTextCss = css({
  margin: 0,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
})

export const captionTextCss = css({
  margin: 0,
  fontSize: theme.fontSize.xs,
  lineHeight: theme.lineHeight.normal,
  color: theme.colors.text.muted,
})

// ── Private CSS for primitives ──

const sectionCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.lg,
})

const sectionHeaderCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
  maxWidth: '48rem',
})

const sectionTitleCss = css({
  margin: 0,
  fontSize: theme.fontSize.xl,
  lineHeight: theme.lineHeight.tight,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

const sectionDescriptionCss = css({
  margin: 0,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
})

const linkCardCss = css({
  textDecoration: 'none',
  color: theme.colors.text.primary,
  transitionProperty: 'transform, box-shadow, border-color',
  transitionDuration: '120ms',
  transitionTimingFunction: 'ease',
  '&:hover': {
    transform: 'translateY(-1px)',
    boxShadow: theme.shadow.sm,
    borderColor: theme.colors.border.default,
  },
})

const linkCardHeaderCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
})
