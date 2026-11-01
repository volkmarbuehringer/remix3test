import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import { PageSection, bodyTextCss, panelCss } from './page-primitives.tsx'
import { theme } from './theme/theme.ts'

/**
 * @name Page primitives
 * @description Abschnitts- und Panel-Primitive, die die Verwaltungsseiten teilen.
 * @order 30
 */
export default function PagePrimitivesDemo(_handle: Handle) {
  return () => (
    <PageSection
      title="Page primitives"
      description="PageSection liefert Titel, Beschreibung und den vertikalen Rhythmus; panelCss und bodyTextCss halten Karten und Fließtext konsistent."
    >
      <div mix={gridCss}>
        <article mix={panelCss}>
          <h2 mix={headingCss}>Panel</h2>
          <p mix={bodyTextCss}>
            Ein Panel ist die Standardfläche für Formulare, Tabellen und Detailansichten. Es nutzt
            dieselben Border-, Radius- und Shadow-Tokens wie die Verwaltung.
          </p>
        </article>

        <article mix={panelCss}>
          <h2 mix={headingCss}>Fließtext</h2>
          <p mix={bodyTextCss}>
            bodyTextCss ist die ruhige Sekundärstimme: kleine Schrift, entspannte Zeilenhöhe und
            gedämpfte Farbe. Überschriften bleiben in der jeweiligen Seite.
          </p>
        </article>
      </div>
    </PageSection>
  )
}

const gridCss = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(18rem, 1fr))',
  gap: theme.space.lg,
})

const headingCss = css({
  margin: 0,
  fontSize: theme.fontSize.md,
  fontWeight: theme.fontWeight.semibold,
  lineHeight: theme.lineHeight.tight,
  color: theme.colors.text.primary,
})
