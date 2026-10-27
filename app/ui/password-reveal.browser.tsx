import { clientEntry, css, on, type Handle } from 'remix/component'

import { theme } from './theme/theme.ts'
import { Glyph } from './theme/glyph/glyph.tsx'

interface PasswordRevealProps {
  /** `name` of the password input to reveal. Matched within the closest form. */
  fieldName: string
}

/**
 * Eye button for a password field, implemented as a client entry rather than
 * the document-wide `PasswordToggle` script.
 *
 * The admin users edit/create panels live inside the content frame, whose
 * swapped-in HTML does not execute inline `<script>` tags (the frame runtime
 * parses fragments with `<template>`). A component-owned button hydrates with
 * the rest of the frame content and binds its handler to the button itself, so
 * it also disappears cleanly when the panel is replaced.
 */
export const PasswordReveal = clientEntry(
  import.meta.url + '#PasswordReveal',
  function PasswordReveal(handle: Handle<PasswordRevealProps>) {
    let visible = false

    return () => (
      <button
        type="button"
        aria-label={visible ? 'Passwort ausblenden' : 'Passwort anzeigen'}
        title={visible ? 'Passwort ausblenden' : 'Passwort anzeigen'}
        mix={[
          revealButtonCss,
          on('click', (event) => {
            let button = event.currentTarget as HTMLElement | null
            let form = button?.closest('form')
            if (!form) return
            let input = form.elements.namedItem(handle.props.fieldName)
            if (!(input instanceof HTMLInputElement)) return

            visible = !visible
            input.type = visible ? 'text' : 'password'
            void handle.update()
          }),
        ]}
      >
        <Glyph name={visible ? 'eyeOff' : 'eye'} width={16} height={16} />
      </button>
    )
  },
)

const revealButtonCss = css({
  position: 'absolute',
  top: '50%',
  right: '0.4rem',
  transform: 'translateY(-50%)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '1.75rem',
  height: '1.75rem',
  padding: 0,
  border: 'none',
  borderRadius: theme.radius.sm,
  background: 'transparent',
  color: theme.colors.text.muted,
  cursor: 'pointer',
  '&:hover': { color: theme.colors.text.primary, background: theme.surface.lvl2 },
  '&:focus-visible': {
    outline: `2px solid ${theme.colors.focus.ring}`,
    outlineOffset: '1px',
  },
})
