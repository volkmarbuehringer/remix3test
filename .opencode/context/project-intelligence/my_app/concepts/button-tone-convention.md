<!-- Context: project-intelligence/my_app/concepts/button-tone-convention | Priority: high | Version: 1.1 | Updated: 2026-05-05 -->

# Button Tone Convention

**Core Idea**: All `<button>` elements in my_app use `Button` from `remix/ui/button` with a consistent tone→semantic mapping. File-local CSS mixins are removed when Button's built-in tone styles fully cover the visual need.

---

## Tone Mapping

| Tone | Semantic Meaning | Example Actions | Files |
|------|-----------------|-----------------|-------|
| `primary` | Submit, save, create, primary CTA | Login, Register, Send, Save, Search, Shuffle, Run Workflow | auth-login, auth-register, chat, agent, messages, lists-client, workflow, edit-form |
| `secondary` | Cancel, reset, navigate, paginate | Pagination prev/next, Edit row, Cancel, Copy list, Reverse | messages/fragment-page, client/grid-page, edit-form, admin/lists, lists-client |
| `ghost` | Nav/utility, icon-only actions | Logout, Theme toggle, Hamburger, Edit icon, Move up/down, Dismiss toast | layout, toast, prompt-button, lists-client (edit/move icons) |
| `danger` | Destructive actions | Delete list, Delete row, Delete conversation | admin/lists, client/grid-page, admin/chatlog-page, lists-client |

---

## Mix Composition Rules

Button's `mix` prop composes with tone mixins:

```tsx
// Single custom mixin on top of tone
<Button tone="ghost" mix={navButtonStyle}>Logout</Button>

// Array — order matters, last matching property wins
<Button tone="primary" mix={[on('click', handler), css({ flex: 1 })]}>Save</Button>

// State-driven composition (PromptButton pattern)
<Button tone="ghost" mix={[baseStyle, css({ background: active ? 'var(--surface-4)' : undefined })]}>
```

---

## CSS Mixin Cleanup Rules

Remove file-local button mixins when Button's built-in tone covers the intent:

| Scenario | Action | Example Saved |
|----------|--------|---------------|
| Tone covers all visuals (bg, color, border, padding, font-size) | Remove mixin entirely | `btnPrimary`, `btnSecondary`, `btnDanger`, `btnAccent`, `btnIcon` in lists-client.tsx, `submitButtonStyles` in workflow, `deleteButtonStyle`/`copyButtonStyle` in admin/lists |
| Tone covers 80%+ but needs unique hover/active | Keep minimal delta mixin | `sendButtonStyle` in agent/chat — kept hover scale, loading spinner, circular dimensions |
| Icon-only circular button | Keep mixin for dimensions + flex centering only | `sendButtonStyle` (removed redundant color/background properties already covered by `tone="primary"`) |
| Nav utility buttons | Keep mixins for nav-specific layout | `navButtonStyle`, `mobileNavButtonStyle`, `hamburgerStyle`, `themeToggleStyle` in layout.tsx |

---

## Key Observations

- **SSR + clientEntry**: Button works identically in server-rendered components and `clientEntry` components — no special handling needed
- **`type` attribute**: Button defaults to `type="submit"` inside forms, same as native `<button>`. No explicit `type="button"` needed for non-form buttons (but harmless)
- **`startIcon` prop**: Preferred over manual SVG + mixin layout. Used in workflow/page.tsx
- **`style` prop**: Still available for truly one-off overrides (e.g., `disabled`, `opacity` in state-driven contexts)
- **Select deferred**: Native `<select>` elements kept — `remix/ui/select` compound component needs separate investigation (Context + trigger + list + option + popover mixins)
- **Total scope**: 33 button elements across 11 files migrated, ~20 redundant CSS mixins removed
- **Final verification**: 88/88 tests passing, 0 typecheck errors, 0 lint warnings/errors

---

## Provenance

This convention was established during archived change `adopt-remix3-ui-primitives`:
- Archive: `openspec/changes/archive/2026-05-05-adopt-remix3-ui-primitives/`
- Design: `design.md` — Tone mapping decision (Decision 1), Select incrementality (Decision 2), SSR compatibility (Decision 4)
- Tasks: All 33 buttons migrated across 11 files. Select migration (tasks 7.1–7.4) deferred — see `errors/button-migration-gotchas.md` §5

---

## 🧭 Codebase References

- `my_app/app/actions/auth-login/controller.tsx` — primary (login)
- `my_app/app/actions/auth-register/controller.tsx` — primary (register)
- `my_app/app/actions/chat/page.tsx` — primary + sendButtonStyle mixin (circular send)
- `my_app/app/actions/agent/page.tsx` — primary + sendButtonStyle mixin (circular send)
- `my_app/app/actions/messages/fragment-page.tsx` — secondary pagination, primary send
- `my_app/app/actions/client/grid-page.tsx` — secondary edit/pagination, danger delete
- `my_app/app/actions/client/edit-form.tsx` — primary save, secondary cancel
- `my_app/app/actions/admin/lists/index-page.tsx` — danger delete, secondary copy
- `my_app/app/actions/admin/chatlog-page.tsx` — primary search, danger delete
- `my_app/app/actions/workflow/page.tsx` — primary + startIcon
- `my_app/app/assets/lists-client.tsx` — all 4 tones across 11 buttons
- `my_app/app/ui/layout.tsx` — ghost for 4 nav buttons
- `my_app/app/ui/toast.tsx` — ghost for dismiss button
- `my_app/app/ui/prompt-button.tsx` — ghost + state-driven mix composition

## Related

- `../guides/ui-component-patterns.md` — Earlier component patterns (Skeleton, Toast, Hamburger, PromptButton)
- `development/remix3/ui/guides/mixins.md` — General mixin composition rules
- `development/remix3/ui/examples/cart-button-pattern.md` — Button in clientEntry context
