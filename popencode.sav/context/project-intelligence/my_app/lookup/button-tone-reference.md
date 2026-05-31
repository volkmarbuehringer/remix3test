<!-- Context: project-intelligence/my_app/lookup/button-tone-reference | Priority: high | Version: 1.1 | Updated: 2026-05-05 -->

# Quick Reference: Button Tone Mapping

## Tone → Action Mapping

| Tone | Use For | Never Use For |
|------|---------|---------------|
| `primary` | Submit, save, create, search, primary actions, accent CTAs | Cancelling, deleting, nav/utility |
| `secondary` | Cancel, reset, edit, pagination, copy, secondary nav | Primary CTAs, destructive actions, nav |
| `ghost` | Logout, theme toggle, hamburger, icon-only actions, dismiss | Primary forms, destructive actions |
| `danger` | Delete, destroy, any destructive irreversible action | Navigation, primary submission |

## File-by-File Tone Usage

| File | Button(s) | Tone(s) |
|------|-----------|---------|
| `auth-login/controller.tsx` | Login submit | `primary` |
| `auth-register/controller.tsx` | Register submit | `primary` |
| `chat/page.tsx` | Send (circular icon) | `primary` |
| `agent/page.tsx` | Send (circular icon) | `primary` |
| `messages/fragment-page.tsx` | Pagination prev/next, Send | `secondary`, `primary` |
| `client/grid-page.tsx` | Edit, Delete, Pagination prev/next | `secondary`, `danger` |
| `client/edit-form.tsx` | Save Changes, Cancel/Reset | `primary`, `secondary` |
| `admin/lists/index-page.tsx` | Delete, Copy | `danger`, `secondary` |
| `admin/chatlog-page.tsx` | Search, Delete conversation | `primary`, `danger` |
| `workflow/page.tsx` | Run Workflow (with startIcon) | `primary` |
| `lists-client.tsx` | Reverse, Shuffle, Auto-shuffle, Save, Add, Edit, Cancel, Delete, Move up/down | `secondary`, `primary`, `danger`, `ghost` |
| `ui/layout.tsx` | Logout (×2), Theme toggle, Hamburger | `ghost` |
| `ui/toast.tsx` | Dismiss | `ghost` |
| `ui/prompt-button.tsx` | Copy to clipboard | `ghost` |

## Import Path

```typescript
import { Button } from 'remix/ui/button'
```

## Composition Quick Reference

```typescript
// Plain — tone only
<Button type="submit" tone="primary">Label</Button>

// With icon (no mixin needed)
<Button tone="primary" startIcon={<Svg />}>Label</Button>

// With custom mixin
<Button tone="ghost" mix={customStyle}>Label</Button>

// With event handler mixin
<Button tone="primary" mix={on('click', handler)}>Label</Button>

// Multiple mixins
<Button tone="ghost" mix={[baseStyle, on('click', handler)]}>Label</Button>

// Array with dynamic style prop (state-driven)
<Button tone="ghost" mix={[baseStyle]} style={{ color: active ? 'red' : undefined }}>Label</Button>

// Icon-only (circular) — needs custom mixin for dimensions
<Button tone="primary" mix={circleStyle} aria-label="Send"><Svg /></Button>
```

## Animation Import

```typescript
import { animateEntrance, animateExit } from 'remix/ui/animation'

// Entrance on fragment content
<div mix={animateEntrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 })}>

// Exit on dismissible elements (composed in array)
<div mix={[containerStyle, animateExit({ opacity: 0, duration: 200 })]}>
```

---

## Verification Status

All button migrations verified: 88/88 tests pass, 0 typecheck errors, 0 lint warnings. Select migration deferred — see `../errors/button-migration-gotchas.md` §5.

## Provenance

This reference documents the archived change `adopt-remix3-ui-primitives`:
- Archive: `openspec/changes/archive/2026-05-05-adopt-remix3-ui-primitives/`
- Scope: 33 button elements migrated across 11 files, ~20 redundant mixins removed

---

## 🧭 Codebase References

- All `Button` imports: 14 files listed above
- `remix/ui/button` — Component source
- `remix/ui/animation` — Animation mixin source

## Related

- `../concepts/button-tone-convention.md` — Full convention documentation
- `../guides/animation-adoption.md` — Animation usage patterns
- `../errors/button-migration-gotchas.md` — Migration pitfalls and trade-offs
