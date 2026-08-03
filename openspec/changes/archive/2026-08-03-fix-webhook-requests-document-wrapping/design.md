## Context

See proposal.md - Why. `Layout` already wraps content in `Document` (`app/ui/layout.tsx:40`), so wrapping a page in `<Document>` and then `<Layout>` nests a second `<html>` inside the first document's `<body>`. The only thing the outer `<Document>` contributes is the page title, and `Layout` accepts a `title` prop that it forwards to its own `Document`.

## Goals / Non-Goals

**Goals:**
- Both webhook-requests pages emit a single HTML document with one `<html>` root.
- Page titles are preserved (`Webhook Requests`, `Webhook erstellen`).

**Non-Goals:**
- No change to any other route or layout.
- No change to the `Document` or `Layout` components themselves.
- No change to page content, forms, or action handlers.

## Decisions

- **Remove the outer `<Document>` and rely on `Layout` for the shell.** `Layout` already owns `Document` plus the app nav and footer; the outer wrapper only duplicated the shell. Alternative considered: making `Document` skip nested `<html>` output — rejected as framework complexity to fix two call sites.
- **Move the title to `Layout`'s `title` prop.** This keeps the rendered `<title>` identical; auth pages already use this exact pattern (`<Layout title="Sign in">`, `app/actions/auth/pages.tsx:56`).
- **Drop the now-unused `Document` import** from both controllers to keep the diff clean.

## Risks / Trade-offs

- [Title regressions] → The title moves from `Document title` to `Layout title`, which forwards it to the same `Document` `<title>`; verify in the rendered page after the change.
- [Missed a third double-wrapped page] → Grep for `<Document` usages (only `home`, `webhook-requests`, and `webhook-requests/create` render `Document` directly) and leave `home` untouched since it does not use `Layout`.
