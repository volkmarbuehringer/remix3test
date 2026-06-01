import { css } from 'remix/ui'
import { Glyph } from 'remix/ui/glyph'
import { theme } from 'remix/ui/theme'
import { getContext } from 'remix/middleware/async-context'
import { getCsrfToken } from 'remix/middleware/csrf'
import { getCurrentUserSafely } from '../utils/context.ts'
import { routes, authRoutes } from '../routes.ts'
import { NAV_SECTIONS } from './nav.ts'

const indigo = {
  500: '#6366f1',
  600: '#4f46e5',
  700: '#4338ca',
}

export function MainNav() {
  return () => {
    let user = getCurrentUserSafely()

    let currentPath = ''
    try {
      currentPath = new URL(getContext().request.url).pathname
    } catch { /* SSR-only */ }

    let csrfToken: string | undefined
    try {
      csrfToken = getCsrfToken(getContext())
    } catch { /* CSRF may not be active */ }

    let isActive = (path: string) => {
      if (!currentPath) return false
      return currentPath === path || currentPath.startsWith(path + '/')
    }

    return (
      <header mix={navWrapCss}>
        <div mix={navInnerCss}>
          <a href={routes.home.href()} mix={logoGroupCss}>
            <svg width="24" height="24" viewBox="0 0 28 28" fill="none" mix={logoSvgCss}>
              <defs>
                <linearGradient id="logo-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color={indigo[500]} />
                  <stop offset="100%" stop-color={indigo[700]} />
                </linearGradient>
              </defs>
              <rect width="28" height="28" rx="8" fill="url(#logo-grad)" />
              <path d="M8 20V8h5.2c2.133 0 3.733.4 4.8 1.2 1.067.8 1.6 2 1.6 3.6 0 1.067-.267 1.933-.8 2.6-.533.667-1.333 1.133-2.4 1.4L19 20h-3.2l-2.6-3.2H11V20H8zm3-5.6h2c1.067 0 1.833-.2 2.3-.6.467-.4.7-1 .7-1.8 0-.8-.233-1.367-.7-1.7-.467-.333-1.233-.5-2.3-.5H11v4.6z" fill="white" />
            </svg>
            <span mix={logoNameCss}>
              new<span mix={logoAccentCss}>app</span>
            </span>
            {user ? <span mix={userBadgeCss}>{user.email}</span> : null}
          </a>

          <nav mix={navLinksCss}>
            {NAV_SECTIONS.map((section, i) => {
              let items = section.items.filter(it => !it.adminOnly || user?.role === 'admin')
              if (items.length === 0) return null
              return (
                <div key={i} mix={sectionGroupCss}>
                  {section.label ? <span mix={sectionLabelCss}>{section.label}</span> : null}
                  {items.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      mix={[navLinkCss, item.href && isActive(item.href) ? navActiveCss : null].filter(Boolean)}
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              )
            })}
            {user ? (
              <form method="POST" action={authRoutes.authLogout.href()} mix={logoutFormCss}>
                {csrfToken ? <input type="hidden" name="_csrf" value={csrfToken} /> : null}
                <button type="submit" mix={logoutBtnCss} aria-label="Logout">
                  <Glyph name="close" width={18} height={18} />
                </button>
              </form>
            ) : (
              <>
                <a href={authRoutes.authLogin.index.href()} mix={navBtnCss}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                  Anmelden
                </a>
              </>
            )}
            <button
              id="theme-toggle"
              aria-label="Design umschalten"
              mix={themeBtnCss}
              type="button"
            >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
            </button>
          </nav>
        </div>
      </header>
    )
  }
}

// ── CSS ──

const navWrapCss = css({
  position: 'sticky',
  top: 0,
  zIndex: 100,
  backdropFilter: 'blur(12px)',
  background: `${theme.surface.lvl0}cc`,
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
})

const navInnerCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  maxWidth: '1100px',
  margin: '0 auto',
  padding: '0.5rem 2rem',
})

const logoGroupCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: '0.625rem',
  textDecoration: 'none',
})

const logoSvgCss = css({
  flexShrink: 0,
})

const logoNameCss = css({
  fontSize: '1rem',
  fontWeight: 700,
  color: theme.colors.text.primary,
  letterSpacing: theme.letterSpacing.tight,
})

const logoAccentCss = css({
  color: indigo[500],
})

const userBadgeCss = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
  borderLeft: `1px solid ${theme.colors.border.default}`,
  paddingLeft: theme.space.md,
})

const navLinksCss = css({
  display: 'flex',
  gap: '0.25rem',
  alignItems: 'center',
})

const sectionGroupCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.xs,
  '& + &': {
    borderLeft: `1px solid ${theme.colors.border.subtle}`,
    paddingLeft: theme.space.md,
  },
})

const sectionLabelCss = css({
  fontSize: theme.fontSize.xxs,
  fontWeight: theme.fontWeight.semibold,
  letterSpacing: theme.letterSpacing.meta,
  textTransform: 'uppercase',
  color: theme.colors.text.muted,
  marginRight: theme.space.xs,
})

const navLinkCss = css({
  color: theme.colors.text.secondary,
  textDecoration: 'none',
  fontSize: '0.8125rem',
  fontWeight: 500,
  padding: '0.375rem 0.75rem',
  borderRadius: theme.radius.md,
  transition: 'all 150ms ease',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  '&:hover': { color: theme.colors.text.primary, background: theme.surface.lvl2 },
})

const navActiveCss = css({
  color: theme.colors.text.primary,
  fontWeight: theme.fontWeight.semibold,
})

const logoutFormCss = css({
  display: 'flex',
  alignItems: 'center',
  margin: 0,
  padding: 0,
})

const logoutBtnCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: theme.colors.text.secondary,
  padding: '0.375rem',
  borderRadius: theme.radius.md,
  transition: 'color 150ms ease, background-color 150ms ease',
  '&:hover': { color: theme.colors.text.primary, background: theme.surface.lvl3 },
})

const navBtnCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.375rem',
  color: 'white',
  textDecoration: 'none',
  fontSize: '0.8125rem',
  fontWeight: 600,
  padding: '0.375rem 1rem',
  borderRadius: theme.radius.md,
  background: indigo[600],
  marginLeft: theme.space.sm,
  transition: 'all 200ms ease',
  '&:hover': { background: indigo[700], transform: 'translateY(-1px)' },
})

const themeBtnCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: theme.colors.text.secondary,
  padding: '0.25rem',
  borderRadius: theme.radius.md,
  marginLeft: theme.space.xs,
  transition: 'all 150ms ease',
  '&:hover': { color: theme.colors.text.primary, background: theme.surface.lvl2 },
})
