## Context

`.opencode/skills/learned/` holds skills auto-extracted and consolidated from past agent sessions. The vendor `remix` skill (`.opencode/skills/remix/`) plus the guide chapters at `~/remix/guides/app/actions/docs/chapters/` are authoritative references for Remix 3 patterns; package READMEs under `~/remix/packages/` document the public API surface. Learned skills should only preserve the delta the vendor sources don't cover: failure modes, migration gotchas, and app-specific conventions.

The audit compared 9 frame-related learned skills against guide chapters 02–11 (especially `06-streaming-ui-with-frames.md`), the vendor `remix` skill references, and package READMEs. This design records the per-skill disposition and the exact trim boundaries.

## Goals / Non-Goals

**Goals:**

- Eliminate skills that restate vendor/README content with no learned delta
- Trim partial duplicates down to their unique delta, retaining all hard-won nuance
- Correct one insecure recommendation (`trustProxy: true`) that conflicts with the newer two-tier IP model
- Keep all three skills with genuinely unique content intact

**Non-Goals:**

- Rewriting application code — this change only touches agent guidance assets
- Merging unrelated learned skills or restructuring `.opencode/skills/` layout
- Expanding guide coverage — vendor guides are authoritative and read-only

## Decisions

### Decision 1: Delete `remix-fetch-proxy`, replace with a pointer

`remix-fetch-proxy/SKILL.md` (30 lines) restates `packages/fetch-proxy/README.md` feature-for-feature (cookie rewriting, forwarding headers, custom fetch) with no learned delta.

**Action**: Delete the skill directory. Add one line to `AGENTS.md`'s specialized-skills list noting `remix/fetch-proxy` is covered by the vendor `remix` skill and the fetch-proxy README.

**Alternative considered**: Keeping it as a thin index. Rejected — the vendor `remix` skill's package map already indexes `remix/fetch-proxy`.

### Decision 2: Trim `remix-file-uploads` to the bytea delta

First ~54 lines (multipart parsing, size limits, storage backends) restate `multipart-parser` / `form-data-middleware` / `file-storage` READMEs and guide 11. Lines 56–150 (PostgreSQL `bytea` backend) are unique: the `formData()`-runs-before-auth middleware-ordering gotcha (`uploaded_by = null` fixup), the download endpoint via standalone `createAction`, and the `void`-handler in-memory failure-detection trick.

**Action**: Delete lines 10–54; prepend a pointer to the vendor READMEs; keep the bytea section verbatim.

### Decision 3: Trim `remix3-frame-cliententry` internal + guide overlap, keep unique sections

1835-line consolidated skill. Unique content to keep: form-interception root cause (`canIntercept === false`, `rmx-target` ignored on `<form>`), `clientEntry` cascade limit (50), mounted-guard after frame reload, post-navigation `reloadComplete` data loading, CSS child-selector `SerializableProps` restriction, inline-edit, drag/drop, fragment scrolling, test verification, frame target registration, input value preservation, frame direct render.

Overlap to trim:
- §"Binary File Downloads in Frames" and §"Cross-Section Navigation CPU Loop" both restate the `rmx-document` attribute fact already in guide 06/05 — collapse into one `rmx-document` section keeping only the crash/loop symptoms and the `X-Remix-Frame` 302 guard
- §"on Mixin Requires clientEntry" — keep only the "compiles but never fires" diagnostic and Document-vs-Layout mount placement (base rule is in guide 04/05)
- §"Mobile Nav Hamburger" — off-topic for a frame skill; remove

### Decision 4: Trim `remix3-standalone-route-admin-sidebar`, fix insecure §4

Unique deltas: SSE endpoints need 401-auth not redirect-auth (EventSource can't follow 302 → `requireSseAuth()`), and `iframeNav: false`. §1 (direct `router.get/post` registration) restates guide 02 / vendor skill. §4 uses `{ trustProxy: true }` which `remix3-two-tier-ip-trust-model` marks as spoofable.

**Action**: Remove §4 and replace with a link to `remix3-two-tier-ip-trust-model`; trim §1 and §5 to pointers; keep §2 + §3 verbatim.

### Decision 5: Merge `remix3-multiple-route-trees` into `remix-cli-devops`, then delete

Multiple named exports + `router.map()` composition restates vendor skill and guide 02. The only unique fact: `remix routes` CLI only sees the first/default route tree.

**Action**: Add the CLI-discovery limitation as a note in `remix-cli-devops`; delete `remix3-multiple-route-trees`.

### Decision 6: Trim `remix-routepattern-opaque-access` to the migration warning

Public API table (`source`/`toString()`/`toJSON()`) is in the route-pattern README. Unique: RoutePattern became opaque in beta.5, `pathname.tokens` access breaks, `.source.replace(...)` rewrite technique.

**Action**: Keep the migration warning; drop the API table in favor of a README pointer.

## Risks / Trade-offs

| Risk | Mitigation |
| --- | --- |
| `AGENTS.md` lists `remix3-multiple-route-trees`, `remix-fetch-proxy`, `remix-file-uploads` among the "11 specialized skills" | Update the list as part of this change; keep a pointer to the vendor `remix` skill |
| `remix3-agent-routing` referenced by `mastra-agent/SKILL.md:621`; `remix-route-relocation` by `remix-controllers/SKILL.md:522` and `form-error-handling-remix3/SKILL.md:842` | Both are kept as-is; no reference updates needed |
| Trimming `remix3-frame-cliententry` could drop hard-won nuance | Trims are bounded to the documented overlap sections; everything else stays verbatim |
| Removing insecure `trustProxy: true` guidance could be confused with the older behavior | The removal is a deletion plus an explicit pointer to the corrected two-tier model |
