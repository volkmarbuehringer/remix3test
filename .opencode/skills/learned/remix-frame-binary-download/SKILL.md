---
name: remix-frame-binary-download
description: "Serve binary file downloads (PDF, CSV) from a Remix 3 app using Frame navigation"
user-invocable: false
origin: auto-extracted
---

# Binary File Downloads in Remix 3 Frame Navigation

**Extracted:** 2026-06-11
**Context:** Adding a PDF download route to a Remix 3 app that uses `<Frame>` navigation — the frame router intercepted the link click and tried to render the binary PDF response as HTML, causing `Node.insertBefore: Cannot insert a Text as a child of a Document`.

## Problem

When a Remix 3 app uses `<Frame>` navigation, clicking a link to a binary download endpoint (PDF, CSV, ZIP, etc.) causes the frame router to:

1. Intercept the click
2. Fetch the URL with `Accept: text/html` and `X-Remix-Frame: true` headers
3. Try to parse the binary response as a component tree

This produces a cryptic DOM error: `Node.insertBefore: Cannot insert a Text as a child of a Document`

The same URL works on browser reload because the full-page navigation skips the frame router.

## Solution

Two changes are needed — one on the link, one on the server:

### 1. Bypass frame navigation on the link

Add `rmx-document` attribute to any `<a>` tag pointing to a binary download:

```tsx
<a href={routes.export.pdf.index.href()} rmx-document>
  PDF herunterladen
</a>
```

This tells the Remix navigation runtime to skip frame interception for this link (handled in `navigation.ts` line 148: `if (linkElement.hasAttribute('rmx-document')) return`).

### 2. Guard the controller against frame requests

If someone navigates to the URL directly while inside a frame (e.g., types it in the address bar), the request still carries `X-Remix-Frame: true`. Redirect to force a full-page navigation:

```tsx
async index(context) {
  if (context.request.headers.get('X-Remix-Frame') === 'true') {
    let url = new URL(context.url)
    return new Response(null, {
      status: 302,
      headers: { Location: url.href },
    })
  }
  // ... generate and return binary response ...
}
```

### Full example

```tsx
// Controller
export default createController(routes.export.pdf, {
  middleware: [requireAuth()],
  actions: {
    async index(context) {
      if (context.request.headers.get('X-Remix-Frame') === 'true') {
        let url = new URL(context.url)
        return new Response(null, {
          status: 302,
          headers: { Location: url.href },
        })
      }
      let buffer = await generatePdf()
      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="export.pdf"',
        },
      })
    },
  },
})
```

### Error symptom

```
Error: Node.insertBefore: Cannot insert a Text as a child of a Document
```

This error appears in the browser when the frame router tries to mount binary data as a component tree. If you see it, check whether the URL is a binary download being loaded through frame navigation.

## When to Use

- Adding any route that returns binary content (`Content-Type: application/pdf`, `text/csv`, `application/zip`, etc.) in a Remix 3 app that uses `<Frame>` navigation
- Debugging `Node.insertBefore` DOM errors in a Remix 3 app
- When a download link works on page reload but crashes on first click from a frame context
