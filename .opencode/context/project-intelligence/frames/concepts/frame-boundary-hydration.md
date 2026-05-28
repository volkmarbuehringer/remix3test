---
title: Frame Boundary Hydration Behavior
description: Why client entries inside Frame boundaries do not re-hydrate on parent reload.
---

# Concept: Frame Boundary Hydration

**Core Idea**: When a parent `<Frame>` reloads (e.g., after pagination), the diff algorithm treats `rmx:f:` frame boundary markers as opaque regions. It skips all nested `rmx:h:` hydration markers inside them, leaving child client entries with stale props.

## Key Points

- `<Frame>` renders `<!-- rmx:f:{id} -->...<!-- /rmx:f -->` markers during SSR
- `diffElementChildren` in `diff-dom.ts` skips content inside existing frame regions
- Existing virtual roots for nested client entries are preserved, not recreated
- Props passed to client entries inside Frames never update on parent reload

## When This Matters

- Paginated lists where each item contains an interactive client entry
- Any client entry that receives props from a parent Frame

## Reference

- See `guides/client-entry-in-paginated-lists.md` for the correct pattern
- See `errors/stale-props-after-pagination.md` for the full error breakdown

## Codebase References

**Implementation**:
- `@remix-run/component/src/lib/diff-dom.ts` - Diff algorithm skipping frame regions
- `@remix-run/component/src/lib/frame.ts` - `createSubFrames` reusing frame instances
