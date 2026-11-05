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
    <section
      mix={css({
        display: 'grid',
        gap: theme.space.lg,
      })}
    >
      <header
        mix={css({
          display: 'grid',
          gap: theme.space.xs,
        })}
      >
        <h2
          mix={css({
            margin: 0,
            fontSize: theme.fontSize.lg,
            fontWeight: theme.fontWeight.semibold,
            lineHeight: theme.lineHeight.tight,
            color: theme.colors.text.primary,
          })}
        >
          Glyph-Set
        </h2>
        <p
          mix={css({
            margin: 0,
            maxWidth: '52rem',
            fontSize: theme.fontSize.sm,
            lineHeight: theme.lineHeight.relaxed,
            color: theme.colors.text.secondary,
          })}
        >
          Symbole werden über <code>RMX_01_GLYPHS</code> im Dokument-Shell registriert und mit{' '}
          <code>&lt;Glyph name="…" /&gt;</code> referenziert.
        </p>
      </header>

      <ul
        mix={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(9rem, 1fr))',
          gap: theme.space.sm,
          margin: 0,
          padding: 0,
          listStyle: 'none',
        })}
      >
        {glyphNames.map((name) => (
          <li
            key={name}
            mix={css({
              display: 'flex',
              alignItems: 'center',
              gap: theme.space.sm,
              padding: theme.space.sm,
              border: `1px solid ${theme.colors.border.subtle}`,
              borderRadius: theme.radius.md,
              backgroundColor: theme.surface.lvl1,
            })}
          >
            <span
              mix={css({
                display: 'inline-flex',
                color: theme.colors.text.primary,
              })}
            >
              <Glyph name={name} width={24} height={24} />
            </span>
            <code
              mix={css({
                color: theme.colors.text.secondary,
                fontSize: theme.fontSize.xs,
              })}
            >
              {name}
            </code>
          </li>
        ))}
      </ul>
    </section>
  )
}
