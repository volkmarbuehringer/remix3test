import { clientEntry, type Handle } from 'remix/component'

const SELECT = 'select[data-page-size-select]'
const CUSTOM = 'input[data-page-size-custom]'

/**
 * Keeps the free-form page-size input in step with the preset select.
 *
 * Selecting a preset only changes `pageSize`; without this entry the custom
 * input stays empty, and an empty number input starts at `min` when
 * ArrowUp/ArrowDown is pressed (verified in Chromium and Firefox), not at the
 * selected value. Mirror the select on `change`, and prefill an empty custom
 * input on focus so fine-tuning starts from the current preset.
 *
 * Empty still means "use the select": a non-empty custom value survives focus,
 * but changing the select is an explicit coarse choice and overwrites it.
 */
export const PageSizeSelectSync = clientEntry(
  import.meta.url + '#PageSizeSelectSync',
  function PageSizeSelectSyncEntry(handle: Handle) {
    handle.queueTask(() => {
      document.addEventListener(
        'change',
        (event) => {
          let target = event.target
          if (!(target instanceof HTMLSelectElement)) return
          if (!target.matches(SELECT)) return

          let input = target.closest('form')?.querySelector<HTMLInputElement>(CUSTOM)
          if (!input || input.value === target.value) return
          input.value = target.value
          input.dispatchEvent(new Event('input', { bubbles: true }))
        },
        { signal: handle.signal },
      )

      document.addEventListener(
        'focusin',
        (event) => {
          let target = event.target
          if (!(target instanceof HTMLInputElement)) return
          if (!target.matches(CUSTOM)) return
          if (target.value !== '') return

          let select = target.closest('form')?.querySelector<HTMLSelectElement>(SELECT)
          if (!select) return
          target.value = select.value
          target.dispatchEvent(new Event('input', { bubbles: true }))
        },
        { signal: handle.signal },
      )

      // Hydration marker for e2e: a select before this listener attaches is a
      // silent no-op, so tests wait for the marker instead of retrying clicks.
      for (let select of Array.from(document.querySelectorAll<HTMLSelectElement>(SELECT))) {
        select.setAttribute('data-page-size-sync-ready', 'true')
      }
    })

    return () => null
  },
)
