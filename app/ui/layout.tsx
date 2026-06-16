import type { Handle, RemixNode } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../lib/theme.ts'
import { getContext } from 'remix/middleware/async-context'

import { Document } from './document.tsx'
import { MainNav } from './main-nav.tsx'
import { Breadcrumbs, getBreadcrumbs } from './breadcrumbs.tsx'

export interface LayoutProps {
  children?: RemixNode
  title?: string
}

export function Layout(handle: Handle<LayoutProps>) {
  return () => {
    let { title, children } = handle.props
    let flashError: string | undefined
    let flashSuccess: string | undefined
    try {
      let session = getContext().session
      if (session) {
        let err = session.get('error')
        if (typeof err === 'string') flashError = err
        let success = session.get('success')
        if (typeof success === 'string') flashSuccess = success
      }
    } catch { /* no session context */ }

    let currentPath = ''
    try {
      currentPath = new URL(getContext().request.url).pathname
    } catch { /* SSR-only — ignored in non-request contexts */ }

    return (
      <Document title={title}>
        <div mix={shellCss}>
          <MainNav />
          {flashError ? <div mix={flashErrorStyle}>{flashError}</div> : null}
          {flashSuccess ? <div mix={flashSuccessStyle}>{flashSuccess}</div> : null}
          <main mix={mainStyle}>
            <div mix={pageStyle}>
              {currentPath.startsWith('/admin') || currentPath.startsWith('/ai') ? null : (
                <Breadcrumbs items={getBreadcrumbs(currentPath)} />
              )}
              {children}
            </div>
          </main>
          <footer mix={footerStyle}>
            <p mix={footerTextCss}>&copy; {new Date().getFullYear()} newapp. Built with Remix.</p>
          </footer>
        </div>
      </Document>
    )
  }
}

const logoutFormStyle = css({
  display: 'flex',
  alignItems: 'center',
  margin: 0,
  padding: 0,
})

const logoutIconStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: theme.colors.text.secondary,
  padding: theme.space.sm,
  borderRadius: theme.radius.md,
  transition: 'color 150ms ease, background-color 150ms ease',
  '&:hover': {
    color: theme.colors.text.primary,
    background: theme.surface.lvl3,
  },
})

const shellCss = css({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
})

const headerStyle = css({
  position: 'sticky',
  top: 0,
  zIndex: 100,
  borderBottom: `1px solid ${theme.colors.border.default}`,
  background: theme.surface.lvl1,
})

