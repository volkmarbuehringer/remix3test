import { css, type Handle } from 'remix/component'

import type { AppContext } from '../types/context.ts'

import { routes } from '../routes.ts'
import { theme } from './theme/theme.ts'
import { buttonLink } from './theme/button.ts'
import { Layout } from './layout.tsx'
import { PageSection, bodyTextCss, panelCss } from './page-primitives.tsx'

/** Shared body for the document page and the frame-safe fragment. */
function NotFoundContent(_handle: Handle) {
  return () => (
    <PageSection title="Seite nicht gefunden" description="Diese URL ist nicht Teil der App.">
      <div mix={[panelCss, cardCss]} data-not-found="true">
        <p mix={codeCss} aria-hidden="true">
          404
        </p>
        <p mix={bodyTextCss}>
          Die angeforderte Seite existiert nicht oder wurde verschoben. Prüfen Sie die Adresse oder
          kehren Sie zur Startseite zurück.
        </p>
        <a href={routes.home.href()} mix={[buttonLink({ tone: 'primary' }), homeLinkCss]}>
          Zur Startseite
        </a>
      </div>
    </PageSection>
  )
}

/** Full document for an unmatched browser navigation. */
function NotFoundPage(_handle: Handle) {
  return () => (
    <Layout title="Seite nicht gefunden">
      <NotFoundContent />
    </Layout>
  )
}

/** Fragment-safe rendering when an unmatched URL is loaded inside a frame. */
function NotFoundPanel(_handle: Handle) {
  return () => <NotFoundContent />
}

const cardCss = css({
  alignItems: 'flex-start',
  maxWidth: '44rem',
})

const codeCss = css({
  margin: 0,
  fontSize: theme.fontSize.xxl,
  lineHeight: theme.lineHeight.tight,
  fontWeight: theme.fontWeight.bold,
  color: theme.colors.text.muted,
})

const homeLinkCss = css({
  alignSelf: 'flex-start',
  textDecoration: 'none',
})

/** Render the document or frame-safe fragment from a plain (non-TSX) router module. */
export function renderNotFoundResponse(render: AppContext['render'], frame: boolean): Response {
  return render(frame ? <NotFoundPanel /> : <NotFoundPage />, { status: 404 })
}
