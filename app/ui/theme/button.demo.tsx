import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import button, { buttonLink } from './button.ts'
import { theme } from './theme.ts'

const tones = ['neutral', 'primary', 'secondary', 'danger', 'dangerOutline'] as const
const sizes = ['md', 'lg'] as const

/**
 * @name Button
 * @description Ton- und Größenvarianten inklusive deaktiviertem Zustand und Link-Button.
 * @order 10
 */
export default function ButtonDemo(_handle: Handle) {
  return () => (
    <section mix={rootCss}>
      <header mix={headerCss}>
        <h2 mix={headingCss}>Töne</h2>
        <p mix={copyCss}>
          Jeder Ton stammt aus dem Theme-Vertrag; <code>buttonLink()</code> stylt einen Anker, ohne
          ein <code>button</code> zu verschachteln.
        </p>
      </header>

      <div mix={rowCss}>
        {tones.map((tone) => (
          <button key={tone} type="button" mix={button({ tone })}>
            {tone}
          </button>
        ))}
      </div>

      <header mix={headerCss}>
        <h2 mix={headingCss}>Größen</h2>
      </header>
      <div mix={rowCss}>
        {sizes.map((size) => (
          <button key={size} type="button" mix={button({ size, tone: 'primary' })}>
            {size}
          </button>
        ))}
      </div>

      <header mix={headerCss}>
        <h2 mix={headingCss}>Zustände</h2>
      </header>
      <div mix={rowCss}>
        <button type="button" mix={button({ tone: 'primary' })} disabled>
          Deaktiviert
        </button>
        <button type="button" aria-pressed="true" mix={button({ tone: 'secondary' })}>
          Gedrückt
        </button>
        <a href="/ui" mix={buttonLink({ tone: 'secondary' })}>
          Link-Button
        </a>
      </div>
    </section>
  )
}

const rootCss = css({
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

const copyCss = css({
  margin: 0,
  maxWidth: '52rem',
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
})

const rowCss = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: theme.space.md,
})
