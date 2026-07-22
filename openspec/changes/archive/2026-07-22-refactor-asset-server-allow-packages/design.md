## Context

`app/assets.ts` configures `createAssetServer` with:

- `fileMap` entries for `app/*path` and `node_modules/*path` — tells the asset server which on-disk paths correspond to URL paths
- `allow` list that includes `node_modules/**` — permits client imports from any npm package

The upstream `packages/assets` just landed `allowPackages` (#11480), a purpose-built option that resolves npm packages by name instead of by filesystem path glob. This is more precise — it handles subpath exports, deep imports, scoped packages correctly — and narrower.

Only the `remix` npm package is imported by client-side code (`app/assets/`, `app/ui/`, `app/routes.ts`, `app/utils/`). No other npm package needs the asset server. Mastra, pg, zod, etc. are server-only.

## Goals / Non-Goals

**Goals:**
- Replace `node_modules/**` allow with `allowPackages: ['remix']`
- Strip the `node_modules/*path` fileMap entry as no longer needed
- Keep all existing client imports working

**Non-Goals:**
- No behavioral change to how assets are served
- Not migrating to the new `allowFiles`/`denyFiles` option names (can be done separately)
- Not changing the asset pipeline architecture

## Decisions

| Decision | Rationale |
|---|---|
| `allowPackages: ['remix']` not `['remix', '@mastra/*', ...]` | Mastra is entirely server-side; client code never imports from it |
| Remove `fileMap.node_modules` entry | Unused when no npm packages are referenced by filesystem path anymore |
| Keep old `allow`/`deny` names | They still work; renaming would be noise in this change |

## Risks / Trade-offs

- **Forgotten client import** → If a future client component imports from a second npm package, the asset server will reject it with a 403. The fix is obvious: add it to `allowPackages`.
- **No spec impact** → This is purely an ops/config improvement, not a feature change.
