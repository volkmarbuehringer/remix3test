# Remix 3 Component Context, `handle.id`, and Mutable Context

**Source:** installed guide `node_modules/remix/guides/04-rendering-ui.md` — "Props, local state, context, and updates" (L68–178).

**Extracted:** 2026-09-26

**Context:** A reusable Remix component needs to share a value with descendants, generate a stable DOM id, or expose context that can change in the browser.

## Problem

No skill names `handle.context`, `handle.id`, or `TypedEventTarget`; the guide is the only description. Worse, `handle.context` is easy to confuse with the server request context this app uses everywhere (`remix/middleware/async-context` `getContext()` and middleware `context.set/get`), which is a completely different mechanism.

## Solution

Follow the guide for the API; keep these two contexts distinct.

- **Component context** (`handle.context`, guide L149–178): the provider component's type is the key. The provider calls `handle.context.set(value)` in setup; a descendant calls `handle.context.get(ProviderType)` and reads it during render. `set(...)` stores the value but does **not** schedule an update — for context that changes in the browser, update the provider or use a `TypedEventTarget` so only listening consumers re-render.
- **Server request context** (`remix/middleware/async-context`): `getContext()` plus `context.set`/`context.get` in middleware. This app relies on it for request-scoped values (e.g. `app/ui/document.tsx` reads the theme cookie and CSRF token through `getContext()`; `app/middleware/asset-entry.ts` stores the asset entry on a context key). It is not available in a browser component and is not a substitute for `handle.context`.
- **`handle.id`** (guide L133–147): a stable per-instance identifier for wiring `label`/`input` or ARIA relationships without requiring an `id` prop.
- **`TypedEventTarget`** (guide L176–178): the recommended carrier for browser-reactive shared context.

**App status (re-check before relying):** as of extraction, `handle.context`, `handle.id`, and `TypedEventTarget` have **zero** occurrences under `app/`. Treat this as new surface; when you introduce it, prefer a browser component test that drives the update (see `remix3-testing` and `remix3-client-entries`).

## When to Use

- Passing a value from a component to a descendant without prop-drilling.
- Giving a reusable control a stable id for a label or ARIA relationship.
- Sharing state that must stay reactive in the browser.

## Reference

- `node_modules/remix/guides/04-rendering-ui.md` L68–178
- `node_modules/remix/src/ui/README.md` — exact `Handle` context/id API
