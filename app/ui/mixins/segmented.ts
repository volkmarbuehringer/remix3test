import { css } from 'remix/ui'
import { theme } from '../theme/theme.ts'

/**
 * Position styles for one button inside a joined segmented group (the period and
 * status switchers on the admin appointment and offering pages).
 *
 * They must be applied to the `<button>` itself and listed **after** the vendor
 * `button()` mixin in the `mix` array. Remix UI emits every `css()` rule in its
 * own `@layer rmx.<class>` sub-layer, and inside the `rmx` layer the sub-layer
 * declared last wins *regardless of specificity*. Which one that is depends on
 * the order the classes happen to be registered during rendering — so a plain
 * override wins for some segments and loses for others (the active, primary-tone
 * segment is the usual casualty). The `border-*` declarations below are therefore
 * marked `!important`, which beats the mixin's non-important `border` shorthand
 * deterministically. This is the escape hatch the app already uses for vendor
 * styles that cannot be out-specified (see `main-nav.tsx`,
 * `appointment-grid-styles.ts`).
 *
 * Non-contested properties (padding, radii, opacity) are inherited by the same
 * layer rules and need no boost; they live here so a segment's shape is
 * described in one place.
 */
export function segmentedButton(options: {
  isFirst: boolean
  isLast: boolean
  /** Horizontal padding, e.g. `theme.space.xs` (default) or `theme.space.sm`. */
  paddingX?: string
  disabled?: boolean
}) {
  let { isFirst, isLast, paddingX = theme.space.xs, disabled = false } = options

  return css({
    paddingLeft: paddingX,
    paddingRight: paddingX,
    // Square inner corners.
    borderTopLeftRadius: isFirst ? undefined : '0',
    borderBottomLeftRadius: isFirst ? undefined : '0',
    borderTopRightRadius: isLast ? undefined : '0',
    borderBottomRightRadius: isLast ? undefined : '0',
    // Drop the left border of every non-first segment, so the previous segment's
    // right border is the only line in the gap: one themed 1px divider instead
    // of two 1px borders sitting next to each other.
    borderLeft: isFirst ? undefined : '0 !important',
    // Dividers are themed. The last segment keeps the mixin's border on its
    // right, which is the group's outer edge rather than an internal divider.
    borderRight: isLast ? undefined : `1px solid ${theme.colors.border.default} !important`,
    ...(disabled ? ({ opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none' } as const) : {}),
  })
}
