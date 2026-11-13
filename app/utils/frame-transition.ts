/**
 * Contract between the server-rendered admin lists page and the client-side frame
 * View Transition (`app/assets/frame-transition.browser.ts`).
 *
 * The attribute rides the server HTML, so it exists in both the outgoing and the
 * incoming snapshot of a grid ⇄ editor frame navigation. The transition only names
 * the region for the duration of `document.startViewTransition()`; a
 * `view-transition-name` must stay unique, so it is never authored in CSS.
 */
export const ADMIN_LISTS_TRANSITION_REGION = 'admin-lists'
export const ADMIN_LISTS_TRANSITION_NAME = 'admin-lists-content'
export const ADMIN_LISTS_TRANSITION_SELECTOR = `[data-frame-transition-region="${ADMIN_LISTS_TRANSITION_REGION}"]`
