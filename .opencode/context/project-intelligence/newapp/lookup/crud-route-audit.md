<!-- Context: project-intelligence/newapp/lookup/crud-route-audit | Priority: high | Version: 1.0 | Updated: 2026-05-29 -->

# CRUD Route Audit

All CRUD-like routes in `app/routes.ts` with conversion status for `resources()` adoption.

## Converted

| Route Key | Path | Actions | Since |
|-----------|------|---------|-------|
| `admin.users` | `/admin/users` | index, create, update, destroy | 2026-05-29 |
| `admin.resources` | `/admin/resources` | index, create, update, destroy | 2026-05-29 |
| `appointment.types` | `/appointment/types` | index, create, update, destroy | 2026-05-29 |

## Not Converted — Custom Actions

| Route Key | Path | Standard CRUD | Custom Actions | Reason |
|-----------|------|---------------|----------------|--------|
| `client` | `/client` | index, create, update, destroy | `grid` (GET /grid), `edit` (GET /edit/:rowId) | Non-standard `:rowId` param |
| `admin.nutzer` | `/admin/nutzer` | index, create, update, destroy | `resetPassword`, `toggleLock`, `toggleActive` | 3 custom POST JSON endpoints |
| `admin.offerings` | `/admin/offerings` | index, create, update, destroy | `configSave` (POST /config), `weekGenerate` (POST /week) | 2 custom actions |
| `admin.appointments` | `/admin/appointments` | index, create, update, destroy | `events` (GET /events) | SSE subscription endpoint |
| `admin.chatlog` | `/admin/chatlog` | index | `destroy` via POST not DELETE | Non-standard HTTP method |
| `admin.messages` | `/admin/messages` | index | `action`, `subscribe`, `destroy` | POST-based non-standard patterns |
| `admin.lists` | `/admin/lists` | index | `destroy` via POST | Too sparse, single non-standard action |
| `appointment` | `/appointment` | index, create, update, destroy | `events` (GET /events) | SSE subscription endpoint |

## Quality Gate

A route qualifies as "pure CRUD" only when it has **exactly** these 4 route keys:
- `index` → `GET /`
- `create` → `POST /`
- `update` → `PUT /:id`
- `destroy` → `DELETE /:id`

Any deviation (extra keys, different param names, non-standard methods) disqualifies it.

## 📂 Codebase References

**Implementation**:
- `newapp/app/routes.ts` — All route definitions, both converted and manual

**Related context**:
- `project-intelligence/newapp/concepts/resource-route-adoption.md` — Why and how of the adoption
- `project-intelligence/newapp/guides/resource-route-migration.md` — Step-by-step conversion guide
