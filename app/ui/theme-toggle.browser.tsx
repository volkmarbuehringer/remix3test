import { clientEntry, css, on, type Handle } from 'remix/component'

import { theme } from './theme/theme.ts'
import { Glyph } from './theme/glyph/glyph.tsx'

/**
 * Dark/light switcher, rendered in the document shell (main-nav). The button
 * is component-owned DOM: the click handler is bound via `on('click')` to the
 * actual button, so it is removed when the button is removed — no delegated
 * document listener and no module-scoped guard.
 *
 * The toggle flips `data-theme` on <html> and mirrors the choice into
 * localStorage (the no-flash inline script on next load) and a `theme` cookie
 * (the server reads it for the first paint). `<html>` declares
 * `data-rmx-preserve-attrs="data-theme"` so a frame reconcile keeps the
 * client-owned attribute.
 */

const COOKIE_META = 'path=/; max-age=31536000; SameSite=Lax'

function toggleTheme(): void {
  let html = document.documentElement
  let isDark = html.getAttribute('data-theme') === 'dark'
  if (isDark) {
    html.removeAttribute('data-theme')
    localStorage.setItem('theme', 'light')
    document.cookie = `theme=light; ${COOKIE_META}`
  } else {
    html.setAttribute('data-theme', 'dark')
    localStorage.setItem('theme', 'dark')
    document.cookie = `theme=dark; ${COOKIE_META}`
  }
}

export const ThemeToggle = clientEntry(
  import.meta.url + '#ThemeToggle',
  function ThemeToggle(handle: Handle) {
    return () => (
      <button
        id="theme-toggle"
        aria-label="Design umschalten"
        title="Design umschalten"
        mix={[themeBtnCss, on('click', toggleTheme)]}
        type="button"
      >
        <Glyph name="moon" width={16} height={16} />
      </button>
    )
  },
)

// ── Styles (moved from main-nav.tsx with the button markup) ──

const themeBtnCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: theme.colors.text.secondary,
  minWidth: '2.75rem',
  minHeight: '2.75rem',
  borderRadius: theme.radius.md,
  marginLeft: theme.space.xs,
  transition: 'color 150ms ease, background-color 150ms ease',
  '&:hover': { color: theme.colors.text.primary, background: theme.surface.lvl2 },
})
