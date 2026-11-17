/**
 * The app's one-shot PRG flash vocabulary.
 *
 * `error` and `success` are the only keys the app renders. The same list is
 * given to `mergeSessionWrites` (it must be told every flash key or a
 * concurrent save silently drops the value) and read by `FlashBanner`, so add a
 * tone here — never as a bare string at a write site.
 */
export const FLASH_KEYS = ['error', 'success'] as const

export type FlashTone = (typeof FLASH_KEYS)[number]

export type FlashState = Partial<Record<FlashTone, string>>

/** The session surface a write goes through; structural so tests can fake it. */
export type FlashWriter = {
  flash(key: FlashTone, value: string): void
}

/** The session surface the banner reads through. */
export type FlashReader = {
  get(key: string): unknown
}

/**
 * Write a one-shot message for the next response. `session` may be absent on
 * routes that run without one; the write is then a no-op rather than a crash.
 */
export function flash(
  session: FlashWriter | null | undefined,
  tone: FlashTone,
  message: string,
): void {
  session?.flash(tone, message)
}

export function flashError(session: FlashWriter | null | undefined, message: string): void {
  flash(session, 'error', message)
}

export function flashSuccess(session: FlashWriter | null | undefined, message: string): void {
  flash(session, 'success', message)
}

/** Read the pending tones for this response. Values are rendered as plain text. */
export function readFlash(session: FlashReader | null | undefined): FlashState {
  let state: FlashState = {}
  if (!session) return state
  for (let tone of FLASH_KEYS) {
    let value = session.get(tone)
    if (typeof value === 'string') state[tone] = value
  }
  return state
}
