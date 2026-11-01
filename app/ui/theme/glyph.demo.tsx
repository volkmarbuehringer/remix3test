import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import { glyphNames } from './glyph-contract.ts'
import { Glyph } from './glyph/glyph.tsx'
import { theme } from './theme.ts'

/**
 * @name Glyphs
 * @description Das vollständige Glyph-Set aus dem Theme-Preset, inklusive Namen.
 * @order 20
 */
export default function GlyphDemo(_handle: Handle) {
  return () => (
    <section mix={rootCss}>
      <header mix={headerCss}>
        <h2 mix={headingCss}>Glyph-Set</h2>
        <p mix={copyCss}>
          Symbole werden über <code>RMX_01_GLYPHS</code> im Dokument-Shell registriert und mit{' '}
          <code>&lt;Glyph name="…" /&gt;</code> referenziert.
        </p>
      </header>

      <ul mix={gridCss}>
        {glyphNames.map((name) => (
          <li key={name} mix={itemCss}>
            <span mix={iconCss}>
              <Glyph name={name} width={24} height={24} />
            </span>
            <code mix={nameCss}>{name}</code>
          </li>
        ))}
      </ul>
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

const gridCss = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(9rem, 1fr))',
  gap: theme.space.sm,
  margin: 0,
  padding: 0,
  listStyle: 'none',
})

const itemCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  padding: theme.space.sm,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.md,
  backgroundColor: theme.surface.lvl1,
})

const iconCss = css({
  display: 'inline-flex',
  color: theme.colors.text.primary,
})

const nameCss = css({
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.xs,
})
