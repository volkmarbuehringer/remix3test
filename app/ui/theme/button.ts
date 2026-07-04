import { css } from 'remix/ui'
import type { CSSMixinDescriptor, MixinDescriptor, ElementProps } from 'remix/ui'
import upstreamButton from 'remix/ui/button'

export type ButtonSize = 'md' | 'lg'
export type ButtonTone = 'neutral' | 'primary' | 'ghost' | 'secondary' | 'danger'

export interface ButtonOptions {
  size?: ButtonSize
  tone?: ButtonTone
}

type ButtonMixin = readonly [...ReturnType<typeof upstreamButton>] | readonly [...ReturnType<typeof upstreamButton>, CSSMixinDescriptor]

export function button(options: ButtonOptions = {}): ButtonMixin {
  let { size = 'md', tone = 'neutral' } = options

  if (tone === 'secondary') {
    return upstreamButton({ size, tone: 'neutral' })
  }

  if (tone === 'danger') {
    return [...upstreamButton({ size, tone: 'primary' }), dangerStyle]
  }

  return upstreamButton({ size, tone })
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
  '&:active:not(:disabled):not([aria-disabled="true"]), &[aria-pressed="true"]:not(:disabled):not([aria-disabled="true"])': {
    background: '#B91C1C',
    '--rmx-button-shadow':
      '0 2px 2px -1px rgba(220, 38, 38, 0.14), inset 0 0 4px 2px #991B1B, inset 0 1px 2px rgba(0, 0, 0, 0.45), inset 0 0 10px -6px rgba(255, 255, 255, 0.55)',
    textShadow: '0 1px 1px rgba(0, 0, 0, 0.3)',
  },
  '&:active:not(:disabled):not([aria-disabled="true"])': {
    transform: 'translateY(1px)',
  },
})
