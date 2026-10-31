import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'
import { theme } from '../ui/theme/theme.ts'
import { getContext } from 'remix/middleware/async-context'

import { Document } from './document.tsx'
import { FlashBanner } from './flash-banner.tsx'
import { MainNav } from './main-nav.tsx'
import { Breadcrumbs, getBreadcrumbs } from './breadcrumbs.tsx'
import { PageScrollReset } from './page-scroll-reset.browser.tsx'
import { GridStatusAnnouncer } from './grid-status-announcer.browser.tsx'

interface LayoutProps {
  children?: RemixNode
  title?: string | undefined
}

export function Layout(handle: Handle<LayoutProps>) {
  return () => {
    let { title, children } = handle.props

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
          <FlashBanner />
          <main mix={mainStyle}>
            <div mix={pageStyle} data-page-scroller="true">
              {currentPath.startsWith('/admin') ||
              currentPath.startsWith('/ai') ||
              currentPath.startsWith('/lists') ||
              currentPath.startsWith('/verwaltung') ? null : (
                <Breadcrumbs items={getBreadcrumbs(currentPath)} />
              )}
              {children}
            </div>
          </main>
          <footer mix={footerStyle}>
            <p mix={footerTextCss}>&copy; {new Date().getFullYear()} newapp. Built with Remix.</p>
          </footer>
          <PageScrollReset />
          <GridStatusAnnouncer />
        </div>
      </Document>
    )
  }
}

// A definite `0` basis (not the `0%` that `flex: 1` now serializes to since
// remix #12121): the body is auto-height (`min-height: 100vh`), and a
// percentage basis resolves to content there, which un-bounds the page
// scroller. `1 1 0` keeps the shell, main, and page filling the viewport like
// the pre-#12121 `1 1 1px` output did.
const shellCss = css({
  display: 'flex',
  flexDirection: 'column',
  flex: '1 1 0',
  minHeight: 0,
})

const mainStyle = css({
  flex: '1 1 0',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
})

const pageStyle = css({
  flex: '1 1 0',
  overflowY: 'auto',
  // The app's real scroll container (not the document). Reserve the scrollbar
  // gutter so grids whose content height crosses the viewport — common with
  // variable row heights — do not shift sideways when the scrollbar toggles.
  scrollbarGutter: 'stable',
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
