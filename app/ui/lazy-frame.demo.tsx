import type { Handle } from 'remix/component'
import { Frame, css } from 'remix/component'

import { routes } from '../routes.ts'
import { theme } from './theme/theme.ts'

/**
 * @name Lazy Frame mit statischem HTML
 * @description Ein geprüfter HTML-Stand als `loading="lazy"`-Frame: Der Server liefert nur den Fallback, der Browser lädt das Fragment beim Scrollen.
 * @order 40
 */
export default function LazyFrameDemo(_handle: Handle) {
  let fragmentHref = routes.ui.html.href({ name: 'static-frame' })

  return () => (
    <section mix={sectionCss}>
      <header mix={headerCss}>
        <h2 mix={headingCss}>Lazy Frame mit statischem HTML</h2>
        <p mix={bodyCss}>
          Der Frame zeigt das geprüfte Fragment <code>app/actions/ui/html/static-frame.html</code>.
          Mit <code>loading="lazy"</code> schickt der Server nur den Fallback; das Fragment wird
          erst geladen, wenn dieser Bereich beim Scrollen in die Nähe des Viewports kommt.
        </p>
      </header>

      <div data-gallery-lazy-viewport="true" mix={scrollerCss}>
        <div mix={scrollCueCss}>
          <span mix={scrollCueArrowCss} aria-hidden="true">
            ↓
          </span>
          <p mix={scrollCueTextCss}>Weiter scrollen — der Frame lädt erst beim Annähern.</p>
        </div>

        <div data-gallery-lazy-frame="true">
          <Frame
            src={fragmentHref}
            loading="lazy"
            fallback={
              <div data-gallery-lazy-fallback="true" mix={fallbackCss}>
                <span mix={fallbackLabelCss}>Statisches HTML-Fragment wird geladen …</span>
                <noscript>Diese Ansicht benötigt JavaScript.</noscript>
              </div>
            }
          />
        </div>
      </div>

      <p mix={footnoteCss}>
        Das Fragment ist kein Komponenten-Render: <code>createFileResponse()</code> streamt die
        Datei, der Frame übernimmt sie als normales DOM.{' '}
        <a href={fragmentHref} data-rmx-document>
          Fragment direkt öffnen
        </a>
      </p>
    </section>
  )
}

const sectionCss = css({
  display: 'grid',
  gap: theme.space.lg,
})

const headerCss = css({
  display: 'grid',
  gap: theme.space.xs,
})

const headingCss = css({
  margin: 0,
  fontSize: theme.fontSize.lg,
  fontWeight: theme.fontWeight.semibold,
  lineHeight: theme.lineHeight.tight,
  color: theme.colors.text.primary,
})

const bodyCss = css({
  margin: 0,
  maxWidth: '52rem',
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
})

const scrollCueCss = css({
  display: 'grid',
  placeItems: 'center',
  alignContent: 'center',
  gap: theme.space.sm,
  minHeight: '36rem',
  padding: theme.space.xl,
  border: `1px dashed ${theme.colors.border.default}`,
  borderRadius: theme.radius.lg,
  background: `linear-gradient(180deg, ${theme.surface.lvl0}, ${theme.surface.lvl1})`,
})

const scrollerCss = css({
  height: '30rem',
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  scrollbarGutter: 'stable',
  padding: theme.space.xl,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.lg,
  background: theme.surface.lvl0,
})

const scrollCueArrowCss = css({
  fontSize: theme.fontSize.xxl,
  lineHeight: 1,
  color: theme.colors.text.muted,
})

const scrollCueTextCss = css({
  margin: 0,
  textAlign: 'center',
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.muted,
})

const fallbackCss = css({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: theme.space.xs,
  minHeight: '16rem',
  padding: theme.space.xl,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.lg,
  background: theme.surface.lvl1,
  color: theme.colors.text.muted,
  fontSize: theme.fontSize.sm,
})

const fallbackLabelCss = css({
  display: 'block',
})

const footnoteCss = css({
  margin: 0,
  fontSize: theme.fontSize.xs,
  lineHeight: theme.lineHeight.normal,
  color: theme.colors.text.muted,
  '& code': {
    color: theme.colors.text.secondary,
  },
  '& a': {
    color: theme.colors.text.link,
  },
})
