<!-- Context: development/remix3/lookup/skill-reference-index | Priority: medium | Version: 1.0 | Updated: 2026-05-05 -->

# Remix Skill Reference Index

**Core Idea**: The template's remix skill at `~/remix/template/.agents/skills/remix/` contains 11 reference files and a comprehensive SKILL.md (573 lines). This index maps each reference to its coverage area for quick lookup.

## Reference Files

| File | Lines | Topics | Existing Context Coverage |
|------|-------|--------|--------------------------|
| `routing-and-controllers.md` | 380 | Route builders, controllers, params, responses, href generation | Covered in `../routing/concepts/routing.md`, `../routing/guides/router-mapping.md` |
| `middleware-and-server.md` | 233 | Middleware ordering, custom middleware, server adapters | Covered in `lookup/middleware-api-reference.md` |
| `component-model.md` | 282 | Setup/render phases, props, state, lifecycle, queueTask | Covered in `ui/concepts/component-model.md` |
| `hydration-frames-navigation.md` | 297 | clientEntry, run(), Frame, navigate, SSR rendering | Covered in `ui/concepts/hydration-frames.md` |
| `assets-and-browser-modules.md` | 130 | createAssetServer config, fileMap, allow/deny, fingerprinting | Covered in `concepts/asset-server.md`, `examples/asset-server-minimal.md` |
| `data-and-validation.md` | 379 | Tables, schemas, parseSafe, FormData validation, migrations | Covered in `../data/concepts/data-schema.md`, `../lookup/web-standards-api.md` |
| `auth-and-sessions.md` | 440 | Sessions vs cookies, login flows, OAuth, requireAuth | Partial — see `guides/auth-middleware.md` |
| `testing-patterns.md` | 172 | Router tests, component tests, remix test CLI | Covered in `test/` directory |
| `mixins-styling-events.md` | 213 | on(), css(), ref(), link(), attrs(), animation mixins | Covered in `ui/lookup/mixins-styling-events.md` |
| `animate-elements.md` | 195 | animateEntrance, animateExit, spring, tween | Covered in `ui/lookup/animate-elements.md` |
| `create-mixins.md` | 158 | createMixin, insert/remove lifecycle, queueTask | Covered in `ui/lookup/create-mixins.md` |

## When to Use the Reference Files

The template's reference files are more exhaustive than individual context files. Load them directly when:

1. **You need the complete API surface** of a subsystem (all route builders with every option)
2. **You're writing complex middleware** and need ordering details + examples
3. **You need a comprehensive auth flow** (OAuth, credentials, sessions, CSRF together)
4. **Existing context is ambiguous or incomplete**

## Loading References

```bash
# In agent prompts, reference:
~/remix/template/.agents/skills/remix/references/{filename}
```

## Source

- Full skill: `~/remix/template/.agents/skills/remix/SKILL.md` (573 lines)
- Template source: `~/remix/template/`
