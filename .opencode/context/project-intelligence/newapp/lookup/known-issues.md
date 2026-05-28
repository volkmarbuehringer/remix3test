<!-- Context: project-intelligence/newapp/lookup/known-issues | Priority: medium | Version: 2.0 | Updated: 2026-05-26 -->

# Lookup: Known Issues & Technical Debt

Quick reference — see individual error files for full details.

## 🔴 High

| Issue | File | Error Doc |
|-------|------|-----------|
| Hardcoded session secret | `app/middleware/session.ts` | [session-secret-hardcoded](../errors/session-secret-hardcoded.md) |
| Raw SQL bypasses `afterRead` (BIGINT strings) | Any `pool.query()` on BIGINT columns | [raw-sql-bypasses-afterread](../errors/raw-sql-bypasses-afterread.md) |

## 🟡 Medium

| Issue | File(s) | Error Doc |
|-------|---------|-----------|
| Breadcrumb not auto-synced | `app/ui/breadcrumbs.tsx` | [breadcrumb-not-synced](../errors/breadcrumb-not-synced.md) |
| Nav registry duplicates showcase registry | `app/ui/nav.ts`, `app/ui/showcase-registry.ts` | — |
| Register lacks rate limiting | POST `/register` | [register-rate-limiting](../errors/register-rate-limiting.md) |
| Admin-nutzer FK test failure | `app/actions/admin-nutzer-controller.test.tsx` | [admin-nutzer-fk-test](../errors/admin-nutzer-fk-test.md) |
| Appointment Phase 1 limitations | Various | [appointment-phase1-limitations](../errors/appointment-phase1-limitations.md) |

## 🟢 Low

| Issue | File(s) |
|-------|---------|
| Logger config hardcoded | `app/router.ts` |
| Fragment cache always no-store | `app/middleware/render.tsx` |

## Related

- [Raw SQL afterRead Bypass](../errors/raw-sql-bypasses-afterread.md) — BIGINT string conversion
- [Exclusion Constraints](../concepts/exclusion-constraints.md) — `btree_gist` overlap prevention
