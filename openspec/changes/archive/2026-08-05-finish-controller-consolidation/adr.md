# ADR: `remix doctor` action-layout warnings are non-gating

**Status:** Accepted
**Date:** 2026-08-05
**Change:** finish-controller-consolidation

## Context

`remix doctor` expects one `controller.tsx` per route *node* at a kebab-cased path derived
from the route-map key (e.g. `app/actions/admin/nutzer/controller.tsx` for `admin.nutzer`).
The repo convention, established by `consolidate-auth-controller` and the
`controller-feature-colocation` spec, is one `controller.tsx` per route *group* with named
exports, reached through a single re-export entry point (`admin/controller.tsx`,
`verwaltung/controller.tsx`, `api/controller.tsx`).

These two conventions are structurally incompatible for the same routes: satisfying the doctor
would require splitting consolidated group controllers back into per-node directories, which
reverts the consolidation direction the repo already committed to.

## Decision

Treat `remix doctor`'s "missing action controller" / "does not match any route map" warnings as
**known and expected**. They MUST NOT block CI or PR merge. The consolidation convention is the
source of truth; the doctor's action-layout check is not adopted as a gate.

If a future `remix` version ships a configuration to scope or disable the action-layout check,
adopt it to reduce the known noise.

## Consequences

- `remix doctor` will continue to emit action-layout warnings after consolidation. This is accepted.
- Route groups are consolidated via single re-export entry points; subgroup implementation
  modules may remain on disk (e.g. `app/actions/nutzer/controller.tsx`).
- `mastra/` is intentionally excluded from consolidation (it is the agent subsystem, not a
  route-controller group).
