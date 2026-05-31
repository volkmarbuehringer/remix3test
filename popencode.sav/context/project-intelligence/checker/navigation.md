<!-- Context: project-intelligence/checker/nav | Priority: high | Version: 1.3 | Updated: 2026-04-21 -->

# Checker Project

> Remix 3 application with session-based authentication following bookstore demo patterns.

## Quick Reference

| Pattern | File |
|---------|------|
| Project Structure | `../../development/remix3/guides/checker-project.md` |
| AI Chat (SSR) | `guides/ai-chat-ssr.md` |
| Admin Chat Log | `guides/admin-chatlog.md` |
| Admin Books CRUD | `../../development/remix3/guides/checker-project.md` |
| Chat UI Layout Integration | `concepts/chat-layout-integration.md` |
| User-Scoped Logging | `concepts/user-scoped-logging.md` |
| Login Implementation | `guides/login-implementation.md` |
| Middleware Composition | `concepts/middleware-composition.md` |
| HTML Entity Encoding Fix | `lookup/html-entity-encoding-fix.md` |
| Import Conventions | `lookup/import-conventions.md` |
| Testing with SKIP_AUTH | `guides/testing-with-skip-auth.md` |
| Password Hashing Migration | `lookup/password-hashing-migration.md` |
| PostgreSQL Best Practices | `lookup/postgres-best-practices.md` |
| Design Tokens | `design-tokens.md` |
| Common Errors | `errors/common-login-errors.md` |

## Project Structure

```
checker/
├── app/
│   ├── middleware/
│   │   ├── session.ts      # Session cookie + FS storage
│   │   ├── database.ts     # Database context injection
│   │   └── auth.ts         # Auth middleware + requireAuth
│   ├── controllers/
│   │   ├── auth/
│   │   │   ├── login/      # Login form + validation
│   │   │   ├── logout.ts   # Logout handler
│   │   │   └── controller.tsx
│   │   └── account/        # Protected route example
│   ├── data/
│   │   └── schema.ts       # Users table definition
│   └── router.ts           # Middleware chain setup
```

## Key Patterns

**Middleware Order:**
```
formData() → session() → loadDatabase() → loadAuth()
```

**Critical Import Rule:**
```typescript
// ✅ CORRECT - Always use remix/* NOT @remix-run/*
import { createCookie } from 'remix/cookie'
import { auth } from 'remix/auth-middleware'

// ❌ WRONG - Never use @remix-run/* in this project
import { createCookie } from '@remix-run/cookie'
```

## Security Features

- Signed cookies with SESSION_SECRET
- Session ID regeneration on login
- Generic error messages (prevent user enumeration)
- Flash messages (one-time display)
- Safe returnTo validation (prevent open redirects)
- SKIP_AUTH for testing mode

## Related

- Bookstore demo: `../examples/bookstore-demo.md`
- Remix 3 auth: `../../development/remix3/guides/auth-middleware.md`
- Remix 3 sessions: `../../development/remix3/guides/session-middleware.md`
