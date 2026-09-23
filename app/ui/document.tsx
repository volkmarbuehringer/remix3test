import type { Handle, RemixNode } from 'remix/ui'
import { css } from 'remix/ui'
import { ImportMap } from 'remix/ui/server'
import { getContext } from 'remix/middleware/async-context'
import { createCookie } from 'remix/cookie'
import { Cookie } from 'remix/headers/cookie'
import { theme as themeTokens, RMX_01_GLYPHS } from '../ui/theme/theme.ts'

import { routes } from '../routes.ts'
import { DarkTheme, Theme } from '../theme.tsx'
import { getCsrfToken } from 'remix/middleware/csrf'
import { getAssetEntry } from '../middleware/asset-entry.ts'
import { getCspNonce } from '../middleware/security-headers.ts'
import { ThemeToggle } from '../ui/theme-toggle.browser.tsx'

interface DocumentProps {
  children?: RemixNode
  title?: string | undefined
  description?: string | undefined
  ogImage?: string | undefined
  ogType?: string | undefined
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
    let { title = DEFAULT_TITLE, description, ogImage, ogType = 'website', children } = handle.props
    let theme = getThemeFromCookie()
    let isDark = theme === 'dark'

    return (
      <html
        lang="de"
        data-rmx-preserve-attrs="data-theme"
        data-theme={isDark ? 'dark' : undefined}
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
          <style>{`
            @media (prefers-reduced-motion: reduce) {
              body { transition: none !important; }
            }
          `}</style>
          <script nonce={getCspNonce()}>{`
            (function() {
              try {
                var stored = localStorage.getItem('theme');
                var cookie = /(?:^|;\\s*)theme=(dark|light)/.exec(document.cookie);
                var explicit = stored || (cookie && cookie[1]) || null;
                var mql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
                var apply = function(dark) {
                  if (dark) document.documentElement.setAttribute('data-theme', 'dark');
                  else document.documentElement.removeAttribute('data-theme');
                };
                // An explicit choice (localStorage or cookie) always wins; without
                // one, follow the operating-system preference.
                apply(explicit ? explicit === 'dark' : !!(mql && mql.matches));
                if (!explicit && mql) {
                  var onChange = function(e) {
                    try { if (localStorage.getItem('theme')) return; } catch (err) {}
                    apply(e.matches);
                  };
                  if (mql.addEventListener) mql.addEventListener('change', onChange);
                  else if (mql.addListener) mql.addListener(onChange);
                }
              } catch(e) {}
            })();
          `}</script>
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
          <ThemeToggle />
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
