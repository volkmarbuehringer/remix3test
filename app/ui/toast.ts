export type ToastTone = 'error' | 'success'

export interface ToastRequest {
  message: string
  tone: ToastTone
}

/** Document event that carries a toast from imperative callers to `ToastHost`. */
export const TOAST_EVENT = 'app:toast-request'

/**
 * Shows a transient toast. Fire-and-forget: the shell's `ToastHost` owns the
 * DOM, animation and timing. Without a mounted host (SSR, isolated component
 * tests) this is a no-op.
 */
export function showToast(message: string, tone: ToastTone = 'error') {
  if (typeof document === 'undefined') return
  document.dispatchEvent(
    new CustomEvent<ToastRequest>(TOAST_EVENT, {
      detail: { message, tone },
    }),
  )
}
