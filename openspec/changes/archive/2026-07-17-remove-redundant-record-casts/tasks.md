## 1. Remove casts in resources controller

- [x] 1.1 Remove `as Record<string, string>` casts from `resources/controller.tsx` (agent branch, create, update, destroy — 4 total)
- [x] 1.2 Remove `as Record<string, string>` casts from `offering-configs/controller.tsx` (two occurrences)

## 2. Verify

- [x] 2.1 Run `npm run typecheck` — no type errors
- [x] 2.2 Run `npm test` — all server tests pass (browser infra pre-existing)
