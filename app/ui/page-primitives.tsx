import { css } from 'remix/ui'
import type { Handle, RemixNode } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'

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
            {title ? <h1 mix={sectionTitleCss}>{title}</h1> : null}
            {description ? <p mix={sectionDescriptionCss}>{description}</p> : null}
          </div>
        ) : null}
        {children}
      </section>
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

export const bodyTextCss = css({
  margin: 0,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
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
