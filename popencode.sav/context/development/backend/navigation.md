<!-- Context: development/navigation | Priority: low | Version: 1.0 | Updated: 2026-02-15 -->

# Backend Development Navigation

**Scope**: Server-side, APIs, databases, auth

---

## Structure

```
development/backend/           # [future]
├── navigation.md
│
├── api-patterns/              # Approach-based
│   ├── rest-design.md
│   ├── graphql-design.md
│   ├── grpc-patterns.md
│   └── websocket-patterns.md
│
├── nodejs/                    # Tech-specific
│   ├── express-patterns.md
│   ├── fastify-patterns.md
│   └── error-handling.md
│
├── python/
│   ├── fastapi-patterns.md
│   └── django-patterns.md
│
├── authentication/            # Functional concern
│   ├── jwt-patterns.md
│   ├── oauth-patterns.md
│   └── session-management.md
│
└── middleware/
    ├── logging.md
    ├── rate-limiting.md
    └── cors.md
```

---

## Quick Routes

| Task | Path |
|------|------|
| **REST API** | `api-patterns/rest-design.md` [future] |
| **GraphQL** | `api-patterns/graphql-design.md` [future] |
| **API design principles** | `../principles/api-design.md` |
| **Node.js** | `nodejs/express-patterns.md` [future] |
| **Python** | `python/fastapi-patterns.md` [future] |
| **Auth (JWT)** | `authentication/jwt-patterns.md` [future] |

---

## By Approach

**REST** → `api-patterns/rest-design.md` [future]
**GraphQL** → `api-patterns/graphql-design.md` [future]
**gRPC** → `api-patterns/grpc-patterns.md` [future]

## By Language

**Node.js** → `nodejs/` [future]
**Python** → `python/` [future]

## By Concern

**Authentication** → `authentication/` [future]
**Middleware** → `middleware/` [future]
**Data layer** → `../data/navigation.md` [future]

---

## Related Context

- **API Design Principles** → `../principles/api-design.md`
- **Core Standards** → `../../core/standards/code-quality.md`
- **Data Patterns** → `../data/navigation.md` [future]
