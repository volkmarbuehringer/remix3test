import { css } from 'remix/ui'
import { Glyph } from '../ui/theme/glyph.ts'
import { theme } from '../ui/theme/theme.ts'
import { getContext } from 'remix/middleware/async-context'
import { getCsrfToken } from 'remix/middleware/csrf'
import { getCurrentUserSafely } from '../utils/context.ts'
import { routes } from '../routes.ts'
import { MOBILE_ITEMS, NAV_SECTIONS } from './nav.ts'
import { NavToggle } from '../assets/nav-toggle.tsx'

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

    // `path + '/'` in startsWith prevents collision between /appointment
    // and /appointments/new — the trailing slash ensures exact segment matching
    let isActive = (path: string) => {
      if (!currentPath) return false
      return currentPath === path || currentPath.startsWith(path + '/')
    }

    // Determine if a link navigates to a different top-level section.
    // Cross-section navigations from Frame-relay pages need rmx-document
    // to avoid Remix 3 entering a frame-resolution loop.
    let isCrossSection = (href: string) => {
      if (!currentPath || !href || href === '/') return false
      let linkSection = href.split('/')[1] || ''
      let currentSection = currentPath.split('/')[1] || ''
      return linkSection !== currentSection
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
          </a>

          <nav mix={[navLinksCss, desktopOnlyCss]}>
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
                      {...(item.href && isCrossSection(item.href) ? { 'rmx-document': '' } : {})}
                      mix={[navLinkCss, item.href && isActive(item.href) ? navActiveCss : null].filter(Boolean)}
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              )
            })}
            {user ? (
              <>
                <a href={routes.settings.index.href()} {...(isCrossSection(routes.settings.index.href()) ? { 'rmx-document': '' } : {})} mix={iconLinkCss} aria-label="Settings" title="Einstellungen">
                  <Glyph name="cog" width={18} height={18} />
                </a>
                <form method="POST" action={routes.auth.logout.href()} mix={logoutFormCss}>
                  {csrfToken ? <input type="hidden" name="_csrf" value={csrfToken} /> : null}
                  <button type="submit" mix={logoutBtnCss} aria-label="Logout" title="Abmelden">
                    <Glyph name="close" width={18} height={18} />
                  </button>
                </form>
              </>
            ) : (
              <>
                <a href={routes.auth.login.index.href()} {...(isCrossSection(routes.auth.login.index.href()) ? { 'rmx-document': '' } : {})} mix={navBtnCss}>
                  <Glyph name="open" width={14} height={14} />
                  Anmelden
                </a>
              </>
            )}
          </nav>

          <div mix={[headerActionsCss, mobileOnlyCss]}>
            <button
              id="nav-toggle"
              aria-label="Menü"
              aria-expanded="false"
              aria-controls="nav-drawer"
              mix={hamburgerBtnCss}
              type="button"
            >
              <Glyph name="menu" width={20} height={20} />
            </button>
          </div>

          <button
            id="theme-toggle"
            aria-label="Design umschalten"
            title="Design umschalten"
            mix={themeBtnCss}
            type="button"
          >
          <Glyph name="moon" width={16} height={16} />
          </button>
        </div>

        <NavToggle />
        <div id="nav-drawer" role="dialog" aria-modal="true" aria-label="Navigation" mix={navDrawerCss}>
          <div mix={drawerHeaderCss}>
            <a href={routes.home.href()} mix={drawerLogoGroupCss}>
              <span mix={drawerLogoTextCss}>
                new<span mix={logoAccentCss}>app</span>
              </span>
            </a>
            <button id="nav-close" mix={drawerCloseCss} type="button" aria-label="Menü schließen">
              <Glyph name="close" width={20} height={20} />
            </button>
          </div>
          <div mix={drawerBodyCss}>
            {user ? (
              <>
                {MOBILE_ITEMS.filter(it => it.requireAuth).map((item) => (
                  item.cta ? (
                    <a key={item.href} href={item.href} {...(isCrossSection(item.href) ? { 'rmx-document': '' } : {})} mix={drawerCtaCss}>
                      {item.label}
                    </a>
                  ) : (
                    <a key={item.href} href={item.href} {...(isCrossSection(item.href) ? { 'rmx-document': '' } : {})} mix={drawerLinkCss}>
                      {item.label}
                    </a>
                  )
                ))}
                <form method="POST" action={routes.auth.logout.href()} mix={drawerLogoutFormCss}>
                  {csrfToken ? <input type="hidden" name="_csrf" value={csrfToken} /> : null}
                  <button type="submit" mix={drawerLogoutBtnCss}>
                    Abmelden
                  </button>
                </form>
              </>
            ) : (
              <a href={routes.auth.login.index.href()} {...(isCrossSection(routes.auth.login.index.href()) ? { 'rmx-document': '' } : {})} mix={drawerCtaCss}>
                Anmelden
              </a>
            )}
          </div>
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

const iconLinkCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: theme.colors.text.secondary,
  padding: '0.375rem',
  borderRadius: theme.radius.md,
  transition: 'color 150ms ease, background-color 150ms ease',
  '&:hover': { color: theme.colors.text.primary, background: theme.surface.lvl3 },
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

const desktopOnlyCss = css({
  '@media (max-width: 768px)': {
    display: 'none',
  },
})

const mobileOnlyCss = css({
  display: 'none',
  '@media (max-width: 768px)': {
    display: 'flex',
  },
})

const headerActionsCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
})

const hamburgerBtnCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: theme.colors.text.secondary,
  padding: '0.375rem',
  borderRadius: theme.radius.md,
  '&:hover': { color: theme.colors.text.primary, background: theme.surface.lvl2 },
})

const navDrawerCss = css({
  display: 'none',
  position: 'fixed',
  inset: 0,
  zIndex: 200,
  flexDirection: 'column',
  background: theme.surface.lvl0,
  '&.is-open': {
    display: 'flex',
  },
  '@media (min-width: 769px)': {
    display: 'none !important',
  },
})

const drawerHeaderCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0.5rem 2rem',
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
})

const drawerLogoGroupCss = css({
  display: 'flex',
  alignItems: 'center',
  textDecoration: 'none',
})

const drawerLogoTextCss = css({
  fontSize: '1rem',
  fontWeight: 700,
  color: theme.colors.text.primary,
  letterSpacing: theme.letterSpacing.tight,
})

const drawerCloseCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: theme.colors.text.secondary,
  padding: '0.375rem',
  borderRadius: theme.radius.md,
  '&:hover': { color: theme.colors.text.primary, background: theme.surface.lvl2 },
})

const drawerBodyCss = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
  gap: '1rem',
  padding: '2rem',
})

const drawerCtaCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.375rem',
  color: 'white',
  textDecoration: 'none',
  fontSize: '1.125rem',
  fontWeight: 600,
  padding: '0.75rem 2rem',
  borderRadius: theme.radius.md,
  background: indigo[600],
  transition: 'background 200ms ease',
  '&:hover': { background: indigo[700] },
})

const drawerLinkCss = css({
  color: theme.colors.text.secondary,
  textDecoration: 'none',
  fontSize: '1rem',
  fontWeight: 500,
  padding: '0.5rem 1rem',
  borderRadius: theme.radius.md,
  '&:hover': { color: theme.colors.text.primary, background: theme.surface.lvl2 },
})

const drawerLogoutFormCss = css({
  display: 'flex',
  alignItems: 'center',
  margin: 0,
  padding: 0,
  width: '100%',
  justifyContent: 'center',
})

const drawerLogoutBtnCss = css({
  color: theme.colors.text.secondary,
  textDecoration: 'none',
  fontSize: '1rem',
  fontWeight: 500,
  padding: '0.5rem 1rem',
  borderRadius: theme.radius.md,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  '&:hover': { color: theme.colors.text.primary, background: theme.surface.lvl2 },
})
