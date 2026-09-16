import { css } from 'remix/ui'
import type { CSSMixinDescriptor, MixinDescriptor, ElementProps } from 'remix/ui'
import upstreamButton from 'remix/ui/button'

import { theme } from './theme.ts'

type ButtonSize = 'md' | 'lg'
type ButtonTone = 'neutral' | 'primary' | 'ghost' | 'secondary' | 'danger' | 'dangerOutline'

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
type ButtonStyle = MixinDescriptor<HTMLButtonElement, unknown[], ElementProps>

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

  if (tone === 'dangerOutline') {
    return [
      ...upstreamButton({ size, tone: 'neutral' }),
      dangerOutlineStyle,
    ] as unknown as ButtonMixin
  }

  return upstreamButton({ size, tone }) as unknown as ButtonMixin
}

/**
 * `button()` styling for a link host. `remix/ui/button` applies its default
 * `type="button"` behavior only to native `<button>` hosts; every other host
 * receives styling only. This rebinds the host element type so a navigation link
 * can be styled as a button instead of nesting a `<button>` inside an `<a>`
 * (invalid HTML that also drops the link role for assistive tech).
 */
type AnchorButtonStyle = MixinDescriptor<HTMLAnchorElement, unknown[], ElementProps>

type AnchorButtonMixin =
  | readonly [AnchorButtonStyle, AnchorButtonStyle, AnchorButtonStyle, AnchorButtonStyle]
  | readonly [
      AnchorButtonStyle,
      AnchorButtonStyle,
      AnchorButtonStyle,
      AnchorButtonStyle,
      AnchorButtonStyle,
    ]

export function buttonLink(options: ButtonOptions = {}): AnchorButtonMixin {
  return button(options) as unknown as AnchorButtonMixin
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

/**
 * Outline danger tone: a destructive action that stays visible but does not
 * dominate the page the way the solid red primary shadow does.
 *
 * Colours are theme tokens, not hex: a hardcoded light-mode red leaves the
 * label at ~2.4:1 on the dark surface (#363a3e) — below WCAG AA. The mode-aware
 * danger action token lifts that to ~3.1:1 (dark) / ~4.6:1 (light), and matches
 * the danger-accent treatment already used for row-action icons and menu items.
 */
const dangerOutlineStyle: CSSMixinDescriptor = css({
  background: 'transparent',
  border: `1px solid ${theme.colors.action.danger.background}`,
  color: theme.colors.action.danger.background,
  '--rmx-button-shadow': 'none',
  '&:hover:not(:disabled):not([aria-disabled="true"])': {
    background: theme.colors.action.danger.background,
    borderColor: theme.colors.action.danger.background,
    color: theme.colors.action.danger.foreground,
  },
  '&:active:not(:disabled):not([aria-disabled="true"]), &[aria-pressed="true"]:not(:disabled):not([aria-disabled="true"])':
    {
      background: theme.colors.action.danger.backgroundActive,
      borderColor: theme.colors.action.danger.backgroundActive,
      color: theme.colors.action.danger.foreground,
    },
  '&:disabled, &[aria-disabled="true"]': {
    opacity: 0.5,
  },
})
