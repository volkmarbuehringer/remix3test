import type { Handle } from 'remix/component'
import { clientEntry, css, on } from 'remix/component'

import button from './button.ts'
import { theme } from './theme.ts'

export const Counter = clientEntry(import.meta.url + '#Counter', function Counter(handle: Handle) {
  let count = 0

  return () => (
    <button
      type="button"
      mix={[
        button({ tone: 'primary' }),
        on('click', () => {
          count += 1
          void handle.update()
        }),
      ]}
    >
      Geklickt: {count}
    </button>
  )
})

/**
 * @name Counter
 * @description Interaktive clientEntry-Demo: der Klick-Zähler beweist die Hydration.
 * @order 15
 */
export default function CounterDemo(_handle: Handle) {
  return () => (
    <section mix={rootCss}>
      <header mix={headerCss}>
        <h2 mix={headingCss}>Client-Entry</h2>
        <p mix={copyCss}>
          Der Zähler lebt in einem <code>clientEntry</code> innerhalb der Demo. Nach der Hydration
          aktualisiert ein Klick nur diesen Teilbaum; der Server-Render bleibt der Ausgangszustand.
        </p>
      </header>
      <Counter />
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
