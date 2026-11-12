import { clientEntry, type Handle } from 'remix/component'

export interface PageSizeCustomKeysProps {
  /** Preset sizes in ascending order (the same list the select offers). */
  presets: readonly number[]
  min: number
  max: number
}

/**
 * Coarse/fine keyboard stepping for the free-form page-size input.
 *
 * A number input natively steps by 1 with ArrowUp/ArrowDown; PageUp/PageDown,
 * Home and End do nothing (verified in Chromium and Firefox). This entry maps
 * them to the presets and bounds:
 *
 * - PageUp / PageDown -> next / previous preset (37 -> 50 / 25)
 * - Home / End -> min / max
 *
 * Rendered beside the input; it attaches one delegated `keydown` listener and
 * cleans it up with `handle.signal`. Registration follows the vendor guidance
 * for listeners outside the rendered tree (queueTask after commit).
 */
export const PageSizeCustomKeys = clientEntry(
  import.meta.url + '#PageSizeCustomKeys',
  function PageSizeCustomKeysEntry(handle: Handle<PageSizeCustomKeysProps>) {
    handle.queueTask(() => {
      document.addEventListener(
        'keydown',
        (event) => {
          if (event.defaultPrevented) return
          if (event.ctrlKey || event.metaKey || event.altKey) return

          let target = event.target
          if (!(target instanceof HTMLInputElement)) return
          if (!target.matches('input[type="number"][data-page-size-custom]')) return

          let { presets, min, max } = handle.props
          let next: number | null = null
          if (event.key === 'PageUp' || event.key === 'PageDown') {
            next = nextPreset(
              Number(target.value),
              event.key === 'PageUp' ? 1 : -1,
              presets,
              min,
              max,
            )
          } else if (event.key === 'Home') {
            next = min
          } else if (event.key === 'End') {
            next = max
          }

          if (next == null) return
          event.preventDefault()
          if (target.value === String(next)) return
          target.value = String(next)
          target.dispatchEvent(new Event('input', { bubbles: true }))
        },
        { signal: handle.signal },
      )

      // Hydration marker for e2e; the keydown listener above is delegated.
      for (let input of Array.from(
        document.querySelectorAll<HTMLInputElement>('input[type="number"][data-page-size-custom]'),
      )) {
        input.setAttribute('data-page-size-keys-ready', 'true')
      }
    })

    return () => null
  },
)

/**
 * Next/previous preset relative to `current`. A value between presets moves to
 * the neighbour in that direction; a value outside the list clamps to the
 * nearest end. Blank/invalid starts at the lower bound so PageUp lands on the
 * first preset.
 */
function nextPreset(
  current: number,
  direction: 1 | -1,
  presets: readonly number[],
  min: number,
  max: number,
): number {
  let ordered = [...presets].toSorted((a, b) => a - b)
  let base =
    Number.isFinite(current) && current >= min && current <= max
      ? current
      : direction === 1
        ? min - 1
        : min

  if (direction === 1) {
    return ordered.find((preset) => preset > base) ?? max
  }

  let lower = ordered.filter((preset) => preset < base)
  return lower.length > 0 ? lower[lower.length - 1]! : min
}
