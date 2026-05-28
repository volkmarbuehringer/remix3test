<!-- Context: development/remix3/security | Priority: high | Version: 1.0 | Updated: 2026-05-20 -->

# Security

**Core Idea**: CSRF protection, session security, and standardized error responses — three layers of defense that work together to prevent common web vulnerabilities.

## Quick Routes

| Task | File |
|------|------|
| How CSRF works (middleware + token propagation) | `concepts/csrf-implementation.md` |
| Session regeneration (fixation prevention) | `concepts/session-security.md` |
| Error page standards (renderer-based 403 pages) | `concepts/error-response-standards.md` |
| Testing with CSRF tokens | `guides/testing-with-csrf.md` |

## Cross-References

- `../../errors/csrf-middleware-gotchas.md` — Common CSRF pitfalls
- `../../auth/concepts/session-access.md` — Session access patterns
- `../../auth/guides/auth-security.md` — Auth security checklist
