# Lookup: Static File Serving in Remix

**Purpose**: Quick reference for serving static files in Remix demos.

## Rule

**Static files MUST be in `public/` directory.**

## URL Mapping

| File Location             | URL Path            |
| ------------------------- | ------------------- |
| `public/app.css`          | `/app.css`          |
| `public/styles/theme.css` | `/styles/theme.css` |
| `public/images/logo.png`  | `/images/logo.png`  |

## Common Mistakes

| Wrong                           | Correct                     |
| ------------------------------- | --------------------------- |
| `app/styles/foo.css`            | `public/styles/foo.css`     |
| `src/assets/foo.js`             | `public/assets/foo.js`      |
| `<link href="/app/styles/...">` | `<link href="/styles/...">` |

## CSS @import

CSS @import paths are relative to the CSS file location, not the URL structure:

```css
/* public/styles/tokens.css */
@import url('/styles/theme.css'); /* Correct: absolute URL */
@import url('../../app/styles/theme.css'); /* Wrong */
```

## Related

- remix3/concepts/css-file-path-resolution.md
- remix3/concepts/css-class-mapping.md
