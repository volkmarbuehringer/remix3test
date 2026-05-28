<!-- Context: development/remix3/auth/concepts/session-access | Priority: high | Version: 1.1 | Updated: 2026-05-07 -->

# Concept: Session Access Pattern

**Core**: Unlike standard Remix patterns using `request.headers.get('Cookie')`, this codebase uses middleware context to access session via getter.

## Core Concept

Session is accessed through the middleware context's `get()` method rather than parsing cookies from request headers. This pattern is used throughout controllers for flash messages, auth state, and toast notifications.

## Key Points

- Use `get(Session)` in controller actions to access session
- Use `context.get(Session)` in handlers that have full context
- Session flash used for one-time messages (toasts)
- Null check: `context.get(Session) == null` with early throw before use

## Quick Example

```typescript
// In controller action (with AppController — get() returns concrete type)
async index({ get, url }) {
  let session = get(Session)
  let user = session?.get('user')
  // ...
}

// Flash message for toast (null-check before use)
let session = context.get(Session)
if (session == null) {
  throw new Error('Expected session middleware before handler')
}
session.flash('toast', { message: 'Saved', type: 'success' })
```

## Related

- guides/session-middleware.md
- concepts/toast-system.md
- ../../middleware/concepts/request-context-get-pattern.md — General get() null-check pattern
