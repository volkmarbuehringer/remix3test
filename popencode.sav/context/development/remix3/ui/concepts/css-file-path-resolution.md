# Concept: CSS File Path Resolution

**Purpose**: CSS files in Remix projects must be in `public/` directory to be served statically.

## Core Concept

The Remix dev server only serves static files from the `public/` directory. Files in `app/styles/` are application code, not static assets, and cannot be accessed via browser URLs.

## Key Points

- Static files must be in `public/` directory
- URL path matches file structure: `public/styles/foo.css` → `/styles/foo.css`
- CSS imports within CSS files use relative paths, not URL paths
- Application CSS (like `app.css`) is bundled, not served as static files

## Quick Example

```
# Correct: File in public/
public/styles/tokens.css → Accessible at /styles/tokens.css

# Wrong: File in app/
app/styles/tokens.css → NOT accessible at /styles/tokens.css
```

## Reference

Remix dev server static file handling

## Related

- remix3/guides/design-system-implementation.md
- remix3/concepts/css-class-mapping.md
