<!-- Context: development/principles/api-design | Priority: low | Version: 2.0 | Updated: 2026-03-27 -->

# Concept: API Design Patterns

**Core Idea**: REST API design principles, GraphQL patterns, and versioning strategies for building robust, scalable, and maintainable APIs.

**Key Points**:
- REST: Nouns for resources, proper HTTP methods, standard status codes
- Response format: `{ data, meta, links }` for collections
- GraphQL: Schema-first design, DataLoader for N+1 prevention
- Versioning: URL path (`/v1/`) or header-based
- Auth: JWT stateless, RBAC for authorization

**Quick Example**:
```bash
# REST endpoints
GET /users?page=2&pageSize=20&sort=createdAt:desc
POST /users
PUT /users/123

# Response format
{
  "data": [...],
  "meta": { "total": 100, "page": 2, "pageSize": 20 },
  "links": { "self": "/users?page=2", "next": "/users?page=3" }
}
```

**Best Practices**:
- Use HTTPS everywhere
- Implement rate limiting
- Validate all inputs
- Document with OpenAPI
- Version API early
- Use caching (ETags)

**Reference**: REST API Design Rulebook | GraphQL Best Practices
