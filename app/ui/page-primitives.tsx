import { css } from 'remix/ui'
import type { Handle, RemixNode, MixValue, ElementProps } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'

interface PageSectionProps {
  children: RemixNode
  description?: string
  title?: string
  /** Render the title as a screen-reader-only `h1`. Use when an equivalent
   *  visible label already names the page (for example the breadcrumb's
   *  current-page crumb) so the heading is not shown twice. */
  titleHidden?: boolean
  /** Optional extra styles merged with `sectionCss` (e.g. `flex: 1` so a
   *  viewport-bounded page's content can fill the remaining height). */
  mix?: MixValue<HTMLElement, ElementProps>
}

export function PageSection(handle: Handle<PageSectionProps>) {
  return () => {
    let { children, description, title, titleHidden, mix } = handle.props
    return (
      <section mix={[sectionCss, mix].filter(Boolean)}>
        {title || description ? (
          <div mix={sectionHeaderCss}>
            {title ? (
              <h1 mix={titleHidden ? sectionTitleHiddenCss : sectionTitleCss}>{title}</h1>
            ) : null}
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
  // The author `display` above beats the UA `[hidden]{display:none}` rule, so
  // anything toggled via the `hidden` attribute (e.g. inactive settings tabs)
  // needs this nested guard in the same descriptor to actually hide.
  '&[hidden]': { display: 'none' },
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

// Keeps the h1 in the accessibility tree while a visible label elsewhere (the
// breadcrumb's current-page crumb) already names the page, so it is not
// rendered twice on screen.
const sectionTitleHiddenCss = css({
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
})
