import { css } from 'remix/ui'
import type { CSSMixinDescriptor, MixinDescriptor, ElementProps } from 'remix/ui'
import upstreamButton from 'remix/ui/button'

type ButtonSize = 'md' | 'lg'
type ButtonTone = 'neutral' | 'primary' | 'ghost' | 'secondary' | 'danger'

interface ButtonOptions {
  size?: ButtonSize
  tone?: ButtonTone
}

/**
 * The upstream button factory binds its mixin descriptors to the DOM `Element`
 * base type. The native TypeScript compiler's recursive assignability check is
 * order-sensitive here (the same expression typechecks or fails depending on
 * module ordering), so we bind the tuple to the actual `HTMLButtonElement` host.
 * This is a type-level-only adjustment: the descriptor objects are already
 * accepted at runtime on any host.
 */
type ButtonStyle = MixinDescriptor<HTMLButtonElement, any, ElementProps>

type ButtonMixin =
  | readonly [ButtonStyle, ButtonStyle, ButtonStyle, ButtonStyle]
  | readonly [ButtonStyle, ButtonStyle, ButtonStyle, ButtonStyle, ButtonStyle]

function button(options: ButtonOptions = {}): ButtonMixin {
  let { size = 'md', tone = 'neutral' } = options

  if (tone === 'secondary') {
    return upstreamButton({ size, tone: 'neutral' }) as unknown as ButtonMixin
  }

  if (tone === 'danger') {
    return [...upstreamButton({ size, tone: 'primary' }), dangerStyle] as unknown as ButtonMixin
  }

  return upstreamButton({ size, tone }) as unknown as ButtonMixin
}

/**
 * Binds an `Element`-scoped CSS mixin to the `HTMLButtonElement` host so it can
 * be mixed into a `<button>`'s `mix` array deterministically under the native
 * TypeScript compiler.
 */
export function buttonStyle(style: CSSMixinDescriptor): ButtonStyle {
  return style as unknown as ButtonStyle
}

export default button

const dangerStyle: CSSMixinDescriptor = css({
  background: '#DC2626',
  border: 0,
  '--rmx-button-shadow':
    '0 16px 16px -8px rgba(220, 38, 38, 0.12), 0 8px 8px -4px rgba(220, 38, 38, 0.1), 0 4px 4px -2px rgba(220, 38, 38, 0.08), 0 2px 2px -1px rgba(220, 38, 38, 0.06), inset 0 0 4px 2px #DC2626, inset 0 0 4px 2px rgba(255, 255, 255, 0.1), inset 0 0 12px -6px rgba(255, 255, 255, 0.75)',
  color: '#FFFFFF',
  textShadow: '0 1px 1px rgba(0, 0, 0, 0.3)',
  '&:hover:not(:disabled):not([aria-disabled="true"])': {
    background: '#EF4444',
    '--rmx-button-shadow':
      '0 18px 18px -10px rgba(220, 38, 38, 0.16), 0 8px 8px -4px rgba(220, 38, 38, 0.12), 0 4px 4px -2px rgba(220, 38, 38, 0.1), 0 2px 2px -1px rgba(220, 38, 38, 0.08), inset 0 0 4px 2px #DC2626, inset 0 0 4px 2px rgba(255, 255, 255, 0.13), inset 0 0 12px -6px rgba(255, 255, 255, 0.85)',
  },
  '&:active:not(:disabled):not([aria-disabled="true"]), &[aria-pressed="true"]:not(:disabled):not([aria-disabled="true"])':
    {
      background: '#B91C1C',
      '--rmx-button-shadow':
        '0 2px 2px -1px rgba(220, 38, 38, 0.14), inset 0 0 4px 2px #991B1B, inset 0 1px 2px rgba(0, 0, 0, 0.45), inset 0 0 10px -6px rgba(255, 255, 255, 0.55)',
      textShadow: '0 1px 1px rgba(0, 0, 0, 0.3)',
    },
  '&:active:not(:disabled):not([aria-disabled="true"])': {
    transform: 'translateY(1px)',
  },
})
