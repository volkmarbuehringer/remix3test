## Context

This app uses Remix 3's Frame relay pattern for both the admin and lists sections. Each section has a `ShellOrFragment` that dispatches to `<Frame>` on first GET and renders content directly when the frame target header matches. Links inside a Frame that navigate to a different section (e.g., admin → lists) need to perform a real document-level page navigation so the Remix app re-initializes at the new URL with the correct Frame relay structure.

Remix 3 uses `rmx-document` to signal document-level navigation. Without it, the click interceptor defaults to frame-based navigation. When a frame-based navigation targets a URL that itself contains a `<Frame>` (the Frame relay pattern), Remix resolves that Frame, which may trigger additional frame resolution events, creating an unchecked loop that consumes 100% CPU and freezes the browser.

## Goals / Non-Goals

**Goals:**
- Add `rmx-document` to the two plain `<a>` tags that navigate between Frame-relay sections
- Eliminate the CPU-hogging frame-resolution loop
- Match the existing pattern used by other cross-section links (`grid-page.tsx`, `verwaltung-page.tsx`)

**Non-Goals:**
- Changing how `NavLink` renders cross-section navigation (already correct)
- Auditing every `<a>` tag in the codebase for this pattern
- Changing the Frame relay architecture

## Decisions

### Add `rmx-document` to admin description links

The `/admin/lists` page description links use `target="_top"` but lack `rmx-document`. Every other link in the codebase that breaks out of a Frame uses both attributes together (see `grid-page.tsx:442`, `nav-link.tsx:25`). Adding `rmx-document` aligns with the established pattern.

**Alternative considered**: Converting the link to use `NavLink` with `document: true`. Rejected because this link already has a complex structure (conditional render, custom styles) and the minimal fix is to add the attribute to the existing plain `<a>`.

### Add `rmx-document` to MainNav cross-section links

The `MainNav` renders plain `<a>` tags. When the user is on a Frame-relay page (like `/lists` or `/admin`), clicking a MainNav link to a different Frame-relay section triggers the same frame-resolution loop. Adding `rmx-document` tells Remix to perform a document-level navigation.

However, the MainNav links also include same-section links (e.g., `/admin` → `/admin`) where `rmx-document` would force an unnecessary full page reload instead of the efficient frame-based navigation. The fix should apply `rmx-document` only when the link destination differs from the current section.

**Alternative considered**: Adding `rmx-document` unconditionally to all MainNav links. Rejected because it would degrade the user experience — same-section navigation through the Frame relay is fast and desirable.

## Risks / Trade-offs

- **Risk**: Adding `rmx-document` causes unnecessary full page reloads for same-section navigation → **Mitigation**: Only add `rmx-document` when the link destination differs from the current section context
- **Risk**: Other undiscovered plain `<a>` tags in Frame contexts have the same bug → **Mitigation**: This fix addresses the two known crash sites; further instances can be discovered through normal usage
