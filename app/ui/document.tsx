import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'
import { ImportMap } from 'remix/component/server'
import { getContext } from 'remix/middleware/async-context'
import { Cookie } from 'remix/headers/cookie'
import { theme as themeTokens, RMX_01_GLYPHS } from '../ui/theme/theme.ts'

import { routes } from '../routes.ts'
import { DarkTheme, Theme } from '../theme.tsx'
import { getCsrfToken } from 'remix/middleware/csrf'
import { getAssetEntry } from '../middleware/asset-entry.ts'
import { getCspNonce } from '../middleware/security-headers.ts'
import { themeBootstrapScript } from './theme-bootstrap.ts'

interface DocumentProps {
  children?: RemixNode
  /** App-controlled head nodes only; never pass user input or `unsafeHTML()` here. */
  head?: RemixNode
  title?: string | undefined
  description?: string | undefined
  ogImage?: string | undefined
  ogType?: string | undefined
}

const DEFAULT_TITLE = readAppDisplayName('Newapp')

function getThemeFromCookie(): string | null {
  try {
    let cookieHeader = getContext().request.headers.get('Cookie') ?? ''
    return Cookie.from(cookieHeader).get('theme') ?? null
  } catch {
    // getContext() may not be available
  }
  return null
}

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let {
      title = DEFAULT_TITLE,
      description,
      ogImage,
      ogType = 'website',
      children,
      head,
    } = handle.props
    let theme = getThemeFromCookie()
    // Preserve the explicit choice; no attribute means "follow the OS", which
    // <meta name="color-scheme" content="light dark"> already handles.
    let dataTheme = theme === 'dark' || theme === 'light' ? theme : undefined

    return (
      <html
        lang="de"
        data-rmx-preserve-attrs="data-theme"
        data-theme={dataTheme}
        mix={css({ overflowY: 'scroll' })}
      >
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="light dark" />
          <CsrfMetaTag />
          <title>{title}</title>
          {description ? <meta name="description" content={description} /> : null}
          <meta property="og:title" content={title} />
          {description ? <meta property="og:description" content={description} /> : null}
          <meta property="og:type" content={ogType} />
          {ogImage ? <meta property="og:image" content={ogImage} /> : null}
          <meta name="twitter:card" content={ogImage ? 'summary_large_image' : 'summary'} />
          <link
            rel="icon"
            href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%232dacf9'/><text x='16' y='22' text-anchor='middle' font-size='18' font-family='sans' fill='white'>R</text></svg>"
          />
          {/* Self-hosted (see public/fonts) — never load webfonts from a third-party CDN. */}
          <link rel="stylesheet" href="/fonts/fonts.css" />
          <Theme />
          <DarkTheme.Style />
          {head}
          <style>{`
            /* Used by app/ui/connection-indicator.browser.tsx. It lives in the
               shell so the component does not render a <style> inside its <div>
               (invalid content model). */
            @keyframes sse-pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.4; }
            }
            /* The explicit theme must also drive color-scheme: vendor
               light-dark(...) styles (menus, buttons) resolve from the used
               color scheme, not from the data-theme attribute directly. */
            html[data-theme="dark"] { color-scheme: dark; }
            html[data-theme="light"] { color-scheme: light; }
            /* Server-rendered panels (app/ui/mixins/panel-entrance.ts) animate
               from CSS so they do not need a hydration boundary. */
            @keyframes app-panel-enter {
              from { opacity: 0; transform: translateY(4px); }
              to { opacity: 1; transform: none; }
            }
            /* Global reduced-motion guard: component-level CSS transitions
               (hover lifts, nav fades) have no local prefers-reduced-motion
               rule of their own, so kill movement in the shell. */
            @media (prefers-reduced-motion: reduce) {
              body { transition: none !important; }
              *, *::before, *::after {
                transition: none !important;
                animation-duration: 0.01ms !important;
              }
            }
          `}</style>
          <script nonce={getCspNonce()}>{themeBootstrapScript}</script>
          {(() => {
            let entry = getAssetEntry()
            if (!entry) return null
            return (
              <>
                <ImportMap value={entry.importMap} nonce={getCspNonce()} />
                {entry.preloads.map((href) => (
                  <link key={href} rel="modulepreload" href={href} />
                ))}
              </>
            )
          })()}
        </head>
        <body
          mix={css({
            margin: 0,
            fontFamily: themeTokens.fontFamily.sans,
            backgroundColor: themeTokens.surface.lvl0,
            color: themeTokens.colors.text.primary,
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
            transition: 'background-color 150ms ease, color 150ms ease',
          })}
        >
          <RMX_01_GLYPHS />
          {children}
          {(() => {
            let entry = getAssetEntry()
            let src = entry?.href ?? routes.assets.href({ path: 'app/assets/entry.tsx' })
            return <script type="module" src={src} nonce={getCspNonce()} />
          })()}
        </body>
      </html>
    )
  }
}

function CsrfMetaTag() {
  return () => {
    try {
      let token = getCsrfToken(getContext())
      return <meta name="csrf-token" content={token} />
    } catch {
      return null
    }
  }
}

function readAppDisplayName(value: string): string {
  return value.startsWith('%%') ? 'Remix App' : decodeURIComponent(value)
}
