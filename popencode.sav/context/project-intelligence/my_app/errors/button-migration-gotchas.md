<!-- Context: project-intelligence/my_app/errors/button-migration-gotchas | Priority: high | Version: 1.1 | Updated: 2026-05-05 -->

# Error Reference: Button Migration Gotchas

**Purpose**: Document issues, trade-offs, and patterns discovered during migration from custom-styled `<button>` elements to `Button` from `remix/ui/button`.

---

## 1. State-Driven Button (PromptButton) Needs Custom Mixin Composition

**Symptom**: PromptButton has a 4-state lifecycle (`idle → copied → resetting → idle`) that changes background/color per state. The old approach used `className={state}` with CSS class selectors.

**Solution**: Compose `tone` with state-driven `css()` mixins in `mix` array:

```tsx
// ✅ Correct: tone + base mixin + state style via second css()
<Button
  tone="ghost"
  mix={[
    buttonStyle,                    // base layout (width, padding, gap, etc.)
    on('click', async (_, signal) => { /* state machine */ }),
  ]}
  style={{
    // one-off state-driven overrides via style prop
    background: active ? 'var(--surface-4)' : undefined,
    color: active ? 'var(--brand-blue)' : undefined,
  }}
>
```

**Key insight**: `mix` takes a single `css()` object or an array. State-driven styles that change per render can use the `style` prop for overrides, since `mix` values are typically static.

---

## 2. Icon-Only Buttons Need Explicit Sizing + Flex Centering

**Symptom**: Icon-only `<Button tone="primary">` rendered at incorrect size (too small or misaligned).

**Root cause**: Button's built-in tone styles assume text content with padding. An icon-only button (e.g., send button with SVG) needs explicit width/height and flex centering.

**Solution**: Keep a minimal custom mixin for dimensions only:

```tsx
// ✅ Correct: tone handles color/bg, mixin handles shape
const sendButtonStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: theme.space.xl,
  height: theme.space.xl,
  borderRadius: theme.radius.lg,
  flexShrink: 0,
  '&:hover': { transform: 'scale(1.05)' },
  '&:active': { transform: 'scale(0.95)' },
})

<Button type="submit" tone="primary" mix={sendButtonStyle}>
  <svg>...</svg>
</Button>
```

**Before migration**: The mixin also contained `background`, `color`, `border` — all now covered by `tone="primary"`.

---

## 3. Button `type` Attribute Defaults Correctly

**Observation**: No need to override `type` in most cases:

```tsx
// Inside a <form> — correct: defaults to submit
<Button tone="primary">Submit</Button>

// Outside a <form> — correct: still works as expected
<Button tone="ghost" mix={on('click', handler)}>Click</Button>
```

Button follows the same default behavior as native `<button>`:
- Inside `<form>` → `type="submit"` (default)
- Outside `<form>` → `type="button"` (no submit behavior)

`type="button"` was removed from most non-form Button instances during migration. It's harmless to keep but unnecessary.

---

## 4. Button Works in Both SSR and clientEntry Contexts

**Positive finding** (not an error): `Button` from `remix/ui/button` imports identically in:
- Server components (auth controllers, layout, admin pages)
- `clientEntry` components (lists-client, toast, prompt-button)

No special handling, no context guards, no conditional imports needed.

---

## 5. Native `<select>` Kept — `Select` Compound Deferred

**Status**: Deferred — `remix/ui/select` is a compound component (Context + trigger + list + options + hidden input + popover mixins), not a drop-in replacement. Tasks 7.1–7.4 were reverted or blocked by inline JS handler dependencies. See archive design.md Decision 2.

**Path forward**: Investigate separately if native `<select>` styling becomes a limitation. Would need popover/popup wiring and event handler migration.

**Affected files**: `client/edit-form.tsx` (role/status selects), `workflow/page.tsx` (workflow select).

---

## 6. Mixin Cleanup — Identifying Redundant Properties

**Pattern for deciding what to keep**:

| If the mixin only contained... | Action |
|-------------------------------|--------|
| `background`, `color`, `border`, `padding`, `font-size`, `font-weight` | Delete entirely (tone covers it) |
| Hover/active/focus styles for the same properties | Delete (tone provides these) |
| Unique layout (width, height, display, flex, grid) | Keep only the unique properties |
| State-driven animations (loading spinner, disabled cursor) | Keep, simplify to state-only rules |
| Hover scale/transform | Keep — tonal hover doesn't add transforms |

**Concrete examples of removed mixins**:

| Removed Mixin | File | Why Removed |
|---------------|------|-------------|
| `btnPrimary`, `btnSecondary`, `btnAccent`, `btnDanger`, `btnIcon` | lists-client.tsx | All covered by tone |
| `deleteButtonStyle`, `copyButtonStyle` | admin/lists/index-page.tsx | Covered by danger/secondary |
| `submitButtonStyles` | workflow/page.tsx | Covered by primary + startIcon |
| `editBtnStyle`, `deleteBtnStyle`, `pageBtnStyle` | client/grid-page.tsx | Covered by secondary/danger |
| `saveBtnStyle`, `cancelBtnStyle` | client/edit-form.tsx | Covered by primary/secondary |
| `filterButtonStyle`, `deleteBtnStyle` | admin/chatlog-page.tsx | Covered by primary/danger |
| `sendButtonStyle`, `pageButtonStyle` | messages/fragment-page.tsx | Covered by primary/secondary |
| `btnStyle` | auth-styles.ts | Covered by primary |

---

## 7. Final Verification

All 33 button migrations across 11 files verified clean:
- 88/88 tests pass (task 10.1)
- 0 typecheck errors (task 10.2)
- 0 lint warnings/errors (task 10.3)
- Select migration (tasks 7.1–7.4) remains deferred as noted in §5

---

## 🧭 Codebase References

- `my_app/app/ui/prompt-button.tsx` — State-driven Button with ghost tone + style prop overrides
- `my_app/app/actions/agent/page.tsx` — Icon-only circular button with mixin (lines 101-110)
- `my_app/app/actions/chat/page.tsx` — Icon-only circular button with mixin (lines 215-225)
- `my_app/app/assets/lists-client.tsx` — All 4 tones, mix composition with on('click')
- `my_app/app/actions/client/edit-form.tsx` — Native `<select>` kept
- `my_app/app/actions/workflow/page.tsx` — Native `<select>` kept, startIcon usage

## Related

- `../concepts/button-tone-convention.md` — Tone mapping convention and mixin cleanup rules
- `../guides/ui-component-patterns.md` — PromptButton lifecycle description
- `development/remix3/ui/guides/mixins.md` — General mixin composition rules
- Archive: `openspec/changes/archive/2026-05-05-adopt-remix3-ui-primitives/` — Full design, specs, and task list
