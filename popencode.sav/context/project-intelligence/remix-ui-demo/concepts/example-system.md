---
title: Example System
description: Dynamic filesystem-based example discovery, metadata, module loading, and frame embedding
category: project-intelligence
type: concept
source: app/examples/discovery.ts, app/examples/index.tsx, app/examples/view.tsx, app/examples/controller.tsx
---

# Example System

## Core Concept

Examples are auto-discovered from the filesystem, enriched with metadata, served via a controller with content/show actions, and embedded in pages via Remix `<Frame>`.

## Key Points

- **Discovery** (`discovery.ts`): `walkExampleFiles` recursively scans `app/examples/` subdirectories, ignoring files starting with `_` or `.`, `controller.tsx`, `index.tsx`, `view.tsx`, and non-`.tsx` files. Returns `DiscoveredExampleFile[]` with slug, id, contentPath, assetHref.
- **Metadata** (`index.tsx`): `EXAMPLE_COPY_BY_SLUG` enriches each discovered file with title, description, optional custom slug/id. Slug→id uses camelCase (`toExampleId`). Missing files for configured slugs throw an error at startup.
- **Module loading**: `loadExampleModule` uses `import()` with cache-busting via `stat.mtimeMs`. Module must `default export` a component function. `clientEntry` wraps it for client hydration.
- **Controller** (`controller.tsx`): Two actions — `content` renders the example with source code display, `show` renders a full document (standalone). Source is read via `fs.readFileSync`.
- **Frame embedding** (`view.tsx`): `ExampleContent` uses `<Frame>` to embed the example. `ExampleDocument` wraps it in a full HTML page for standalone viewing.

## Data Flow

```
filesystem .tsx → walkExampleFiles() → discoverExampleFiles()
  → createExampleEntries() (merge with EXAMPLE_COPY_BY_SLUG metadata)
    → EXAMPLE_LIST, EXAMPLES_BY_SLUG, EXAMPLES exports
      → controller action → render(<ExampleContent>)
        → <Frame src={contentPath}> → SSR fetch → ExamplePreview
```

## References

- `app/examples/discovery.ts` — Filesystem walking and slug/id generation
- `app/examples/index.tsx` — Metadata, module loading, example registry
- `app/examples/view.tsx` — Frame-based example rendering views
- `app/examples/controller.tsx` — Content and show actions
- `app/example-preview.tsx` — Example preview card with code panel
