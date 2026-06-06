/**
 * Shared appointment interaction state for cross-module access.
 *
 * The grid component sets `active` to `true` while the user is dragging,
 * resizing, or editing. The SSE subscriber checks this flag before
 * triggering a page reload to avoid interrupting the user.
 *
 * @example
 * ```ts
 * import { interactionState } from './appointment-interaction-state.ts'
 * interactionState.active = true  // during drag
 * interactionState.active = false // after drag ends
 * ```
 */
export const interactionState = { active: false }
