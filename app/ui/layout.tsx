import type { Handle, RemixNode } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'
import { getContext } from 'remix/middleware/async-context'

import { Document } from './document.tsx'
import { MainNav } from './main-nav.tsx'
import { Breadcrumbs, getBreadcrumbs } from './breadcrumbs.tsx'

interface LayoutProps {
  children?: RemixNode
  title?: string
}

export function Layout(handle: Handle<LayoutProps>) {
  return () => {
    let { title, children } = handle.props
    // Flash is surfaced by exactly one layout per response: this full-document
    // `Layout` on full-page navigations, or the admin sidebar shell
    // (`createSidebarLayout`'s `LayoutComponent`) on frame-fragment navigations.
    // The two never render the same flash in one response, so do not "dedupe".
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
    } catch {
      /* no session context */
    }

    let currentPath = ''
    try {
      currentPath = new URL(getContext().request.url).pathname
    } catch {
      /* SSR-only — ignored in non-request contexts */
    }

    return (
      <Document title={title}>
        <div mix={shellCss}>
          <MainNav />
          {flashError ? <div mix={flashErrorStyle}>{flashError}</div> : null}
          {flashSuccess ? <div mix={flashSuccessStyle}>{flashSuccess}</div> : null}
          <main mix={mainStyle}>
            <div mix={pageStyle}>
              {currentPath.startsWith('/admin') ||
              currentPath.startsWith('/ai') ||
              currentPath.startsWith('/lists') ? null : (
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

const shellCss = css({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
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
