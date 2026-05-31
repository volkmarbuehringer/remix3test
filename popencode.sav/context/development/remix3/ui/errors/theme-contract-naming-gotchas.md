<!-- Context: development/remix3/ui/errors/theme-contract-naming-gotchas | Priority: medium | Version: 1.0 | Updated: 2026-05-05 -->

# Error: Theme Contract Naming Gotchas

**Issue**: The `createTheme()` contract uses property names that differ from intuitive expectations, especially for action/danger/secondary color variants.

## Common Mistakes

### Action Colors

```ts
// ❌ WRONG — these names do NOT exist in the contract
colors.action.primary.text           // ❌
colors.action.secondary.hover        // ❌
colors.action.danger.active          // ❌
colors.action.primary.foregroundHover // ❌

// ✅ CORRECT — actual contract property names
colors.action.primary.foreground         // ✅ (NOT .text)
colors.action.primary.backgroundHover    // ✅ (NOT .hover)
colors.action.primary.backgroundActive   // ✅ (NOT .active)
colors.action.danger.foreground         // ✅
colors.action.danger.backgroundHover    // ✅
colors.action.secondary.foreground      // ✅
colors.action.secondary.backgroundHover // ✅
```

### Naming Pattern

The contract uses these suffixes for action colors:
| Wrong | Correct | 
|-------|---------|
| `.text` | `.foreground` |
| `.hover` | `.backgroundHover` |
| `.active` | `.backgroundActive` |

### CSS Variable Equivalents

In raw CSS, the same pattern applies using kebab-case:
```css
/* ✅ Correct */
var(--rmx-color-action-primary-foreground)
var(--rmx-color-action-primary-background-hover)
var(--rmx-color-action-primary-background-active)
var(--rmx-color-action-danger-foreground)
var(--rmx-color-action-secondary-foreground)

/* ❌ Wrong */
var(--rmx-color-action-primary-text)
var(--rmx-color-action-primary-hover)
```

### Raw `var()` Without `--rmx-` Prefix (added 2026-05-06)

**Issue**: The `css()` function compiles `theme.*` tokens to `var(--rmx-*)` references. Writing raw `var()` strings with non-standard names bypasses this mapping, causing the browser to fall through to the hardcoded fallback — **dark mode never applies**.

```css
/* ❌ Wrong — variable name doesn't match theme contract */
color: var(--text-primary, #0f172a);

/* ✅ Correct — use theme.* inside css() */
color: theme.colors.text.primary;
```

The `css()` function automatically prefixes the correct `--rmx-` path. The raw `var()` approach works with direct CSS but creates variable names that don't match the generated `--rmx-*` variables from `createTheme()`.

**Fix**: Always prefer `theme.*` tokens in `css()` blocks. If you must use `var()`, ensure the variable name matches exactly (e.g., `var(--rmx-colors-text-primary)`).

**Related**:
- `../concepts/theme-contract.md` — Theme contract concept
- `../../lookup/theme-contract-variables.md` — CSS variable reference
- `../examples/theme-usage.md` — Theme usage examples
