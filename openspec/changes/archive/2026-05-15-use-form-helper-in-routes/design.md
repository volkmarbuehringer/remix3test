## Context

Three AI sub-routes in `app/routes.ts` manually define an `index` (GET) + `action` (POST) pair using the general-purpose `route()` helper:

```typescript
chat: route('chat', {
  index: get('/'),
  action: post('/'),
}),
```

The `form()` helper from `remix/routes` exists specifically for this pattern and is already used for auth login/register routes. The manual pattern and the `form()` helper produce identical route types, names, and URL structures — this is a purely syntactic refactoring.

## Goals / Non-Goals

**Goals:**
- Replace manual `route()` definitions with `form()` for chat, agent, and workflow sub-routes
- Reduce boilerplate and improve consistency with the existing auth route convention
- Zero behavioral change — all route names, patterns, and types must remain identical

**Non-Goals:**
- No controller, router, UI, or test changes
- No import changes (form is already imported)
- No conversion of other route groups (client, admin, lists — they don't follow the form pattern)

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Which routes to convert | chat, agent, workflow | These are the only sub-routes with the exact `index` (GET) + `action` (POST) pattern that `form()` models |
| Whether to convert as a group or individually | All three together | Same pattern, same file, one commit |
| Whether to rename the routes | No, use default names | Current names `index`/`action` match `form()` defaults exactly |
| Whether to change the form method | No, use default POST | Current routes use POST for action — `form()` defaults to POST |

No alternatives were seriously considered — this is a 1:1 syntactic replacement with identical semantics.

## Risks / Trade-offs

- **[Low] Future reader unfamiliar with `form()`**: Mitigated by existing usage in auth routes — the pattern is already established in the codebase.
- **[Low] Form method customization**: If a future route needs a non-POST form action (e.g., PUT), `form()` supports a `formMethod` option. No change needed today.
- **[None] Regressions**: The `form()` helper generates identical internal `Route` objects with the same method and pattern. Route name access patterns (`aiRoutes.ai.chat.index.href()`, `aiRoutes.ai.chat.action.href()`) remain unchanged.
