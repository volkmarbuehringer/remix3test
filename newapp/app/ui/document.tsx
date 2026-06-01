import type { Handle, RemixNode } from 'remix/ui'
import { css } from 'remix/ui'
import { getContext } from 'remix/middleware/async-context'
import { createCookie } from 'remix/cookie'
import { Cookie } from 'remix/headers/cookie'
import { theme as themeTokens } from 'remix/ui/theme'

import { routes } from '../routes.ts'
import { DarkTheme, Theme } from '../theme.tsx'
import { RMX_01_GLYPHS } from 'remix/ui/theme'
import { getCsrfToken } from 'remix/middleware/csrf'
import { getAssetEntry } from '../middleware/asset-entry.ts'
import { getCspNonce } from '../middleware/security-headers.ts'
import { ThemeToggle } from '../assets/theme-toggle.tsx'

export interface DocumentProps {
  children?: RemixNode
  title?: string
}

const DEFAULT_TITLE = readAppDisplayName('Newapp')

const themeCookie = createCookie('theme', {})

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
    let { title = DEFAULT_TITLE, children } = handle.props
    let theme = getThemeFromCookie()
    let isDark = theme === 'dark'

    return (
      <html lang="de" data-theme={isDark ? 'dark' : undefined} style="overflow-y:scroll">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="light dark" />
          <CsrfMetaTag />
          <title>{title}</title>
          <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%232dacf9'/><text x='16' y='22' text-anchor='middle' font-size='18' font-family='sans' fill='white'>R</text></svg>" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap"
          />
          <Theme />
          <DarkTheme.Style />
          <style>{`
            @media (prefers-reduced-motion: reduce) {
              body { transition: none !important; }
            }
          `}</style>
          <script nonce={getCspNonce()}>{`
            (function() {
              try {
                var t = localStorage.getItem('theme');
                if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
              } catch(e) {}
            })();
          `}</script>
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
          <ThemeToggle />
          {(() => {
            let entry = getAssetEntry()
            let src = entry?.scriptSrc ?? routes.assets.href({ path: 'app/assets/entry.tsx' })
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
