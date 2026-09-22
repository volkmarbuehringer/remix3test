---
name: remix3-self-hosted-fonts
description: "Use when adding, replacing, or auditing a webfont in this Remix 3 app, or when a page still loads fonts from fonts.googleapis.com / fonts.gstatic.com — self-host under `public/`, dedupe Google's single variable woff2 per family, serve it with `remix/middleware/static`, and tighten the CSP."
metadata:
  origin: auto-extracted
---

# Self-Host Webfonts in a Remix 3 App

**Extracted:** 2026-09-22
**Context:** This app advertises EU/DSGVO hosting but loaded Inter + JetBrains Mono from
Google's CDN, with the Inter `<link>` injected into the `<body>` by a page component.
Google-Fonts CDN embedding has been ruled unlawful in Germany.

## Problem

"Just download the fonts" from the Google CSS2 API goes wrong in three ways:

1. For variable families (Inter, JetBrains Mono) the API returns the **same** woff2 URL
   for *every* requested weight. Downloading per weight writes N byte-identical copies
   (all five Inter files were 48256 B, identical SHA-256) and you must still widen the
   emitted `font-weight`.
2. A page-rendered `<link rel="stylesheet">` lands in the body, ~10 KB in, delaying
   discovery. Font links belong in `Document`'s `<head>`.
3. The CSP still allowlists `https://fonts.googleapis.com` (style-src) and
   `https://fonts.gstatic.com` (font-src); self-hosting is pointless until those go.

## Solution

1. **Find the loaders.** `grep -rn "fonts.googleapis\|fonts.gstatic" app/` — expect hits in
   `app/ui/document.tsx` and the page component (`FontLoader`), plus
   `app/middleware/security-headers.ts`.

2. **Fetch the CSS with a modern UA** (otherwise you get legacy formats):
   ```sh
   curl -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ... Chrome/131 ...' \
     'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap'
   ```
   Parse `/* subset */` blocks; `latin` (U+0000-00FF) is enough for German (ä/ö/ü/ß are
   in range) — do not ship `latin-ext` unless Cyrillic/Greek/Vietnamese are needed.

3. **Dedupe by URL — one file per family.** All Inter weights share one URL, all JetBrains
   Mono weights another. Save two files, then declare a **weight range**:
   ```css
   @font-face {
     font-family: 'Inter';
     font-style: normal;
     font-weight: 100 900;    /* NOT `400` — it is one variable file */
     font-display: swap;
     src: url('/fonts/inter.woff2') format('woff2');
   }
   ```
   Verifying after the fact: the per-weight downloads hashing identically is the tell, and
   a hidden span must measure a *different* width at `400` vs `800`.

4. **Serve `public/` with the static middleware**, in `app/middleware/root.ts`:
   ```ts
   import { staticFiles } from 'remix/middleware/static'

   return createMiddleware(
     skipAssetsLogger(),
     securityHeaders(),                       // first: static responses still get CSP
     staticFiles('./public', {
       cacheControl: 'public, max-age=86400',  // no content hash → NOT `immutable`
       // optional: filter: (p) => p.startsWith('fonts/'),
     }),
     compression(),
     /* …session, loadDatabase, … */
   )
   ```
   Placement matters: after `securityHeaders()` (headers still applied) and before
   `session`/`loadDatabase` (a font request must not touch the DB). The asset pipeline
   (`remix.json assets.files.extensions: ['.woff2']`) is the alternative, but those URLs are
   fingerprinted in production; the static middleware gives stable `/fonts/...` paths.

5. **Link it from `Document`** (`app/ui/document.tsx`) and delete the page-level loader:
   ```tsx
   {/* Self-hosted (see public/fonts) — never load webfonts from a third-party CDN. */}
   <link rel="stylesheet" href="/fonts/fonts.css" />
   ```

6. **Tighten the CSP** to match: `style-src 'self' 'unsafe-inline'` and
   `font-src 'self'`.

7. **Keep the regeneration script committed** (e.g. `scripts/fetch-fonts.mjs`). A `tmp/`
   script is gitignored, so the committed `fonts.css` would reference a file missing from
   every clone. Update the stylesheet's header comment to the committed path.

8. **Guard it with a test** (`app/actions/home/controller.test.ts` style): home HTML contains
   no `fonts.googleapis.com` / `fonts.gstatic.com` and does link `/fonts/fonts.css`;
   `GET /fonts/fonts.css` → `Content-Type: text/css`; `GET /fonts/*.woff2` → `font/woff2`.
   That last pair also exercises the `staticFiles` wiring.

## When to Use

- Adding or replacing a webfont, or moving one off a CDN
- Reviewing a landing page that embeds `fonts.googleapis.com` / `fonts.gstatic.com`
- A page renders in the wrong typeface after a deploy (check `/fonts/*` resolves and CSP
  `font-src` allows `'self'`)
- Any PR that adds a font `<link>` outside `Document`'s head

## Related Skills

- `remix3-build-and-tooling` — the `remix.json` asset-server alternative (`files.extensions`)
- `security-gotchas` / `remix-headers` — CSP construction and nonce handling
- `remix3-theme-conformance` — the theme's own `fontFamily.sans` token