const containerStyle = css({
  maxWidth: '1200px',
  margin: '0 auto',
  padding: `0 ${theme.space.lg}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
})

const navStyle = css({
  display: 'flex',
  gap: theme.space.md,
  alignItems: 'center',
})

const navSectionGroupCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.xs,
  '& + &': {
    borderLeft: `1px solid ${theme.colors.border.subtle}`,
    paddingLeft: theme.space.md,
  },
})

const navSectionLabelCss = css({
  fontSize: theme.fontSize.xxs,
  fontWeight: theme.fontWeight.semibold,
  letterSpacing: theme.letterSpacing.meta,
  textTransform: 'uppercase',
  color: theme.colors.text.muted,
  marginRight: theme.space.xs,
})

const mainStyle = css({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
})

const pageStyle = css({
  flex: 1,
  overflowY: 'auto',
  maxWidth: '1200px',
  width: '100%',
  margin: '0 auto',
  padding: `0 ${theme.space.lg}`,
  paddingTop: theme.space.lg,
  paddingBottom: 0,
  boxSizing: 'border-box',
})

const brandGroupCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.md,
})

const logoStyle = css({
  fontSize: theme.fontSize.lg,
  fontWeight: theme.fontWeight.bold,
  color: theme.colors.text.primary,
  textDecoration: 'none',
  padding: `6px 0`,
  display: 'inline-block',
})

const userEmailCss = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
  borderLeft: `1px solid ${theme.colors.border.default}`,
  paddingLeft: theme.space.md,
})

const navLinkStyle = css({
  color: theme.colors.text.secondary,
  textDecoration: 'none',
  fontSize: theme.fontSize.sm,
  padding: `6px ${theme.space.md}`,
  borderRadius: theme.radius.md,
  transition: 'background-color 150ms ease, color 150ms ease',
  '&:hover': {
    background: theme.surface.lvl3,
    color: theme.colors.text.primary,
  },
})

const navActiveStyle = css({
  color: theme.colors.text.primary,
  fontWeight: theme.fontWeight.semibold,
})

const showcaseGroupStyle = css({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
})

const showcaseButtonStyle = css({
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.secondary,
  textDecoration: 'none',
  padding: `6px ${theme.space.md}`,
  borderRadius: theme.radius.md,
  transition: 'background-color 150ms ease, color 150ms ease',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  '&:hover': {
    background: theme.surface.lvl3,
    color: theme.colors.text.primary,
  },
})

const chevronStyle = css({
  fontSize: '0.625rem',
  lineHeight: 1,
})

const showcaseMenuStyle = css({
  position: 'absolute',
  top: '100%',
  left: 0,
  marginTop: theme.space.xs,
  minWidth: '160px',
  background: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.lg,
  boxShadow: theme.shadow.md,
  zIndex: 200,
  padding: theme.space.xs,
  display: 'none',
  gap: '2px',
  '&.is-open': {
    display: 'flex',
    flexDirection: 'column',
  },
})

const dropdownLinkStyle = css({
  display: 'block',
  padding: `${theme.space.sm} ${theme.space.md}`,
  color: theme.colors.text.secondary,
  textDecoration: 'none',
  fontSize: theme.fontSize.sm,
  borderRadius: theme.radius.md,
  whiteSpace: 'nowrap',
  transition: 'background-color 150ms ease, color 150ms ease',
  '&:hover': {
    background: theme.surface.lvl3,
    color: theme.colors.text.primary,
  },
})

const dropdownActiveStyle = css({
  color: theme.colors.text.primary,
  fontWeight: theme.fontWeight.semibold,
  background: theme.surface.lvl2,
})

const themeToggleStyle = css({
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '1.125rem',
  lineHeight: '1',
  padding: theme.space.xs,
  color: theme.colors.text.secondary,
  borderRadius: theme.radius.md,
  transition: 'background-color 150ms ease',
  '&:hover': {
    background: theme.surface.lvl3,
  },
})

const tooltipAnchorStyle = css({
  position: 'relative',
  '&::after': {
    content: 'attr(data-tooltip)',
    position: 'absolute',
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginTop: theme.space.xs,
    padding: `${theme.space.xs} ${theme.space.sm}`,
    background: theme.surface.lvl4,
    color: theme.colors.text.primary,
    fontSize: theme.fontSize.xxs,
    borderRadius: theme.radius.sm,
    whiteSpace: 'nowrap',
    opacity: 0,
    visibility: 'hidden',
    transition: 'opacity 0.15s ease, visibility 0.15s ease',
    transitionDelay: '0.3s',
    pointerEvents: 'none',
    zIndex: 10,
  },
  '&:hover::after': {
    opacity: 1,
    visibility: 'visible',
    transitionDelay: '0s',
  },
  '&:focus-visible::after': {
    opacity: 1,
    visibility: 'visible',
    transitionDelay: '0s',
  },
})

const footerStyle = css({
  borderTop: `1px solid ${theme.colors.border.default}`,
  padding: `2px 0`,
  flexShrink: 0,
  textAlign: 'center',
})

const footerTextCss = css({
  margin: 0,
  fontSize: theme.fontSize.xxs,
  color: theme.colors.text.muted,
})

const flashBase = {
  padding: `${theme.space.sm} ${theme.space.lg}`,
  fontSize: theme.fontSize.sm,
  textAlign: 'center' as const,
}

const surface = theme.surface as Record<string, string>

const flashErrorStyle = css({
  ...flashBase,
  background: surface.dangerBg,
  color: surface.dangerText,
  borderBottom: `1px solid ${surface.dangerBorder}`,
})

const flashSuccessStyle = css({
  ...flashBase,
  background: surface.successBg,
  color: surface.successText,
  borderBottom: `1px solid ${surface.successBorder}`,
})
