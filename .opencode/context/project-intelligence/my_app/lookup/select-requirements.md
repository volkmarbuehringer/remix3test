---
title: Select Component Requirements
category: project-intelligence
type: lookup
source: remix/ui/select, @remix-run/ui/select
---

# Select Component Requirements

## What Select Needs to Work

| Requirement | Reason |
|-------------|--------|
| `clientEntry` wrapper | Uses `on('click')` mixin — needs runtime to attach handler |
| `import.meta.url` in `clientEntry` | Asset server compiles the module for browser |
| File in asset server allow list | `controller.tsx` `allow` array must include the file and its transitive imports |
| Frame-based content loading | Content must go through runtime's reload pipeline, not raw innerHTML |
| `defaultValue` not `value` on text inputs | Remix runtime treats `value` as controlled input — reverts keystrokes |

## Import Path

```typescript
import { Option, Select } from 'remix/ui/select'
```

(Also available as `@remix-run/ui/select` — both resolve to the same module.)

## Controlled Inputs Gotcha

Text `<input>` elements with `value={...}` become controlled by the Remix runtime. On every keystroke, `restoreControlledReflections` resets the value to the original prop. Use `defaultValue` instead:

```typescript
// ❌ User can't type — value reverts
<input value={row.name} />

// ✅ User can type freely
<input defaultValue={row.name} />
```

This applies to all `<input>` elements inside a `clientEntry` component.

## Asset Server Allow List

Every file used by a `clientEntry` module must be in `app/actions/controller.tsx`'s `allow` array, including transitive imports:

```typescript
allow: [
  'app/actions/client/edit-form.tsx',
  'app/ui/mixins/input.ts',       // imported by edit-form.tsx
  // ...
]
```

## Known Failure Mode

`navEditPanel` in `app/assets/grid-client.ts` does a raw DOM swap that bypasses the Frame runtime, preventing `clientEntry` hydration. See `errors/client-entry-hydration.md`.
